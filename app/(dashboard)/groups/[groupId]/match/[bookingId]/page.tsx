import { createClient } from '@/lib/supabase/server'
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

  // Fetch RSVPs
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('*, profiles(*)')
    .eq('booking_id', params.bookingId)

  // Fetch Teams
  const { data: teamsData } = await supabase
    .from('teams')
    .select('*, team_players(*, profiles(*))')
    .eq('booking_id', params.bookingId)

  // Fetch Match Schedule
  const { data: matchSchedule } = await supabase
    .from('match_schedule')
    .select('*')
    .eq('booking_id', params.bookingId)
    .order('scheduled_order', { ascending: true })

  // Fetch Goal Events
  const scheduleIds = matchSchedule?.map((m: any) => m.id) || []
  let goalEvents: any[] = []
  if (scheduleIds.length > 0) {
    const { data: ge } = await supabase
      .from('goal_events')
      .select('*, profiles!scorer_id(*), assist:profiles!assist_id(*)')
      .in('match_schedule_id', scheduleIds)
    goalEvents = ge || []
  }

  return (
    <MatchClient 
      booking={booking}
      rsvps={rsvps || []}
      teams={teamsData || []}
      matchSchedule={matchSchedule || []}
      goalEvents={goalEvents}
      currentUser={user}
      groupId={params.groupId}
    />
  )
}
