/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { calculateFplPoints } from '@/lib/fpl'

export async function GET(req: Request, { params }: { params: { playerId: string } }) {
  const supabaseAuth = createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('preferred_position')
    .eq('id', params.playerId)
    .single()

  const playerPosition = profile?.preferred_position || 'ATT'

  const { data: goalsData } = await supabaseAdmin
    .from('goal_events')
    .select('id, match_schedule(bookings(group_id, groups(name)))')
    .eq('scorer_id', params.playerId)
    .eq('is_own_goal', false)

  const { data: ownGoalsData } = await supabaseAdmin
    .from('goal_events')
    .select('id, match_schedule(bookings(group_id, groups(name)))')
    .eq('scorer_id', params.playerId)
    .eq('is_own_goal', true)

  const { data: assistsData } = await supabaseAdmin
    .from('goal_events')
    .select('id, match_schedule(bookings(group_id, groups(name)))')
    .eq('assist_id', params.playerId)

  const { data: cleanSheetsData } = await supabaseAdmin
    .from('clean_sheets')
    .select('id, match_schedule(bookings(group_id, groups(name)))')
    .eq('player_id', params.playerId)

  const { data: teamPlayersData } = await supabaseAdmin
    .from('team_players')
    .select('team_id')
    .eq('player_id', params.playerId)

  const { data: motmMatches } = await supabaseAdmin
    .from('match_schedule')
    .select('id')
    .eq('motm_player_id', params.playerId)
    .eq('status', 'completed')

  const totalGoals = goalsData?.length || 0
  const totalOwnGoals = ownGoalsData?.length || 0
  const totalAssists = assistsData?.length || 0
  const totalCleanSheets = cleanSheetsData?.length || 0
  const totalMotm = motmMatches?.length || 0
  
  const teamIds = teamPlayersData?.map(tp => tp.team_id) || []
  let matchesPlayedData: any[] = []
  
  if (teamIds.length > 0) {
    const { data: ms } = await supabaseAdmin
      .from('match_schedule')
      .select('id, dnp_player_ids, bookings(group_id, groups(name))')
      .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
      .eq('status', 'completed')
    
    // Filter out matches where player is in DNP list
    matchesPlayedData = (ms || []).filter(m => !(m.dnp_player_ids || []).includes(params.playerId))
  }

  const totalMatches = matchesPlayedData.length

  const totalFplPoints = calculateFplPoints({
    position: playerPosition,
    goals: totalGoals,
    assists: totalAssists,
    cleanSheets: totalCleanSheets,
    ownGoals: totalOwnGoals,
    appearances: totalMatches,
    motmCount: totalMotm
  })

  const groupsMap = new Map()

  const ensureGroup = (g: any) => {
    if (!g || !g.group_id) return null;
    if (!groupsMap.has(g.group_id)) {
      groupsMap.set(g.group_id, {
        group_id: g.group_id,
        group_name: (g.groups as any)?.name,
        goals: 0, assists: 0, clean_sheets: 0, matches_played: 0, fpl_points: 0
      })
    }
    return groupsMap.get(g.group_id)
  }

  goalsData?.forEach((g: any) => {
    const group = ensureGroup(g.match_schedule?.bookings)
    if (group) group.goals++
  })

  assistsData?.forEach((a: any) => {
    const group = ensureGroup(a.match_schedule?.bookings)
    if (group) group.assists++
  })

  cleanSheetsData?.forEach((c: any) => {
    const group = ensureGroup(c.match_schedule?.bookings)
    if (group) group.clean_sheets++
  })

  matchesPlayedData?.forEach((m: any) => {
    const group = ensureGroup(m.bookings)
    if (group) group.matches_played++
  })

  // Calculate group-level FPL points
  groupsMap.forEach((grp) => {
    grp.fpl_points = calculateFplPoints({
      position: playerPosition,
      goals: grp.goals,
      assists: grp.assists,
      cleanSheets: grp.clean_sheets,
      appearances: grp.matches_played
    })
  })

  return NextResponse.json({
    goals: totalGoals,
    own_goals: totalOwnGoals,
    assists: totalAssists,
    clean_sheets: totalCleanSheets,
    matches_played: totalMatches,
    motm_count: totalMotm,
    fpl_points: totalFplPoints,
    groups: Array.from(groupsMap.values())
  })
}
