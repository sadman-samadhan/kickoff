/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthUser, getGroupRole } from '@/lib/groupAuth'
import MatchClient from './MatchClient'

// Only the profile fields the matchday UI needs — never send whole profile rows to the browser.
const PROFILE_FIELDS = 'id, full_name, username, avatar_url, preferred_position, secondary_position, is_suspended'

export default async function MatchPage({
  params,
  searchParams
}: {
  params: { groupId: string, bookingId: string }
  searchParams?: { tab?: string }
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const supabaseAdmin = createAdminClient()

  const [role, { data: booking }, { data: rsvps }, { data: teamsData }, { data: matchSchedule }, { data: groupMembers }, { data: userRating }] =
    await Promise.all([
      getGroupRole(params.groupId),
      supabaseAdmin.from('bookings').select('*, groups(name)').eq('id', params.bookingId).maybeSingle(),
      supabaseAdmin.from('rsvps').select(`*, profiles(${PROFILE_FIELDS})`).eq('booking_id', params.bookingId),
      supabaseAdmin.from('teams').select(`*, team_players(*, profiles(${PROFILE_FIELDS}))`).eq('booking_id', params.bookingId),
      supabaseAdmin.from('match_schedule').select('*').eq('booking_id', params.bookingId).order('scheduled_order', { ascending: true }),
      supabaseAdmin.from('group_members').select(`*, profiles(${PROFILE_FIELDS})`).eq('group_id', params.groupId),
      supabaseAdmin.from('field_ratings').select('id').eq('booking_id', params.bookingId).eq('user_id', user.id).maybeSingle(),
    ])

  // Members only, and the booking must belong to the group in the URL.
  if (!role) redirect('/dashboard')
  if (!booking || booking.group_id !== params.groupId) redirect(`/groups/${params.groupId}`)

  interface MatchScheduleItem {
    id: string
    scheduled_order: number
  }

  // Fetch Match Events & Legacy Goal Events
  const scheduleIds = matchSchedule?.map((m: MatchScheduleItem) => m.id) || []
  let matchEvents: any[] = []
  let rawGoalEvents: any[] = []

  if (scheduleIds.length > 0) {
    const [{ data: me }, { data: ge }] = await Promise.all([
      supabaseAdmin
        .from('match_events')
        .select(`*, profiles!player_id(${PROFILE_FIELDS}), secondary_profile:profiles!secondary_player_id(${PROFILE_FIELDS})`)
        .in('match_schedule_id', scheduleIds)
        .order('minute', { ascending: true }),
      supabaseAdmin
        .from('goal_events')
        .select(`*, profiles!scorer_id(${PROFILE_FIELDS}), assist:profiles!assist_id(${PROFILE_FIELDS})`)
        .in('match_schedule_id', scheduleIds),
    ])
    matchEvents = me || []
    rawGoalEvents = ge || []
  }

  // Build Unified Goal Events with clean Guest Name Resolution
  const unifiedGoalEvents: any[] = []
  const matchEventGoalsBySchedule = new Set<string>()

  const activeGuestRsvps = (rsvps || []).filter((r: any) => r.status === 'in' && (r.player_id === null || r.guest_name))

  matchEvents.filter((e: any) => e.event_type === 'goal').forEach((e: any) => {
    matchEventGoalsBySchedule.add(e.match_schedule_id)
    const gScorerId = e.player_id || e.details_json?.guest_player_id || 'unknown'
    const isOwn = e.details_json?.is_own_goal === true

    // Resolve Scorer Name
    let scorerName = e.profiles?.full_name || null
    let guestScorerName = null
    if (!scorerName && gScorerId) {
      const cleanId = String(gScorerId).replace('guest_', '').replace(' (C)', '').trim()
      const rsvp = activeGuestRsvps.find((r: any) => r.id === cleanId || r.guest_name === cleanId)
      guestScorerName = rsvp?.guest_name || (cleanId && !cleanId.includes('-') ? cleanId : 'Guest Player')
    }

    // Resolve Assist Name
    const gAssistId = e.secondary_player_id || e.details_json?.guest_secondary_player_id
    let assistName = e.secondary_profile?.full_name || null
    let guestAssistName = null
    if (!assistName && gAssistId) {
      const cleanId = String(gAssistId).replace('guest_', '').replace(' (C)', '').trim()
      const rsvp = activeGuestRsvps.find((r: any) => r.id === cleanId || r.guest_name === cleanId)
      guestAssistName = rsvp?.guest_name || (cleanId && !cleanId.includes('-') ? cleanId : null)
    }

    unifiedGoalEvents.push({
      id: e.id,
      match_schedule_id: e.match_schedule_id,
      team_id: e.team_id,
      scorer_id: e.player_id,
      assist_id: e.secondary_player_id,
      guest_scorer_name: guestScorerName,
      guest_assist_name: guestAssistName,
      is_own_goal: isOwn,
      minute: e.minute,
      profiles: e.profiles,
      assist: e.secondary_profile,
      details_json: e.details_json
    })
  })

  // Fallback to legacy rawGoalEvents only if a match schedule has no match_events
  rawGoalEvents.forEach((ge: any) => {
    if (!matchEventGoalsBySchedule.has(ge.match_schedule_id)) {
      unifiedGoalEvents.push(ge)
    }
  })

  const activeRsvps = (rsvps || []).filter((r: any) => !(r.profiles as any)?.is_suspended)
  const activeTeams = (teamsData || []).map((t: any) => ({
    ...t,
    team_players: (t.team_players || []).filter((tp: any) => !(tp.profiles as any)?.is_suspended)
  }))
  const activeGroupMembers = (groupMembers || []).filter((gm: any) => !(gm.profiles as any)?.is_suspended)

  // Only what the client needs about the signed-in user.
  const currentUser = { id: user.id, email: user.email }

  return (
    <MatchClient
      booking={booking}
      rsvps={activeRsvps}
      teams={activeTeams}
      matchSchedule={matchSchedule || []}
      goalEvents={unifiedGoalEvents}
      matchEvents={matchEvents || []}
      currentUser={currentUser}
      groupId={params.groupId}
      userRole={role}
      groupMembers={activeGroupMembers}
      initialHasRated={!!userRating}
      initialTab={searchParams?.tab || 'players'}
    />
  )
}
