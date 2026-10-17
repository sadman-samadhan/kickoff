/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Hourglass } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser, getGroupRole } from '@/lib/groupAuth'
import { loadAuctionState } from '@/lib/auction/state'
import AuctionSetup, { type SetupData } from './AuctionSetup'
import AuctionRoom from './AuctionRoom'

export const dynamic = 'force-dynamic'

const DEFAULT_TIERS = [
  { name: 'Apex', color: '#f59e0b' },
  { name: 'Prestige', color: '#38bdf8' },
  { name: 'Dominion', color: '#a78bfa' },
]

export default async function AuctionPage({ params }: { params: { groupId: string; bookingId: string } }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const db = createAdminClient()
  const matchPath = `/groups/${params.groupId}/match/${params.bookingId}`

  const [role, { data: booking }] = await Promise.all([
    getGroupRole(params.groupId),
    db.from('bookings').select('id, group_id, match_date, match_time, field_name, groups(name, auction_settings)').eq('id', params.bookingId).maybeSingle(),
  ])
  if (!role) redirect('/dashboard')
  if (!booking || booking.group_id !== params.groupId) redirect(`/groups/${params.groupId}`)
  const isAdmin = role === 'admin'

  const state = await loadAuctionState({ bookingId: params.bookingId }, { userId: user.id, isAdmin })

  if (state && state.auction.status !== 'draft') {
    return <AuctionRoom initial={state} groupId={params.groupId} bookingId={params.bookingId} />
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 p-6 pt-16 text-center">
        <Hourglass className="size-10 text-ka-muted" aria-hidden />
        <h1 className="ka-display text-2xl">{state ? 'The auction is being set up' : 'No auction for this matchday'}</h1>
        <p className="text-sm text-ka-muted">{state ? "You'll get a notification when it starts." : 'Teams will be picked by the admins.'}</p>
        <Link href={matchPath} className="inline-flex h-11 items-center gap-1 rounded-xl border border-ka-line px-4 font-semibold">
          <ChevronLeft className="size-4" /> Back to matchday
        </Link>
      </div>
    )
  }

  // ── Setup data for admins ──
  const [{ data: rsvps }, { data: groupTiers }, { data: playerTiers }, { count: teamCount }, { count: fixtureCount }] = await Promise.all([
    db
      .from('rsvps')
      .select('id, player_id, guest_name, guest_position, selected_position, profiles(full_name, avatar_url, preferred_position, is_suspended)')
      .eq('booking_id', params.bookingId)
      .eq('status', 'in'),
    db.from('group_tiers').select('id, name, color, sort_order').eq('group_id', params.groupId).order('sort_order'),
    db.from('group_player_tiers').select('player_id, tier_id').eq('group_id', params.groupId),
    db.from('teams').select('id', { count: 'exact', head: true }).eq('booking_id', params.bookingId),
    db.from('match_schedule').select('id', { count: 'exact', head: true }).eq('booking_id', params.bookingId),
  ])

  // Teams that belong to a draft auction don't block re-editing the setup.
  const draftTeamCount = state ? state.teams.length : 0
  const blocked = (teamCount ?? 0) - draftTeamCount > 0 || (fixtureCount ?? 0) > 0

  const tierNameById = new Map((groupTiers || []).map((t: any) => [t.id, t.name]))
  const savedTierByPlayer = new Map((playerTiers || []).map((p: any) => [p.player_id, tierNameById.get(p.tier_id)]))
  const draftTierByRsvp = new Map(
    (state?.entries || []).map((e) => [e.rsvpId, e.tierId ? state!.tiers.find((t) => t.id === e.tierId)?.name ?? null : null]),
  )

  const players = (rsvps || [])
    .filter((r: any) => !r.profiles?.is_suspended)
    .map((r: any) => ({
      rsvpId: r.id as string,
      playerId: r.player_id as string | null,
      name: (r.player_id ? r.profiles?.full_name : r.guest_name) || 'Player',
      avatarUrl: r.profiles?.avatar_url ?? null,
      position: r.selected_position || r.guest_position || r.profiles?.preferred_position || null,
      tier: (draftTierByRsvp.get(r.id) ?? (r.player_id ? savedTierByPlayer.get(r.player_id) : null) ?? null) as string | null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const groupInfo = booking.groups as any
  const saved = groupInfo?.auction_settings || {}
  const data: SetupData = {
    groupId: params.groupId,
    bookingId: params.bookingId,
    groupName: groupInfo?.name || 'Group',
    blocked,
    players,
    rules: state
      ? { budget: state.auction.budget, squadSize: state.auction.squadSize, bidIncrement: state.auction.bidIncrement, basePrice: state.auction.basePrice }
      : { budget: saved.budget ?? 8000, squadSize: saved.squadSize ?? 0, bidIncrement: saved.bidIncrement ?? 25, basePrice: saved.basePrice ?? 50 },
    requireEachTier: state ? state.auction.requireEachTier : saved.requireEachTier !== false,
    teams: state
      ? state.teams.map((t) => ({ name: t.name, color: t.color, captainId: t.captainId || '' }))
      : [],
    tiers: state?.tiers.length
      ? state.tiers.map((t) => ({ name: t.name, color: t.color, basePrice: t.basePrice }))
      : (groupTiers?.length ? groupTiers : DEFAULT_TIERS).map((t: any) => ({ name: t.name, color: t.color, basePrice: null })),
    existingAuctionId: state?.auction.id ?? null,
  }
  return <AuctionSetup data={data} />
}
