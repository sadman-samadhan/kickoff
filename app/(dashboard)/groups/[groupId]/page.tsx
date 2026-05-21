/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroupClient from './GroupClient'

export default async function GroupPage({ params }: { params: { groupId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 1. Fetch group
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', params.groupId)
    .single()

  if (!group) {
    redirect('/dashboard')
  }

  // 2. Fetch members & my role
  const supabaseAdmin = createAdminClient()
  const { data: membersData } = await supabaseAdmin
    .from('group_members')
    .select('role, player_id, profiles(*)')
    .eq('group_id', params.groupId)

  const myMembership = membersData?.find(m => m.player_id === user.id)
  
  if (!myMembership) {
    // Not a member
    redirect('/dashboard')
  }

  const role = myMembership.role
  const members = membersData?.map(m => ({
    ...m.profiles,
    role: m.role
  })) || []

  // 3. Fetch bookings & RSVPs
  const { data: bookingsData } = await supabaseAdmin
    .from('bookings')
    .select('*, rsvps(*)')
    .eq('group_id', params.groupId)
    .order('match_date', { ascending: true })

  const now = new Date().toISOString()

  interface Booking {
    id: string
    match_date: string
    match_time: string
    field_name: string
    status: string
    rsvps: { player_id: string; status: string }[]
  }

  const pastBookings: Booking[] = []
  const upcomingBookings: Booking[] = []

  const nowMs = Date.now()
  const fiveHoursMs = 5 * 60 * 60 * 1000

  bookingsData?.forEach(b => {
    const matchDateTimeStr = `${b.match_date}T${b.match_time || '00:00:00'}`
    const matchTimeMs = new Date(matchDateTimeStr).getTime()

    const isPast = b.status === 'completed' || b.status === 'cancelled' || (nowMs > matchTimeMs + fiveHoursMs)
    if (isPast) {
      pastBookings.push(b)
    } else {
      upcomingBookings.push(b)
    }
  })

  // Sort past descending
  pastBookings.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())

  // Next match is the first upcoming
  const nextMatch = upcomingBookings.length > 0 ? upcomingBookings[0] : null
  const futureBookings = upcomingBookings.slice(1)

  return (
    <GroupClient 
      group={group}
      members={members as any[]}
      role={role}
      nextMatch={nextMatch as any}
      futureBookings={futureBookings as any}
      pastBookings={pastBookings as any}
      userId={user.id}
    />
  )
}
