/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getGroupScoringSettings, calculateTournamentPlayerPoints } from '@/lib/tournamentScoring'

export async function GET(req: Request, { params }: { params: { groupId: string } }) {
  const supabaseAuth = createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sort = searchParams.get('sort') || 'points'

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: rawMembers } = await supabaseAdmin
    .from('group_members')
    .select('player_id, profiles(*)')
    .eq('group_id', params.groupId)

  const members = rawMembers?.filter((m: any) => !m.profiles?.is_suspended) || []

  if (!members || members.length === 0) return NextResponse.json({ players: [] })

  const { data: bookings } = await supabaseAdmin.from('bookings').select('id').eq('group_id', params.groupId)
  const bookingIds = bookings?.map(b => b.id) || []
  
  let matchSchedules: any[] = []
  if (bookingIds.length > 0) {
    const { data: ms } = await supabaseAdmin.from('match_schedule').select('*').in('booking_id', bookingIds)
    matchSchedules = ms || []
  }
  const matchScheduleIds = matchSchedules.map(ms => ms.id)

  let goals: any[] = []
  let cleanSheets: any[] = []
  let matchEvents: any[] = []
  
  if (matchScheduleIds.length > 0) {
    const { data: g } = await supabaseAdmin.from('goal_events').select('*').in('match_schedule_id', matchScheduleIds)
    goals = g || []
    
    const { data: cs } = await supabaseAdmin.from('clean_sheets').select('*').in('match_schedule_id', matchScheduleIds)
    cleanSheets = cs || []

    const { data: me } = await supabaseAdmin.from('match_events').select('*').in('match_schedule_id', matchScheduleIds)
    matchEvents = me || []
  }

  let teams: any[] = []
  let teamPlayers: any[] = []
  if (bookingIds.length > 0) {
    const { data: t } = await supabaseAdmin.from('teams').select('id').in('booking_id', bookingIds)
    teams = t || []
    if (teams.length > 0) {
      const { data: tp } = await supabaseAdmin.from('team_players').select('*').in('team_id', teams.map(t => t.id))
      teamPlayers = tp || []
    }
  }

  // Fetch group custom scoring settings
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('custom_scoring_settings')
    .eq('id', params.groupId)
    .single()

  const customSettings = getGroupScoringSettings(group?.custom_scoring_settings)

  const playersStats = members.map((m: any) => {
    const pId = m.player_id
    const pGoals = goals.filter(g => g.scorer_id === pId && !g.is_own_goal).length
    const pOwnGoals = goals.filter(g => g.scorer_id === pId && g.is_own_goal).length
    const pAssists = goals.filter(g => g.assist_id === pId).length
    const pCleanSheets = cleanSheets.filter(cs => cs.player_id === pId).length

    const pYellowCards = matchEvents.filter(e => e.player_id === pId && e.event_type === 'card' && e.details_json?.card_type === 'yellow').length
    const pRedCards = matchEvents.filter(e => e.player_id === pId && e.event_type === 'card' && e.details_json?.card_type === 'red').length
    const pPenaltySaves = matchEvents.filter(e => e.player_id === pId && e.event_type === 'penalty_save').length
    
    const myTeams = teamPlayers.filter(tp => tp.player_id === pId).map(tp => tp.team_id)
    
    // Count completed matches excluding DNP
    const pMatches = matchSchedules.filter(ms => {
      if (ms.status !== 'completed') return false
      const isInTeam = myTeams.includes(ms.home_team_id) || myTeams.includes(ms.away_team_id)
      if (!isInTeam) return false
      const isDnp = (ms.dnp_player_ids || []).includes(pId)
      return !isDnp
    }).length

    const motmCount = matchSchedules.filter(ms => ms.status === 'completed' && ms.motm_player_id === pId).length

    const { totalPoints: fplPoints } = calculateTournamentPlayerPoints(
      m.profiles?.preferred_position,
      {
        goals: pGoals,
        assists: pAssists,
        cleanSheets: pCleanSheets,
        penaltySaves: pPenaltySaves,
        goalsConcededOnPitch: 0,
        ownGoals: pOwnGoals,
        yellowCards: pYellowCards,
        redCards: pRedCards,
        motmCount,
        appearances: pMatches,
      },
      customSettings
    )

    return {
      player_id: pId,
      full_name: m.profiles.full_name,
      username: m.profiles.username,
      avatar_url: m.profiles.avatar_url,
      preferred_position: m.profiles.preferred_position,
      secondary_position: m.profiles.secondary_position,
      goals: pGoals,
      own_goals: pOwnGoals,
      assists: pAssists,
      clean_sheets: pCleanSheets,
      matches_played: pMatches,
      motm_count: motmCount,
      fpl_points: fplPoints
    }
  })

  // Apply User's Sorting Rules:
  // - Overall / points: Sort by FPL Points
  // - Defender / clean_sheets: Sort by Clean Sheets first, then FPL Points
  // - Playmaker / assists: Sort by Assists first, then FPL Points
  // - Scorer / goals: Sort by Goals first, then FPL Points
  playersStats.sort((a: any, b: any) => {
    if (sort === 'points') return b.fpl_points - a.fpl_points || b.goals - a.goals || a.full_name.localeCompare(b.full_name)
    if (sort === 'goals') return b.goals - a.goals || b.fpl_points - a.fpl_points
    if (sort === 'assists') return b.assists - a.assists || b.fpl_points - a.fpl_points
    if (sort === 'clean_sheets') return b.clean_sheets - a.clean_sheets || b.fpl_points - a.fpl_points
    if (sort === 'matches') return b.matches_played - a.matches_played || b.fpl_points - a.fpl_points
    return b.fpl_points - a.fpl_points
  })

  return NextResponse.json({ players: playersStats })
}
