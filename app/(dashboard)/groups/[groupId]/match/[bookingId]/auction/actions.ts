/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'
import { requireBookingAdmin, requireBookingMember } from '@/lib/groupAuth'
import { callAuctionEngine, notifyAuction } from '@/lib/auction/engine'
import { notifyUsers } from '@/lib/push/notifyUsers'

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: (e as Error)?.message || 'Something went wrong' })

export type AuctionRulesInput = { budget: number; squadSize: number; bidIncrement: number; basePrice: number }
export type AuctionSetupInput = {
  rules: AuctionRulesInput
  teams: { name: string; color: string; captainId: string }[]
  tiers: { name: string; color: string; basePrice: number | null }[]
  /** rsvpId → tier name (or null for no tier) */
  assignments: Record<string, string | null>
  rememberTiers: boolean
}

function checkRules(r: AuctionRulesInput): string | null {
  const ints = [r.budget, r.squadSize, r.bidIncrement, r.basePrice]
  if (ints.some((n) => !Number.isInteger(n))) return 'Use whole numbers for the rules'
  if (r.budget <= 0) return 'Budget must be more than 0'
  if (r.squadSize < 1 || r.squadSize > 30) return 'Squad size must be between 1 and 30'
  if (r.bidIncrement <= 0) return 'Bid step must be more than 0'
  if (r.basePrice < 0) return 'Base price cannot be negative'
  if (r.basePrice * r.squadSize > r.budget) return 'Budget is too small to fill a squad at the base price'
  return null
}

const matchPath = (groupId: string, bookingId: string) => `/groups/${groupId}/match/${bookingId}`

async function loadAuction(admin: any, auctionId: string) {
  const { data } = await admin.from('auctions').select('id, booking_id, group_id, status, finalized_at').eq('id', auctionId).maybeSingle()
  if (!data) throw new Error('Auction not found')
  return data
}

/** Deletes an auction and the teams it created (only when the matchday has no fixtures yet). */
async function removeAuction(admin: any, auctionId: string, bookingId: string) {
  const { count } = await admin.from('match_schedule').select('id', { count: 'exact', head: true }).eq('booking_id', bookingId)
  if ((count ?? 0) > 0) throw new Error('This matchday already has fixtures. Delete them first.')
  const { data: teams } = await admin.from('auction_teams').select('team_id').eq('auction_id', auctionId)
  await admin.from('auctions').delete().eq('id', auctionId)
  const teamIds = (teams || []).map((t: any) => t.team_id)
  if (teamIds.length) await admin.from('teams').delete().in('id', teamIds)
}

// ─────────────── Setup ───────────────

/** Creates (or, while still in setup, replaces) the matchday's auction: teams + captains, rules, tiers and pool. */
export async function saveAuctionSetup(bookingId: string, groupId: string, input: AuctionSetupInput): Promise<Result<{ auctionId: string }>> {
  try {
    const { admin, user } = await requireBookingAdmin(bookingId, groupId)
    const ruleErr = checkRules(input.rules)
    if (ruleErr) return { ok: false, error: ruleErr }

    const teams = input.teams.map((t) => ({ ...t, name: t.name.trim() })).filter((t) => t.name)
    if (teams.length < 2) return { ok: false, error: 'Add at least two teams' }
    const captainIds = teams.map((t) => t.captainId)
    if (captainIds.some((c) => !c)) return { ok: false, error: 'Pick a captain for every team' }
    if (new Set(captainIds).size !== captainIds.length) return { ok: false, error: 'Each team needs a different captain' }

    const { data: existing } = await admin.from('auctions').select('id, status').eq('booking_id', bookingId).maybeSingle()
    if (existing && existing.status !== 'draft') return { ok: false, error: 'The auction has already started' }
    if (existing) await removeAuction(admin, existing.id, bookingId)

    const [{ count: teamCount }, { count: fixtureCount }, { data: rsvps }] = await Promise.all([
      admin.from('teams').select('id', { count: 'exact', head: true }).eq('booking_id', bookingId),
      admin.from('match_schedule').select('id', { count: 'exact', head: true }).eq('booking_id', bookingId),
      admin
        .from('rsvps')
        .select('id, player_id, guest_name, guest_position, selected_position, status, profiles(full_name, preferred_position, is_suspended)')
        .eq('booking_id', bookingId)
        .eq('status', 'in'),
    ])
    if ((teamCount ?? 0) > 0 || (fixtureCount ?? 0) > 0) {
      return { ok: false, error: 'This matchday already has teams or fixtures. Delete them to run an auction.' }
    }

    const confirmed = (rsvps || []).filter((r: any) => !r.profiles?.is_suspended)
    const confirmedPlayers = new Set(confirmed.map((r: any) => r.player_id).filter(Boolean))
    if (captainIds.some((c) => !confirmedPlayers.has(c))) {
      return { ok: false, error: 'Captains must be registered players who are confirmed for this matchday' }
    }

    const { data: auction, error: aErr } = await admin
      .from('auctions')
      .insert({
        booking_id: bookingId,
        group_id: groupId,
        budget: input.rules.budget,
        squad_size: input.rules.squadSize,
        bid_increment: input.rules.bidIncrement,
        base_price: input.rules.basePrice,
        created_by: user.id,
      })
      .select('id')
      .single()
    if (aErr || !auction) throw new Error(aErr?.message || 'Could not create the auction')

    const { data: teamRows, error: tErr } = await admin
      .from('teams')
      .insert(teams.map((t) => ({ booking_id: bookingId, name: t.name, jersey_color: t.color, captain_id: t.captainId })))
      .select('id, captain_id')
    if (tErr) throw new Error(tErr.message)
    const order = new Map(captainIds.map((c, i) => [c, i]))
    await admin.from('auction_teams').insert(
      (teamRows || []).map((t: any) => ({ team_id: t.id, auction_id: auction.id, sort_order: order.get(t.captain_id) ?? 0 })),
    )

    // Tiers: remember them for the group when asked, and snapshot them for this auction.
    const tiers = input.tiers.map((t) => ({ ...t, name: t.name.trim() })).filter((t) => t.name)
    const groupTierIds = new Map<string, string>()
    if (input.rememberTiers && tiers.length) {
      await admin.from('group_tiers').upsert(
        tiers.map((t, i) => ({ group_id: groupId, name: t.name, sort_order: i, color: t.color })),
        { onConflict: 'group_id,name' },
      )
      const { data: gts } = await admin.from('group_tiers').select('id, name').eq('group_id', groupId)
      for (const g of gts || []) groupTierIds.set(g.name, g.id)
    }
    const { data: tierRows } = tiers.length
      ? await admin
          .from('auction_tiers')
          .insert(
            tiers.map((t, i) => ({
              auction_id: auction.id,
              name: t.name,
              sort_order: i,
              color: t.color,
              base_price: t.basePrice,
              group_tier_id: groupTierIds.get(t.name) ?? null,
            })),
          )
          .select('id, name')
      : { data: [] as any[] }
    const tierId = new Map((tierRows || []).map((t: any) => [t.name, t.id]))

    const pool = confirmed.filter((r: any) => !r.player_id || !captainIds.includes(r.player_id))
    if (pool.length) {
      const { error: eErr } = await admin.from('auction_entries').insert(
        pool.map((r: any) => ({
          auction_id: auction.id,
          rsvp_id: r.id,
          player_id: r.player_id,
          display_name: r.player_id ? r.profiles?.full_name || 'Player' : r.guest_name || 'Guest',
          position: r.selected_position || r.guest_position || r.profiles?.preferred_position || null,
          tier_id: input.assignments[r.id] ? tierId.get(input.assignments[r.id] as string) ?? null : null,
        })),
      )
      if (eErr) throw new Error(eErr.message)
    }

    // Remember each registered player's tier and the rules for next time.
    if (input.rememberTiers) {
      const rows = pool
        .filter((r: any) => r.player_id && input.assignments[r.id] && groupTierIds.get(input.assignments[r.id] as string))
        .map((r: any) => ({ group_id: groupId, player_id: r.player_id, tier_id: groupTierIds.get(input.assignments[r.id] as string) }))
      if (rows.length) await admin.from('group_player_tiers').upsert(rows, { onConflict: 'group_id,player_id' })
    }
    await admin.from('groups').update({ auction_settings: input.rules }).eq('id', groupId)

    revalidatePath(matchPath(groupId, bookingId))
    return { ok: true, data: { auctionId: auction.id } }
  } catch (e) {
    return fail(e)
  }
}

export async function cancelAuction(auctionId: string): Promise<Result> {
  try {
    const db = (await import('@/lib/supabase/server')).createAdminClient()
    const a = await loadAuction(db, auctionId)
    const { admin, groupId } = await requireBookingAdmin(a.booking_id)
    if (a.finalized_at) return { ok: false, error: 'The teams are already final' }
    await removeAuction(admin, auctionId, a.booking_id)
    await notifyAuction(auctionId)
    revalidatePath(matchPath(groupId, a.booking_id))
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

// ─────────────── Running it ───────────────

export async function startAuction(auctionId: string): Promise<Result> {
  try {
    const db = (await import('@/lib/supabase/server')).createAdminClient()
    const a = await loadAuction(db, auctionId)
    const { admin, groupId, booking } = await requireBookingAdmin(a.booking_id)
    await callAuctionEngine('auction_start', { p_auction: auctionId })
    await notifyAuction(auctionId)

    // Tell captains (to bid) and everyone confirmed (to watch).
    const [{ data: teams }, { data: rsvps }, { data: group }] = await Promise.all([
      admin.from('auction_teams').select('teams(captain_id)').eq('auction_id', auctionId),
      admin.from('rsvps').select('player_id').eq('booking_id', a.booking_id).eq('status', 'in'),
      admin.from('groups').select('name').eq('id', groupId).single(),
    ])
    const captains = (teams || []).map((t: any) => t.teams?.captain_id).filter(Boolean)
    const others = (rsvps || []).map((r: any) => r.player_id).filter((id: string) => id && !captains.includes(id))
    const url = `${matchPath(groupId, booking.id)}/auction`
    await Promise.allSettled([
      notifyUsers(captains, { title: `🔨 Auction is live — ${group?.name || 'Matchday'}`, body: 'You are a captain. Open the app to bid.', url }, { groupId, bookingId: booking.id }),
      notifyUsers(others, { title: `🔨 Auction is live — ${group?.name || 'Matchday'}`, body: 'Watch the teams being picked.', url }),
    ])
    revalidatePath(matchPath(groupId, a.booking_id))
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export type AuctionControl =
  | { op: 'sold' }
  | { op: 'unsold' }
  | { op: 'next'; entryId?: string | null }
  | { op: 'skip' }
  | { op: 'undo' }
  | { op: 'retract' }
  | { op: 'call'; state: 'none' | 'once' | 'twice' }
  | { op: 'pause' }
  | { op: 'resume' }
  | { op: 'reset' }
  | { op: 'assign'; entryId: string; teamId: string | null; price: number | null }
  | { op: 'budget'; teamId: string; adjustment: number }

export async function controlAuction(auctionId: string, cmd: AuctionControl): Promise<Result> {
  try {
    const db = (await import('@/lib/supabase/server')).createAdminClient()
    const a = await loadAuction(db, auctionId)
    const { admin } = await requireBookingAdmin(a.booking_id)
    const p = { p_auction: auctionId }
    switch (cmd.op) {
      case 'sold': {
        const e = await callAuctionEngine<any>('auction_mark_sold', p)
        await notifyAuction(auctionId, { kind: 'sold', entryId: e.id, teamId: e.sold_team_id, amount: e.sold_price })
        return { ok: true }
      }
      case 'unsold': await callAuctionEngine('auction_mark_unsold', p); break
      case 'next': await callAuctionEngine('auction_next_player', { ...p, p_entry: cmd.entryId ?? null }); break
      case 'skip': await callAuctionEngine('auction_skip_player', p); break
      case 'undo': await callAuctionEngine('auction_undo_last', p); break
      case 'retract': await callAuctionEngine('auction_retract_last_bid', p); break
      case 'call': await callAuctionEngine('auction_set_call_state', { ...p, p_state: cmd.state }); break
      case 'pause':
      case 'resume': await callAuctionEngine('auction_set_paused', { ...p, p_paused: cmd.op === 'pause' }); break
      case 'reset': await callAuctionEngine('auction_reset', p); break
      case 'assign':
        await callAuctionEngine('auction_manual_assign', { ...p, p_entry: cmd.entryId, p_team: cmd.teamId, p_price: cmd.price })
        break
      case 'budget': {
        if (!Number.isInteger(cmd.adjustment)) return { ok: false, error: 'Enter a whole number' }
        if (a.finalized_at) return { ok: false, error: 'The teams are already final' }
        await admin.from('auction_teams').update({ budget_adjustment: cmd.adjustment }).eq('team_id', cmd.teamId).eq('auction_id', auctionId)
        break
      }
    }
    await notifyAuction(auctionId)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/**
 * A captain bids for their own team. Admins may bid on behalf of any team (e.g. a captain whose phone died);
 * the bid records who placed it.
 */
export async function placeAuctionBid(auctionId: string, entryId: string, amount: number, onBehalfOfTeamId?: string): Promise<Result> {
  try {
    if (!Number.isInteger(amount)) return { ok: false, error: 'Enter a whole number' }
    const db = (await import('@/lib/supabase/server')).createAdminClient()
    const a = await loadAuction(db, auctionId)
    const { user, role, admin } = await requireBookingMember(a.booking_id)
    const { data: teams } = await admin.from('auction_teams').select('team_id, teams(captain_id)').eq('auction_id', auctionId)
    const mine = (teams || []).find((t: any) => t.teams?.captain_id === user.id)?.team_id as string | undefined

    let teamId = mine
    if (onBehalfOfTeamId && onBehalfOfTeamId !== mine) {
      if (role !== 'admin') return { ok: false, error: 'Only admins can bid for another team' }
      if (!(teams || []).some((t: any) => t.team_id === onBehalfOfTeamId)) return { ok: false, error: 'Team is not in this auction' }
      teamId = onBehalfOfTeamId
    }
    if (!teamId) return { ok: false, error: 'Only captains can bid' }

    await callAuctionEngine('auction_place_bid', { p_auction: auctionId, p_team: teamId, p_entry: entryId, p_amount: amount, p_placed_by: user.id })
    await notifyAuction(auctionId, { kind: 'bid', teamId, amount, entryId })
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** Writes the final squads into the matchday's teams and tells every player which team they're in. */
export async function finalizeAuction(auctionId: string): Promise<Result> {
  try {
    const db = (await import('@/lib/supabase/server')).createAdminClient()
    const a = await loadAuction(db, auctionId)
    const { admin, groupId } = await requireBookingAdmin(a.booking_id)
    await callAuctionEngine('auction_finalize', { p_auction: auctionId })
    await notifyAuction(auctionId)

    const [{ data: sold }, { data: teams }, { data: group }] = await Promise.all([
      admin.from('auction_entries').select('player_id, sold_team_id').eq('auction_id', auctionId).eq('status', 'sold').not('player_id', 'is', null),
      admin.from('auction_teams').select('team_id, teams(name, captain_id)').eq('auction_id', auctionId),
      admin.from('groups').select('name').eq('id', groupId).single(),
    ])
    const url = matchPath(groupId, a.booking_id) + '?tab=teams'
    await Promise.allSettled(
      (teams || []).map((t: any) => {
        const ids = [t.teams?.captain_id, ...(sold || []).filter((s: any) => s.sold_team_id === t.team_id).map((s: any) => s.player_id)]
        return notifyUsers(ids, { title: `👕 Teams are set — ${group?.name || 'Matchday'}`, body: `You're in ${t.teams?.name || 'a team'}. Check your squad.`, url })
      }),
    )
    revalidatePath(matchPath(groupId, a.booking_id))
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}
