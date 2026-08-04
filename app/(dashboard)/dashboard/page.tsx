/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 1. Fetch Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 2. Fetch Goals, Assists, and Clean Sheets
  const { count: goalsCount } = await supabase
    .from('goal_events')
    .select('*', { count: 'exact', head: true })
    .eq('scorer_id', user.id)
    .eq('is_own_goal', false)

  const { count: assistsCount } = await supabase
    .from('goal_events')
    .select('*', { count: 'exact', head: true })
    .eq('assist_id', user.id)

  const { count: cleanSheetsCount } = await supabase
    .from('clean_sheets')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', user.id)

  // 3. Fetch user's groups
  const { data: userGroupsData } = await supabase
    .from('group_members')
    .select('group_id, groups(*)')
    .eq('player_id', user.id)

  interface GroupInfo {
    id: string
    name: string
  }

  const userGroups = (userGroupsData || []).map((ug) => ug.groups as unknown as GroupInfo).filter(Boolean)
  const groupIds = userGroups.map((g) => g.id)

  let allBookings: any[] = []
  const memberCounts: Record<string, number> = {}

  if (groupIds.length > 0) {
    // Member counts
    const { data: allGroupMembers } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds)

    allGroupMembers?.forEach(gm => {
      memberCounts[gm.group_id] = (memberCounts[gm.group_id] || 0) + 1
    })

    // Bookings (upcoming and recently completed for the calendar)
    const { data: bData } = await supabase
      .from('bookings')
      .select('*, groups(name), rsvps(*, profiles(*)))')
      .in('group_id', groupIds)
      .order('match_date', { ascending: true })

    allBookings = (bData || []).map((b: any) => ({
      ...b,
      rsvps: (b.rsvps || []).filter((r: any) => !(r.profiles as any)?.is_suspended)
    }))
  }

  const nowMs = Date.now()
  const fiveHoursMs = 5 * 60 * 60 * 1000

  const upcomingBookings = allBookings.filter(b => {
    if (b.status !== 'upcoming') return false
    const matchDateTimeStr = `${b.match_date}T${b.match_time || '00:00:00'}`
    const matchTimeMs = new Date(matchDateTimeStr).getTime()
    return nowMs <= matchTimeMs + fiveHoursMs
  })
  await supabase
    .from('rsvps')
    .select('*')
    .eq('player_id', user.id)

  // Attach my RSVP status to upcoming bookings
  const bookingsWithMyRsvp = upcomingBookings.map(b => {
    const rsvp = b.rsvps.find((r: { player_id: string }) => r.player_id === user.id)
    return {
      ...b,
      myRsvpStatus: rsvp ? rsvp.status : 'none'
    }
  })

  // Pending bookings are those where user has not responded, or responded 'pending'
  const pendingBookings = bookingsWithMyRsvp.filter(b => b.myRsvpStatus === 'none' || b.myRsvpStatus === 'pending')

  // Prepare groups payload with counts and next match
  const groupsPayload = userGroups.map(g => {
    const gBookings = upcomingBookings.filter(b => b.group_id === g.id)
    return {
      ...g,
      memberCount: memberCounts[g.id] || 0,
      nextMatch: gBookings.length > 0 ? gBookings[0].match_date : null
    }
  })

  // Fetch active system broadcast not yet dismissed by this user
  let activeBroadcast: any = null
  const { data: latestBroadcast } = await supabase
    .from('system_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestBroadcast) {
    const { data: dismissal } = await supabase
      .from('broadcast_dismissals')
      .select('id')
      .eq('user_id', user.id)
      .eq('broadcast_id', latestBroadcast.id)
      .single()

    if (!dismissal) {
      activeBroadcast = latestBroadcast
    }
  }

  return (
    <DashboardClient
      user={user}
      profile={profile}
      goals={goalsCount || 0}
      assists={assistsCount || 0}
      cleanSheets={cleanSheetsCount || 0}
      pendingBookings={pendingBookings}
      upcomingBookings={bookingsWithMyRsvp}
      allBookings={allBookings}
      groups={groupsPayload}
      activeBroadcast={activeBroadcast}
    />
  )
}