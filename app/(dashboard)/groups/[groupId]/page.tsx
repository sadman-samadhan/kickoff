/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthUser, getGroupRole } from '@/lib/groupAuth'
import GroupClient from './GroupClient'

// How many finished matches the group page shows (the full list lives in match history).
const PAST_LIMIT = 20
const PROFILE_FIELDS = 'id, full_name, username, avatar_url, preferred_position, secondary_position, is_suspended'

export default async function GroupPage({ params }: { params: { groupId: string } }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const supabaseAdmin = createAdminClient()
  // Matches from the last two days are classified by time below; anything older is history.
  const recentCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const bookingFields = `id, match_date, match_time, field_name, max_players, status,
    rsvps(player_id, status, waitlist_position, selected_position, profiles(is_suspended)),
    teams(id, name, jersey_color, captain_id, team_players(player_id)),
    match_schedule(home_team_id, away_team_id, home_score, away_score, status)`

  const [role, { data: group }, { data: membersData }, { data: recentData }, { data: olderData }] = await Promise.all([
    getGroupRole(params.groupId),
    supabaseAdmin.from('groups').select('*').eq('id', params.groupId).maybeSingle(),
    supabaseAdmin.from('group_members').select(`role, player_id, profiles(${PROFILE_FIELDS})`).eq('group_id', params.groupId),
    supabaseAdmin.from('bookings').select(bookingFields).eq('group_id', params.groupId).gte('match_date', recentCutoff).order('match_date', { ascending: true }),
    supabaseAdmin.from('bookings').select(bookingFields).eq('group_id', params.groupId).lt('match_date', recentCutoff).order('match_date', { ascending: false }).limit(PAST_LIMIT),
  ])

  if (!group || !role) {
    // Missing group, or not a member
    redirect('/dashboard')
  }

  const activeMembersData = membersData?.filter(m => !(m.profiles as any)?.is_suspended) || []
  const members = activeMembersData.map(m => ({
    ...(m.profiles as any),
    role: m.role
  }))

  const bookingsData = [...(recentData || []), ...(olderData || [])]

  interface Booking {
    id: string
    match_date: string
    match_time: string
    field_name: string
    max_players: number
    status: string
    rsvps: { player_id: string; status: string }[]
    teams?: any[]
    champion?: string
  }

  interface TeamStats {
    id: string
    name: string
    played: number
    points: number
    goalsFor: number
    goalsAgainst: number
    goalDifference: number
  }

  function getChampionTeamName(b: any): string {
    const teams = b.teams || []
    const matches = b.match_schedule || []

    const hasCompletedMatches = matches.some((m: any) => m.status === 'completed')
    if (!hasCompletedMatches || teams.length === 0) return ''

    const pointsTable: Record<string, TeamStats> = {}
    teams.forEach((t: any) => {
      pointsTable[t.id] = {
        id: t.id,
        name: t.name || 'Team',
        played: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0
      }
    })

    matches.forEach((match: any) => {
      if (match.status === 'completed') {
        const homeStats = pointsTable[match.home_team_id]
        const awayStats = pointsTable[match.away_team_id]
        if (homeStats && awayStats) {
          const homeScore = match.home_score || 0
          const awayScore = match.away_score || 0
          
          homeStats.played += 1
          awayStats.played += 1
          homeStats.goalsFor += homeScore
          homeStats.goalsAgainst += awayScore
          awayStats.goalsFor += awayScore
          awayStats.goalsAgainst += homeScore

          if (homeScore > awayScore) {
            homeStats.points += 3
          } else if (awayScore > homeScore) {
            awayStats.points += 3
          } else {
            homeStats.points += 1
            awayStats.points += 1
          }
        }
      }
    })

    const sorted = Object.values(pointsTable).map(t => ({
      ...t,
      goalDifference: t.goalsFor - t.goalsAgainst
    })).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
      return a.name.localeCompare(b.name)
    })

    return sorted.length > 0 ? sorted[0].name : ''
  }

  const pastBookings: Booking[] = []
  const upcomingBookings: Booking[] = []

  const nowMs = Date.now()
  const fiveHoursMs = 5 * 60 * 60 * 1000

  bookingsData.forEach((b: any) => {
    const matchDateTimeStr = `${b.match_date}T${b.match_time || '00:00:00'}`
    const matchTimeMs = new Date(matchDateTimeStr).getTime()

    const isPast = b.status === 'completed' || b.status === 'cancelled' || (nowMs > matchTimeMs + fiveHoursMs)
    
    const bookingObj: Booking = {
      id: b.id,
      match_date: b.match_date,
      match_time: b.match_time,
      field_name: b.field_name,
      max_players: b.max_players,
      status: b.status,
      rsvps: (b.rsvps || []).filter((r: any) => !(r.profiles as any)?.is_suspended),
      teams: b.teams,
      champion: getChampionTeamName(b)
    }

    if (isPast) {
      pastBookings.push(bookingObj)
    } else {
      upcomingBookings.push(bookingObj)
    }
  })

  // Sort past descending
  pastBookings.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
  pastBookings.splice(PAST_LIMIT)

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
