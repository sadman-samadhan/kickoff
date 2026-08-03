import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MatchClient from './MatchClient'

export default async function MatchPage({ params }: { params: { groupId: string, bookingId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch Booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, groups(name)')
    .eq('id', params.bookingId)
    .single()

  if (!booking) redirect(`/groups/${params.groupId}`)

  const supabaseAdmin = createAdminClient()
  
  // Fetch User Role
  const { data: member } = await supabaseAdmin
    .from('group_members')
    .select('role')
    .eq('group_id', params.groupId)
    .eq('player_id', user.id)
    .single()

  // Fetch RSVPs
  const { data: rsvps } = await supabaseAdmin
    .from('rsvps')
    .select('*, profiles(*)')
    .eq('booking_id', params.bookingId)

  // Fetch Teams
  const { data: teamsData } = await supabaseAdmin
    .from('teams')
    .select('*, team_players(*, profiles(*))')
    .eq('booking_id', params.bookingId)

  // Fetch Match Schedule
  const { data: matchSchedule } = await supabase
    .from('match_schedule')
    .select('*')
    .eq('booking_id', params.bookingId)
    .order('scheduled_order', { ascending: true })

  interface MatchScheduleItem {
    id: string
    scheduled_order: number
  }

  // Fetch Match Events & Legacy Goal Events
  const scheduleIds = matchSchedule?.map((m: MatchScheduleItem) => m.id) || []
  let matchEvents: any[] = []
  let rawGoalEvents: any[] = []

  if (scheduleIds.length > 0) {
    const { data: me } = await supabaseAdmin
      .from('match_events')
      .select('*, profiles!player_id(*), secondary_profile:profiles!secondary_player_id(*)')
      .in('match_schedule_id', scheduleIds)
      .order('minute', { ascending: true })
    matchEvents = me || []

    const { data: ge } = await supabaseAdmin
      .from('goal_events')
      .select('*, profiles!scorer_id(*), assist:profiles!assist_id(*)')
      .in('match_schedule_id', scheduleIds)
    rawGoalEvents = ge || []
  }

  // Build Unified Goal Events with clean Guest Name Resolution
  const unifiedGoalEvents: any[] = []
  const seenGoalKeys = new Set<string>()

  const activeGuestRsvps = (rsvps || []).filter((r: any) => r.status === 'in' && (r.player_id === null || r.guest_name))

  matchEvents.filter((e: any) => e.event_type === 'goal').forEach((e: any) => {
    const gScorerId = e.player_id || e.details_json?.guest_player_id
    const goalKey = `${e.match_schedule_id}_${e.minute}_${gScorerId}`
    seenGoalKeys.add(goalKey)

    // Resolve Scorer Name
    let scorerName = e.profiles?.full_name || null
    let guestScorerName = null
    if (!scorerName && gScorerId) {
      const cleanId = gScorerId.replace('guest_', '').replace(' (C)', '').trim()
      const rsvp = activeGuestRsvps.find((r: any) => r.id === cleanId || r.guest_name === cleanId)
      guestScorerName = rsvp?.guest_name || (cleanId && !cleanId.includes('-') ? cleanId : 'Guest Player')
    }

    // Resolve Assist Name
    const gAssistId = e.secondary_player_id || e.details_json?.guest_secondary_player_id
    let assistName = e.secondary_profile?.full_name || null
    let guestAssistName = null
    if (!assistName && gAssistId) {
      const cleanId = gAssistId.replace('guest_', '').replace(' (C)', '').trim()
      const rsvp = activeGuestRsvps.find((r: any) => r.id === cleanId || r.guest_name === cleanId)
      guestAssistName = rsvp?.guest_name || (cleanId && !cleanId.includes('-') ? cleanId : null)
    }

    unifiedGoalEvents.push({
      id: e.id,
      match_schedule_id: e.match_schedule_id,
      scorer_id: e.player_id,
      assist_id: e.secondary_player_id,
      guest_scorer_name: guestScorerName,
      guest_assist_name: guestAssistName,
      is_own_goal: e.details_json?.is_own_goal === true,
      minute: e.minute,
      profiles: e.profiles,
      assist: e.secondary_profile,
      details_json: e.details_json
    })
  })

  rawGoalEvents.forEach((ge: any) => {
    const goalKey = `${ge.match_schedule_id}_${ge.minute}_${ge.scorer_id || ge.guest_scorer_name}`
    if (!seenGoalKeys.has(goalKey)) {
      seenGoalKeys.add(goalKey)
      unifiedGoalEvents.push(ge)
    }
  })

  // Fetch Group Members for Admin to add
  const { data: groupMembers } = await supabaseAdmin
    .from('group_members')
    .select('*, profiles(*)')
    .eq('group_id', params.groupId)

  // Check if current user has rated the field for this booking
  const { data: userRating } = await supabaseAdmin
    .from('field_ratings')
    .select('id')
    .eq('booking_id', params.bookingId)
    .eq('user_id', user.id)
    .maybeSingle()

  const activeRsvps = (rsvps || []).filter((r: any) => !(r.profiles as any)?.is_suspended)
  const activeTeams = (teamsData || []).map((t: any) => ({
    ...t,
    team_players: (t.team_players || []).filter((tp: any) => !(tp.profiles as any)?.is_suspended)
  }))
  const activeGroupMembers = (groupMembers || []).filter((gm: any) => !(gm.profiles as any)?.is_suspended)

  return (
    <MatchClient 
      booking={booking}
      rsvps={activeRsvps}
      teams={activeTeams}
      matchSchedule={matchSchedule || []}
      goalEvents={unifiedGoalEvents}
      currentUser={user}
      groupId={params.groupId}
      userRole={member?.role || 'member'}
      groupMembers={activeGroupMembers}
      initialHasRated={!!userRating}
    />
  )
}
