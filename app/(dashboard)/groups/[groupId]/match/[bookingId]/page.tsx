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

  // Fetch Goal Events
  const scheduleIds = matchSchedule?.map((m: MatchScheduleItem) => m.id) || []
  let goalEvents: { id: string; scorer_id: string; assist_id?: string; profiles: unknown; assist: unknown }[] = []
  if (scheduleIds.length > 0) {
    const { data: ge } = await supabaseAdmin
      .from('goal_events')
      .select('*, profiles!scorer_id(*), assist:profiles!assist_id(*)')
      .in('match_schedule_id', scheduleIds)
    goalEvents = ge || []
  }

  // Fetch Group Members for Admin to add
  const { data: groupMembers } = await supabaseAdmin
    .from('group_members')
    .select('*, profiles(*)')
    .eq('group_id', params.groupId)

  return (
    <MatchClient 
      booking={booking}
      rsvps={rsvps || []}
      teams={teamsData || []}
      matchSchedule={matchSchedule || []}
      goalEvents={goalEvents}
      currentUser={user}
      groupId={params.groupId}
      userRole={member?.role || 'member'}
      groupMembers={groupMembers || []}
    />
  )
}
