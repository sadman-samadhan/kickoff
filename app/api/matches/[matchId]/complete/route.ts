import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { matchId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. fetch match and verify member
  const { data: match, error: matchError } = await supabase
    .from('match_schedule')
    .select('*, bookings(group_id)')
    .eq('id', params.matchId)
    .single()

  if (matchError || !match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', match.bookings.group_id)
    .eq('player_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 2. set completed
  await supabase.from('match_schedule').update({ status: 'completed' }).eq('id', params.matchId)

  // 3. calculate clean sheets
  const cleanSheets: any[] = []
  if (match.home_score === 0) {
    const { data: awayPlayers } = await supabase.from('team_players').select('player_id, team_id').eq('team_id', match.away_team_id)
    awayPlayers?.forEach(p => cleanSheets.push({ match_schedule_id: params.matchId, player_id: p.player_id, team_id: p.team_id }))
  }
  if (match.away_score === 0) {
    const { data: homePlayers } = await supabase.from('team_players').select('player_id, team_id').eq('team_id', match.home_team_id)
    homePlayers?.forEach(p => cleanSheets.push({ match_schedule_id: params.matchId, player_id: p.player_id, team_id: p.team_id }))
  }

  let awarded = 0
  if (cleanSheets.length > 0) {
    for (const cs of cleanSheets) {
       const { error } = await supabase.from('clean_sheets').insert(cs)
       if (!error) awarded++
    }
  }

  // Check if booking is fully completed
  const { data: schedule } = await supabase.from('match_schedule').select('status').eq('booking_id', match.booking_id)
  if (schedule?.every(s => s.status === 'completed')) {
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', match.booking_id)
  }

  return NextResponse.json({ success: true, clean_sheets_awarded: awarded })
}
