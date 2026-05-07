import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { groupId: string } }) {
  const supabaseAuth = createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sort = searchParams.get('sort') || 'goals'

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('player_id, profiles(*)')
    .eq('group_id', params.groupId)

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
  
  if (matchScheduleIds.length > 0) {
    const { data: g } = await supabaseAdmin.from('goal_events').select('*').in('match_schedule_id', matchScheduleIds)
    goals = g || []
    
    const { data: cs } = await supabaseAdmin.from('clean_sheets').select('*').in('match_schedule_id', matchScheduleIds)
    cleanSheets = cs || []
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

  const playersStats = members.map(m => {
    const pId = m.player_id
    const pGoals = goals.filter(g => g.scorer_id === pId && !g.is_own_goal).length
    const pAssists = goals.filter(g => g.assist_id === pId).length
    const pCleanSheets = cleanSheets.filter(cs => cs.player_id === pId).length
    
    const myTeams = teamPlayers.filter(tp => tp.player_id === pId).map(tp => tp.team_id)
    const pMatches = matchSchedules.filter(ms => ms.status === 'completed' && (myTeams.includes(ms.home_team_id) || myTeams.includes(ms.away_team_id))).length

    return {
      player_id: pId,
      full_name: m.profiles.full_name,
      username: m.profiles.username,
      avatar_url: m.profiles.avatar_url,
      preferred_position: m.profiles.preferred_position,
      secondary_position: m.profiles.secondary_position,
      goals: pGoals,
      assists: pAssists,
      clean_sheets: pCleanSheets,
      matches_played: pMatches
    }
  })

  playersStats.sort((a: any, b: any) => {
    if (sort === 'goals') return b.goals - a.goals || b.matches_played - a.matches_played
    if (sort === 'assists') return b.assists - a.assists || b.matches_played - a.matches_played
    if (sort === 'clean_sheets') return b.clean_sheets - a.clean_sheets || b.matches_played - a.matches_played
    if (sort === 'matches') return b.matches_played - a.matches_played || b.goals - a.goals
    return 0
  })

  return NextResponse.json({ players: playersStats })
}
