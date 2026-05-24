import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateLeagueSchedule, generateTournamentSchedule } from '@/lib/scheduleGenerator'

export async function GET(req: Request, { params }: { params: { bookingId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = createAdminClient()
  const { data: schedule, error } = await supabaseAdmin
    .from('match_schedule')
    .select('*, home:teams!home_team_id(*), away:teams!away_team_id(*), goal_events(*, profiles!scorer_id(*), assist:profiles!assist_id(*))')
    .eq('booking_id', params.bookingId)
    .order('scheduled_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedule })
}

export async function POST(req: Request, { params }: { params: { bookingId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { format } = await req.json()

  // Verify membership
  const { data: booking } = await supabase
    .from('bookings')
    .select('group_id')
    .eq('id', params.bookingId)
    .single()
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', booking.group_id)
    .eq('player_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch teams
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('booking_id', params.bookingId)
  
  if (!teams || teams.length < 2) {
    return NextResponse.json({ error: 'Not enough teams to generate schedule' }, { status: 400 })
  }

  let matches = []
  if (format === '1-leg-league') {
    matches = generateLeagueSchedule(teams, 1)
  } else if (format === '2-leg-league') {
    matches = generateLeagueSchedule(teams, 2)
  } else if (format === '1-leg-tournament') {
    matches = generateTournamentSchedule(teams, 1)
  } else if (format === '2-leg-tournament') {
    matches = generateTournamentSchedule(teams, 2)
  } else {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  }

  // Clean existing schedule first? (Optional, but usually a good idea if regenerating)
  await supabase.from('match_schedule').delete().eq('booking_id', params.bookingId)

  // Insert matches
  const insertData = matches.map(m => ({
    booking_id: params.bookingId,
    home_team_id: m.home_team_id,
    away_team_id: m.away_team_id,
    match_number: m.match_number,
    leg: m.leg,
    scheduled_order: m.scheduled_order,
    status: 'scheduled'
  }))

  const { data: inserted, error } = await supabase
    .from('match_schedule')
    .insert(insertData)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  return NextResponse.json({ success: true, schedule: inserted })
}
