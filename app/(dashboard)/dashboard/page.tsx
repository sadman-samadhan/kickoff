/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/groupAuth'
import { getMyProfile } from '@/lib/profile'
import DashboardClient from './DashboardClient'

// The calendar shows matches from this far back (plus everything upcoming).
const HISTORY_DAYS = 90

export default async function DashboardPage() {
  const user = await getAuthUser()
  if (!user) {
    redirect('/login')
  }

  const db = createAdminClient()
  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Round 1: everything that only needs the user id.
  const [profile, goals, assists, cleanSheets, { data: userGroupsData }, { data: latestBroadcast }] = await Promise.all([
    getMyProfile(),
    db.from('goal_events').select('id', { count: 'exact', head: true }).eq('scorer_id', user.id).eq('is_own_goal', false),
    db.from('goal_events').select('id', { count: 'exact', head: true }).eq('assist_id', user.id),
    db.from('clean_sheets').select('id', { count: 'exact', head: true }).eq('player_id', user.id),
    db.from('group_members').select('group_id, groups(id, name)').eq('player_id', user.id),
    db.from('system_broadcasts').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  interface GroupInfo {
    id: string
    name: string
  }

  const userGroups = (userGroupsData || []).map((ug) => ug.groups as unknown as GroupInfo).filter(Boolean)
  const groupIds = userGroups.map((g) => g.id)

  // Round 2: group-dependent data.
  const [{ data: allGroupMembers }, { data: bData }, { data: dismissal }] = await Promise.all([
    groupIds.length
      ? db.from('group_members').select('group_id').in('group_id', groupIds)
      : Promise.resolve({ data: [] as { group_id: string }[] }),
    groupIds.length
      ? db
          .from('bookings')
          .select('id, group_id, match_date, match_time, field_name, status, groups(name)')
          .in('group_id', groupIds)
          .gte('match_date', since)
          .order('match_date', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    latestBroadcast
      ? db.from('broadcast_dismissals').select('id').eq('user_id', user.id).eq('broadcast_id', latestBroadcast.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const memberCounts: Record<string, number> = {}
  allGroupMembers?.forEach((gm) => {
    memberCounts[gm.group_id] = (memberCounts[gm.group_id] || 0) + 1
  })

  const allBookings: any[] = bData || []
  const nowMs = Date.now()
  const fiveHoursMs = 5 * 60 * 60 * 1000

  const upcomingBookings = allBookings.filter((b) => {
    if (b.status !== 'upcoming') return false
    const matchDateTimeStr = `${b.match_date}T${b.match_time || '00:00:00'}`
    const matchTimeMs = new Date(matchDateTimeStr).getTime()
    return nowMs <= matchTimeMs + fiveHoursMs
  })

  // Round 3: my RSVP status for the upcoming matches only.
  const { data: myRsvps } = upcomingBookings.length
    ? await db.from('rsvps').select('booking_id, status').eq('player_id', user.id).in('booking_id', upcomingBookings.map((b) => b.id))
    : { data: [] as { booking_id: string; status: string }[] }
  const myStatus = new Map((myRsvps || []).map((r) => [r.booking_id, r.status]))

  const bookingsWithMyRsvp = upcomingBookings.map((b) => ({ ...b, rsvps: [], myRsvpStatus: myStatus.get(b.id) || 'none' }))

  // Pending bookings are those where user has not responded, or responded 'pending'
  const pendingBookings = bookingsWithMyRsvp.filter((b) => b.myRsvpStatus === 'none' || b.myRsvpStatus === 'pending')

  // Prepare groups payload with counts and next match
  const groupsPayload = userGroups.map((g) => {
    const gBookings = upcomingBookings.filter((b) => b.group_id === g.id)
    return {
      ...g,
      memberCount: memberCounts[g.id] || 0,
      nextMatch: gBookings.length > 0 ? gBookings[0].match_date : null,
    }
  })

  const activeBroadcast = latestBroadcast && !dismissal ? latestBroadcast : null

  return (
    <DashboardClient
      user={{ id: user.id, email: user.email } as any}
      profile={profile}
      goals={goals.count || 0}
      assists={assists.count || 0}
      cleanSheets={cleanSheets.count || 0}
      pendingBookings={pendingBookings}
      upcomingBookings={bookingsWithMyRsvp}
      allBookings={allBookings.map((b) => ({ ...b, rsvps: [] }))}
      groups={groupsPayload}
      activeBroadcast={activeBroadcast}
    />
  )
}
