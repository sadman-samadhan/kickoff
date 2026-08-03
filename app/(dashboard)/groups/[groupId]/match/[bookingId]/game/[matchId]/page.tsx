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

  // 4. Fetch Home and Away Players
  const { data: homeTp } = match.home_team_id
    ? await supabaseAdmin.from('team_players').select('player_id, profiles(*)').eq('team_id', match.home_team_id)
    : { data: [] }

  const { data: awayTp } = match.away_team_id
    ? await supabaseAdmin.from('team_players').select('player_id, profiles(*)').eq('team_id', match.away_team_id)
    : { data: [] }

  const homePlayers = (homeTp || []).map((t: any) => ({ ...t.profiles, id: t.player_id })).filter((p: any) => !p.is_suspended)
  const awayPlayers = (awayTp || []).map((t: any) => ({ ...t.profiles, id: t.player_id })).filter((p: any) => !p.is_suspended)

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
