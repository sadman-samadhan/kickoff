/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthUser, getGroupRole } from '@/lib/groupAuth'
import GameDetailsClient from './GameDetailsClient'

const PLAYER_FIELDS = 'id, full_name, username, avatar_url, preferred_position, secondary_position, is_suspended'

export default async function GameDetailsPage({
  params,
}: {
  params: { groupId: string; bookingId: string; matchId: string }
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const supabaseAdmin = createAdminClient()
  const matchPath = `/groups/${params.groupId}/match/${params.bookingId}`

  const [role, { data: match }, { data: booking }] = await Promise.all([
    getGroupRole(params.groupId),
    supabaseAdmin.from('match_schedule').select('*').eq('id', params.matchId).maybeSingle(),
    supabaseAdmin.from('bookings').select('id, group_id').eq('id', params.bookingId).maybeSingle(),
  ])

  if (!role) redirect('/dashboard')
  // The URL must describe one consistent group → booking → match chain.
  if (!booking || booking.group_id !== params.groupId) redirect(`/groups/${params.groupId}`)
  if (!match || match.booking_id !== params.bookingId) redirect(matchPath)

  const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean)
  const [{ data: teams }, { data: rsvps }, { data: teamPlayers }, { data: events }] = await Promise.all([
    teamIds.length ? supabaseAdmin.from('teams').select('*').in('id', teamIds) : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from('rsvps').select('id, player_id, status, guest_name, guest_position').eq('booking_id', params.bookingId),
    teamIds.length
      ? supabaseAdmin.from('team_players').select(`team_id, player_id, profiles(${PLAYER_FIELDS})`).in('team_id', teamIds)
      : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from('match_events').select('*').eq('match_schedule_id', params.matchId).order('minute', { ascending: true }),
  ])

  const homeTeam = (teams || []).find((t: any) => t.id === match.home_team_id) || null
  const awayTeam = (teams || []).find((t: any) => t.id === match.away_team_id) || null

  const registeredFor = (teamId: string | null) =>
    (teamPlayers || [])
      .filter((t: any) => teamId && t.team_id === teamId)
      .map((t: any) => (t.profiles ? { ...t.profiles, id: t.player_id } : null))
      .filter((p: any) => p && !p.is_suspended)

  // Resolve guest players from each team's guest_members without duplicates
  const guestRsvps = (rsvps || []).filter((r: any) => r.status === 'in' && (r.player_id === null || r.guest_name))

  const resolveTeamGuests = (guestMembers: string[]) => {
    const list: any[] = []
    const seenNames = new Set<string>()

    ;(guestMembers || []).forEach((gEntry: string) => {
      const cleanId = gEntry.replace('guest_', '').replace(' (C)', '').trim()
      const rsvp = guestRsvps.find((r: any) => r.id === cleanId || r.guest_name === cleanId)
      const name = rsvp?.guest_name || (cleanId && !cleanId.includes('-') ? cleanId : null)

      if (name && !seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase())
        list.push({
          id: `guest_${rsvp?.id || cleanId}`,
          full_name: name,
          preferred_position: rsvp?.guest_position || 'ATT',
          is_guest: true,
        })
      }
    })

    return list.sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''))
  }

  const homePlayers = [...registeredFor(match.home_team_id), ...resolveTeamGuests(homeTeam?.guest_members)]
  const awayPlayers = [...registeredFor(match.away_team_id), ...resolveTeamGuests(awayTeam?.guest_members)]

  const isAdmin = role === 'admin'
  const isCaptain = [homeTeam, awayTeam].some((t: any) => t?.captain_id === user.id)

  return (
    <GameDetailsClient
      groupId={params.groupId}
      bookingId={params.bookingId}
      matchId={params.matchId}
      match={match}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      homePlayers={homePlayers}
      awayPlayers={awayPlayers}
      events={events || []}
      isAdmin={isAdmin}
      canLog={isAdmin || isCaptain}
    />
  )
}
