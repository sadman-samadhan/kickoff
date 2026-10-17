/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/groupAuth'
import { calculateMatchPlayerPitchTime, calculateTournamentPlayerPoints, getGroupScoringSettings } from '@/lib/tournamentScoring'

const GROUP = 'bookings(group_id, groups(name, custom_scoring_settings))'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

// Career stats for one player across every group, plus a per-group breakdown (scored with each group's rules).
export async function GET(_req: Request, { params }: { params: { playerId: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // The id is interpolated into PostgREST or() filters below, so it must be a plain UUID.
  const pid = params.playerId
  if (!UUID.test(pid)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const admin = createAdminClient()

  // Someone else's stats: only the groups you both belong to.
  let visibleGroups: Set<string> | null = null
  if (pid !== user.id) {
    const [{ data: mine }, { data: theirs }] = await Promise.all([
      admin.from('group_members').select('group_id').eq('player_id', user.id),
      admin.from('group_members').select('group_id').eq('player_id', pid),
    ])
    const m = new Set((mine || []).map((g: any) => g.group_id))
    visibleGroups = new Set((theirs || []).map((g: any) => g.group_id).filter((g: string) => m.has(g)))
  }

  const [{ data: profile }, { data: myTeams }, { data: goals }, { data: cleanSheets }, { data: myEvents }, { data: motm }] = await Promise.all([
    admin.from('profiles').select('preferred_position').eq('id', pid).maybeSingle(),
    admin.from('team_players').select('team_id').eq('player_id', pid),
    admin.from('goal_events').select(`match_schedule_id, scorer_id, assist_id, is_own_goal, match_schedule(${GROUP})`).or(`scorer_id.eq.${pid},assist_id.eq.${pid}`),
    admin.from('clean_sheets').select(`match_schedule_id, match_schedule(${GROUP})`).eq('player_id', pid),
    admin.from('match_events').select(`match_schedule_id, event_type, details_json, match_schedule(${GROUP})`).eq('player_id', pid).in('event_type', ['card', 'penalty_save']).is('voided_at', null),
    admin.from('match_schedule').select(`id, ${GROUP}`).eq('status', 'completed').or(`motm_player_id.eq.${pid},mvp_player_id.eq.${pid}`),
  ])
  const position = profile?.preferred_position || 'ATT'
  const teamIds = (myTeams || []).map((t: any) => t.team_id)

  // Completed matches this player's teams played, minus the ones they sat out.
  const { data: ms } = teamIds.length
    ? await admin
        .from('match_schedule')
        .select(`id, status, home_team_id, away_team_id, home_score, away_score, starting_player_ids, duration_minutes, dnp_player_ids, ${GROUP}`)
        .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
        .eq('status', 'completed')
    : { data: [] as any[] }
  const played = (ms || []).filter((m: any) => !(m.dnp_player_ids || []).includes(pid))
  const playedIds = played.map((m: any) => m.id)
  const sideTeamIds = Array.from(new Set(played.flatMap((m: any) => [m.home_team_id, m.away_team_id]).filter(Boolean)))

  const [{ data: events }, { data: rosters }] = await Promise.all([
    playedIds.length ? admin.from('match_events').select('*').in('match_schedule_id', playedIds).is('voided_at', null) : Promise.resolve({ data: [] as any[] }),
    sideTeamIds.length ? admin.from('team_players').select('team_id, player_id').in('team_id', sideTeamIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const rosterOf = (teamId: string) => (rosters || []).filter((r: any) => r.team_id === teamId).map((r: any) => r.player_id)

  // Per group buckets; every row carries its match's group.
  const groupOfMatch = new Map<string, any>()
  for (const m of [...(ms || []), ...(motm || [])]) groupOfMatch.set(m.id, m.bookings)
  for (const r of [...(goals || []), ...(cleanSheets || []), ...(myEvents || [])]) groupOfMatch.set(r.match_schedule_id, (r as any).match_schedule?.bookings)
  const groups = new Map<string, any>()
  const bucket = (matchId: string) => {
    const b = groupOfMatch.get(matchId)
    const key = b?.group_id || '_'
    if (!groups.has(key)) {
      groups.set(key, {
        group_id: b?.group_id || null, group_name: b?.groups?.name || null, settings: b?.groups?.custom_scoring_settings || null,
        goals: 0, own_goals: 0, assists: 0, clean_sheets: 0, matches_played: 0, motm: 0, yellow: 0, red: 0, pen_saves: 0, conceded: 0, hat_tricks: 0, wins: 0,
      })
    }
    return groups.get(key)
  }

  for (const g of goals || []) {
    if (g.scorer_id === pid) bucket(g.match_schedule_id)[g.is_own_goal ? 'own_goals' : 'goals']++
    if (g.assist_id === pid) bucket(g.match_schedule_id).assists++
  }
  for (const c of cleanSheets || []) bucket(c.match_schedule_id).clean_sheets++
  for (const e of myEvents || []) {
    const b = bucket(e.match_schedule_id)
    if (e.event_type === 'penalty_save') b.pen_saves++
    else if (e.details_json?.card_type === 'red') b.red++
    else if (e.details_json?.card_type === 'yellow') b.yellow++
  }
  for (const m of motm || []) bucket(m.id).motm++
  for (const m of played) {
    const b = bucket(m.id)
    b.matches_played++
    if ((goals || []).filter((g: any) => g.match_schedule_id === m.id && g.scorer_id === pid && !g.is_own_goal).length >= 3) b.hat_tricks++
    const homePids = rosterOf(m.home_team_id)
    const awayPids = rosterOf(m.away_team_id)
    const mEvents = (events || []).filter((e: any) => e.match_schedule_id === m.id)
    const pitch = calculateMatchPlayerPitchTime(mEvents, m.duration_minutes || 30, homePids, awayPids, m.starting_player_ids || [...homePids, ...awayPids], m.home_team_id)
    b.conceded += pitch.goalsConcededOnPitch[pid] || 0
    const hs = m.home_score ?? 0
    const as = m.away_score ?? 0
    if (hs !== as && teamIds.includes(hs > as ? m.home_team_id : m.away_team_id)) b.wins++
  }

  const pointsFor = (b: any) =>
    calculateTournamentPlayerPoints(
      position,
      {
        goals: b.goals, assists: b.assists, cleanSheets: b.clean_sheets, penaltySaves: b.pen_saves, goalsConcededOnPitch: b.conceded,
        ownGoals: b.own_goals, yellowCards: b.yellow, redCards: b.red, motmCount: b.motm, hatTricks: b.hat_tricks, matchWins: b.wins,
        appearances: b.matches_played,
      },
      getGroupScoringSettings(b.settings),
    ).totalPoints

  const perGroup = Array.from(groups.values()).filter((g) => g.group_id && (!visibleGroups || visibleGroups.has(g.group_id)))
  const sum = (k: string) => perGroup.reduce((s, g) => s + g[k], 0)

  return NextResponse.json(
    {
      goals: sum('goals'),
      own_goals: sum('own_goals'),
      assists: sum('assists'),
      clean_sheets: sum('clean_sheets'),
      matches_played: sum('matches_played'),
      motm_count: sum('motm'),
      hat_tricks: sum('hat_tricks'),
      wins: sum('wins'),
      fpl_points: perGroup.reduce((s, g) => s + pointsFor(g), 0),
      groups: perGroup.map((g) => ({
        group_id: g.group_id,
        group_name: g.group_name,
        goals: g.goals,
        assists: g.assists,
        clean_sheets: g.clean_sheets,
        matches_played: g.matches_played,
        fpl_points: pointsFor(g),
      })),
    },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  )
}
