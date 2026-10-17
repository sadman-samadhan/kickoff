/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { AuthError, requireGroupMember } from '@/lib/groupAuth'
import { calculateMatchPlayerPitchTime, calculateTournamentPlayerPoints, countHatTricksAndWins, getGroupScoringSettings } from '@/lib/tournamentScoring'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { groupId: string } }) {
  let admin
  try {
    ;({ admin } = await requireGroupMember(params.groupId))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof AuthError ? e.status : 500 })
  }

  const { searchParams } = new URL(req.url)
  const sort = searchParams.get('sort') || 'points'

  const [{ data: rawMembers }, { data: bookings }, { data: group }] = await Promise.all([
    admin.from('group_members').select('player_id, profiles(full_name, username, avatar_url, preferred_position, secondary_position, is_suspended)').eq('group_id', params.groupId),
    admin.from('bookings').select('id').eq('group_id', params.groupId),
    admin.from('groups').select('custom_scoring_settings').eq('id', params.groupId).maybeSingle(),
  ])
  const members = (rawMembers || []).filter((m: any) => m.profiles && !m.profiles.is_suspended)
  if (members.length === 0) return NextResponse.json({ players: [] })

  const bookingIds = (bookings || []).map((b: any) => b.id)
  const [{ data: ms }, { data: teams }] = bookingIds.length
    ? await Promise.all([
        admin.from('match_schedule').select('*').in('booking_id', bookingIds),
        admin.from('teams').select('id').in('booking_id', bookingIds),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]
  const matchSchedules: any[] = ms || []
  const matchScheduleIds = matchSchedules.map((m) => m.id)
  const teamIds = (teams || []).map((t: any) => t.id)

  const [{ data: g }, { data: cs }, { data: me }, { data: tp }] = await Promise.all([
    matchScheduleIds.length ? admin.from('goal_events').select('*').in('match_schedule_id', matchScheduleIds) : Promise.resolve({ data: [] as any[] }),
    matchScheduleIds.length ? admin.from('clean_sheets').select('*').in('match_schedule_id', matchScheduleIds) : Promise.resolve({ data: [] as any[] }),
    matchScheduleIds.length
      ? admin.from('match_events').select('*').in('match_schedule_id', matchScheduleIds).is('voided_at', null)
      : Promise.resolve({ data: [] as any[] }),
    teamIds.length ? admin.from('team_players').select('team_id, player_id').in('team_id', teamIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const goals: any[] = g || []
  const cleanSheets: any[] = cs || []
  const matchEvents: any[] = me || []
  const teamPlayers: any[] = tp || []

  const customSettings = getGroupScoringSettings(group?.custom_scoring_settings)
  const rosterOf = (teamId: string) => teamPlayers.filter((t) => t.team_id === teamId).map((t) => t.player_id)
  const { hatTricks, wins } = countHatTricksAndWins(
    matchSchedules,
    goals.map((x) => ({ match_schedule_id: x.match_schedule_id, scorer: x.scorer_id, is_own_goal: x.is_own_goal })),
    rosterOf,
  )

  // Goals conceded on pitch, per player, across completed matches (one pitch-time pass per match).
  const conceded: Record<string, number> = {}
  for (const m of matchSchedules) {
    if (m.status !== 'completed') continue
    const homePids = rosterOf(m.home_team_id)
    const awayPids = rosterOf(m.away_team_id)
    const dnp = new Set<string>(m.dnp_player_ids || [])
    const pitch = calculateMatchPlayerPitchTime(
      matchEvents.filter((e) => e.match_schedule_id === m.id),
      m.duration_minutes || 30,
      homePids,
      awayPids,
      m.starting_player_ids || [...homePids, ...awayPids],
      m.home_team_id,
    )
    for (const [pid, n] of Object.entries(pitch.goalsConcededOnPitch)) if (!dnp.has(pid)) conceded[pid] = (conceded[pid] || 0) + n
  }

  const playersStats = members.map((m: any) => {
    const pId = m.player_id
    const pGoals = goals.filter((x) => x.scorer_id === pId && !x.is_own_goal).length
    const pOwnGoals = goals.filter((x) => x.scorer_id === pId && x.is_own_goal).length
    const pAssists = goals.filter((x) => x.assist_id === pId).length
    const pCleanSheets = cleanSheets.filter((x) => x.player_id === pId).length
    const mine = matchEvents.filter((e) => e.player_id === pId)
    const pYellowCards = mine.filter((e) => e.event_type === 'card' && e.details_json?.card_type === 'yellow').length
    const pRedCards = mine.filter((e) => e.event_type === 'card' && e.details_json?.card_type === 'red').length
    const pPenaltySaves = mine.filter((e) => e.event_type === 'penalty_save').length

    const myTeams = teamPlayers.filter((t) => t.player_id === pId).map((t) => t.team_id)
    // Completed matches excluding DNP
    const pMatches = matchSchedules.filter(
      (x) => x.status === 'completed' && (myTeams.includes(x.home_team_id) || myTeams.includes(x.away_team_id)) && !(x.dnp_player_ids || []).includes(pId),
    ).length
    const motmCount = matchSchedules.filter((x) => x.status === 'completed' && (x.motm_player_id === pId || x.mvp_player_id === pId)).length

    const { totalPoints: fplPoints } = calculateTournamentPlayerPoints(
      m.profiles?.preferred_position,
      {
        goals: pGoals,
        assists: pAssists,
        cleanSheets: pCleanSheets,
        penaltySaves: pPenaltySaves,
        goalsConcededOnPitch: conceded[pId] || 0,
        ownGoals: pOwnGoals,
        yellowCards: pYellowCards,
        redCards: pRedCards,
        motmCount,
        hatTricks: hatTricks[pId] || 0,
        matchWins: wins[pId] || 0,
        appearances: pMatches,
      },
      customSettings,
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
      hat_tricks: hatTricks[pId] || 0,
      wins: wins[pId] || 0,
      fpl_points: fplPoints,
    }
  })

  // Overall / points: FPL points. Defender / Playmaker / Scorer: that stat first, then FPL points.
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
