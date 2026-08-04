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
  const activeMembersData = membersData?.filter(m => !(m.profiles as any)?.is_suspended) || []
  const members = activeMembersData.map(m => ({
    ...m.profiles,
    role: m.role
  }))

  // 3. Fetch bookings, RSVPs, teams, and match_schedule
  const { data: bookingsData } = await supabaseAdmin
    .from('bookings')
    .select('*, rsvps(*, profiles(*)), teams(*, team_players(*)), match_schedule(*)')
    .eq('group_id', params.groupId)
    .order('match_date', { ascending: true })

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

  bookingsData?.forEach(b => {
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
