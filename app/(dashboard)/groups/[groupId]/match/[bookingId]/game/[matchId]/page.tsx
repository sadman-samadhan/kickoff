/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameDetailsClient from './GameDetailsClient'

export default async function GameDetailsPage({
  params,
}: {
  params: { groupId: string; bookingId: string; matchId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = createAdminClient()

  // 1. Fetch User Role in Group
  const { data: member } = await supabaseAdmin
    .from('group_members')
    .select('role')
    .eq('group_id', params.groupId)
    .eq('player_id', user.id)
    .single()

  if (!member) redirect('/dashboard')

  // 2. Fetch Match Details
  const { data: match } = await supabaseAdmin
    .from('match_schedule')
    .select('*')
    .eq('id', params.matchId)
    .single()

  if (!match) redirect(`/groups/${params.groupId}/match/${params.bookingId}`)

  // 3. Fetch Home and Away Teams
  const { data: homeTeam } = match.home_team_id
    ? await supabaseAdmin.from('teams').select('*').eq('id', match.home_team_id).single()
    : { data: null }

  const { data: awayTeam } = match.away_team_id
    ? await supabaseAdmin.from('teams').select('*').eq('id', match.away_team_id).single()
    : { data: null }

  // 4. Fetch Home and Away Players (including registered players and guests)
  const { data: rsvps } = await supabaseAdmin
    .from('rsvps')
    .select('*')
    .eq('booking_id', params.bookingId)

  const { data: homeTp } = match.home_team_id
    ? await supabaseAdmin.from('team_players').select('player_id, profiles(*)').eq('team_id', match.home_team_id)
    : { data: [] }

  const { data: awayTp } = match.away_team_id
    ? await supabaseAdmin.from('team_players').select('player_id, profiles(*)').eq('team_id', match.away_team_id)
    : { data: [] }

  const homeRegistered = (homeTp || []).map((t: any) => ({ ...t.profiles, id: t.player_id })).filter((p: any) => !p.is_suspended)
  const awayRegistered = (awayTp || []).map((t: any) => ({ ...t.profiles, id: t.player_id })).filter((p: any) => !p.is_suspended)

  // Resolve Guest Players from team guest_members cleanly without duplicates
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

    return list
  }

  const homeGuests = resolveTeamGuests(homeTeam?.guest_members)
  const awayGuests = resolveTeamGuests(awayTeam?.guest_members)

  const homePlayers = [...homeRegistered, ...homeGuests]
  const awayPlayers = [...awayRegistered, ...awayGuests]

  // 5. Fetch Match Events
  const { data: events } = await supabaseAdmin
    .from('match_events')
    .select('*')
    .eq('match_schedule_id', params.matchId)
    .order('minute', { ascending: true })

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
      isAdmin={member.role === 'admin'}
    />
  )
}
