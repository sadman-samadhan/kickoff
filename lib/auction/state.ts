/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'
import { format, parseISO } from 'date-fns'
import { computeStanding } from '@/lib/auctionRules'
import { createAdminClient } from '@/lib/supabase/server'
import type { AuctionState } from './types'

/** Full snapshot of a matchday's auction (null if the booking has none). */
export async function loadAuctionState(
  by: { bookingId: string } | { auctionId: string },
  viewer: { userId: string; isAdmin: boolean },
): Promise<AuctionState | null> {
  const db = createAdminClient()
  let q = db
    .from('auctions')
    .select(
      'id, booking_id, group_id, status, phase, budget, squad_size, bid_increment, base_price, require_each_tier, call_state, current_entry_id, finalized_at, groups(name), bookings(match_date, match_time, field_name)',
    )
  q = 'bookingId' in by ? q.eq('booking_id', by.bookingId) : q.eq('id', by.auctionId)
  const { data: a } = await q.maybeSingle()
  if (!a) return null

  const [tiers, teams, entries, bids, events] = await Promise.all([
    db.from('auction_tiers').select('id, name, sort_order, base_price, color').eq('auction_id', a.id).order('sort_order'),
    db
      .from('auction_teams')
      .select('team_id, sort_order, budget_adjustment, teams(id, name, jersey_color, captain_id, profiles:captain_id(full_name, avatar_url))')
      .eq('auction_id', a.id)
      .order('sort_order'),
    db
      .from('auction_entries')
      .select('id, rsvp_id, player_id, display_name, position, tier_id, status, queue_order, sold_team_id, sold_price, sold_via, profiles:player_id(avatar_url, preferred_position)')
      .eq('auction_id', a.id),
    a.current_entry_id
      ? db
          .from('auction_bids')
          .select('id, team_id, amount, created_at')
          .eq('entry_id', a.current_entry_id)
          .eq('voided', false)
          .order('amount', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as any[] }),
    db
      .from('auction_events')
      .select('id, type, entry_id, team_id, amount, undone, created_at')
      .eq('auction_id', a.id)
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  const rules = { budget: a.budget, squadSize: a.squad_size, bidIncrement: a.bid_increment, basePrice: a.base_price }
  const entryRows = (entries.data ?? []) as any[]
  const tierRows = (tiers.data ?? []) as any[]
  const tierOrder = new Map(tierRows.map((t) => [t.id, t.sort_order as number]))
  const booking = a.bookings as any

  const teamList = ((teams.data ?? []) as any[]).map((r) => {
    const t = r.teams || {}
    const sold = entryRows.filter((e) => e.status === 'sold' && e.sold_team_id === r.team_id).map((e) => e.sold_price as number)
    return {
      id: r.team_id,
      name: t.name || 'Team',
      color: t.jersey_color || '#64748b',
      captainId: t.captain_id ?? null,
      captainName: t.profiles?.full_name ?? null,
      captainAvatar: t.profiles?.avatar_url ?? null,
      sortOrder: r.sort_order,
      budgetAdjustment: r.budget_adjustment,
      standing: computeStanding(rules, sold, r.budget_adjustment),
    }
  })

  return {
    auction: {
      id: a.id,
      bookingId: a.booking_id,
      groupId: a.group_id,
      groupName: (a.groups as any)?.name || 'Group',
      matchLabel: booking?.match_date
        ? `${format(parseISO(booking.match_date), 'EEE d MMM')} · ${String(booking.match_time || '').slice(0, 5)} · ${booking.field_name || ''}`
        : '',
      status: a.status,
      phase: a.phase,
      budget: a.budget,
      squadSize: a.squad_size,
      bidIncrement: a.bid_increment,
      basePrice: a.base_price,
      requireEachTier: a.require_each_tier !== false,
      callState: a.call_state,
      currentEntryId: a.current_entry_id,
      finalizedAt: a.finalized_at,
    },
    tiers: tierRows.map((t) => ({ id: t.id, name: t.name, sortOrder: t.sort_order, basePrice: t.base_price, color: t.color })),
    teams: teamList,
    entries: entryRows
      .map((e) => ({
        id: e.id,
        rsvpId: e.rsvp_id,
        playerId: e.player_id,
        name: e.display_name,
        avatarUrl: e.profiles?.avatar_url ?? null,
        position: e.position || e.profiles?.preferred_position || null,
        isGuest: !e.player_id,
        tierId: e.tier_id,
        status: e.status,
        queueOrder: e.queue_order,
        soldTeamId: e.sold_team_id,
        soldPrice: e.sold_price,
        soldVia: e.sold_via,
      }))
      .sort(
        (x, y) =>
          (tierOrder.get(x.tierId) ?? 99) - (tierOrder.get(y.tierId) ?? 99) ||
          (x.queueOrder ?? 1e9) - (y.queueOrder ?? 1e9) ||
          x.name.localeCompare(y.name),
      ),
    currentBids: ((bids.data ?? []) as any[]).map((b) => ({ id: b.id, teamId: b.team_id, amount: b.amount, createdAt: b.created_at })),
    events: ((events.data ?? []) as any[]).map((ev) => ({
      id: ev.id,
      type: ev.type,
      entryId: ev.entry_id,
      teamId: ev.team_id,
      amount: ev.amount,
      undone: ev.undone,
      createdAt: ev.created_at,
    })),
    myTeamId: teamList.find((t) => t.captainId === viewer.userId)?.id ?? null,
    isAdmin: viewer.isAdmin,
    fetchedAt: new Date().toISOString(),
  }
}
