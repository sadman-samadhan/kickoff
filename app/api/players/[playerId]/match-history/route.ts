import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { playerId: string } }) {
  const supabaseAuth = createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user || user.id !== params.playerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get('group_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: rsvps } = await supabaseAdmin
    .from('rsvps')
    .select('booking_id, bookings(*, groups(id, name))')
    .eq('player_id', params.playerId)
    .eq('status', 'in')

  if (!rsvps || rsvps.length === 0) return NextResponse.json({ history: [] })

  let bookings = rsvps.map(r => r.bookings).filter(b => b !== null)

  if (groupId && groupId !== 'all') {
    bookings = bookings.filter(b => b.group_id === groupId)
  }
  if (from) {
    bookings = bookings.filter(b => new Date(b.match_date) >= new Date(from))
  }
  if (to) {
    bookings = bookings.filter(b => new Date(b.match_date) <= new Date(to))
  }

  bookings.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())

  const bookingIds = bookings.map(b => b.id)
  
  if (bookingIds.length === 0) return NextResponse.json({ history: [] })

  const { data: schedules } = await supabaseAdmin
    .from('match_schedule')
    .select('*, home:teams!home_team_id(id, name), away:teams!away_team_id(id, name)')
    .in('booking_id', bookingIds)

  const scheduleIds = schedules?.map(s => s.id) || []
  let goals: any[] = []
  let cleanSheets: any[] = []

  if (scheduleIds.length > 0) {
    const { data: g } = await supabaseAdmin.from('goal_events').select('*').in('match_schedule_id', scheduleIds)
    goals = g || []

    const { data: cs } = await supabaseAdmin.from('clean_sheets').select('*').in('match_schedule_id', scheduleIds)
    cleanSheets = cs || []
  }

  const history = bookings.map(b => {
    const bookingSchedules = schedules?.filter(s => s.booking_id === b.id) || []
    
    const bScheduleIds = bookingSchedules.map(s => s.id)
    const bGoals = goals.filter(g => bScheduleIds.includes(g.match_schedule_id) && g.scorer_id === params.playerId && !g.is_own_goal).length
    const bAssists = goals.filter(g => bScheduleIds.includes(g.match_schedule_id) && g.assist_id === params.playerId).length
    const bCleanSheets = cleanSheets.filter(cs => bScheduleIds.includes(cs.match_schedule_id) && cs.player_id === params.playerId).length

    const mainMatch = bookingSchedules.length > 0 ? bookingSchedules[0] : null
    let teamsDisplay = null
    if (mainMatch && mainMatch.home && mainMatch.away) {
      teamsDisplay = `${mainMatch.home.name} ${mainMatch.home_score} — ${mainMatch.away_score} ${mainMatch.away.name}`
    }

    return {
      booking_id: b.id,
      group_id: b.group_id,
      group_name: b.groups.name,
      match_date: b.match_date,
      match_time: b.match_time,
      field_name: b.field_name,
      status: b.status,
      teams_display: teamsDisplay,
      is_completed: mainMatch?.status === 'completed' || b.status === 'completed',
      stats: {
        goals: bGoals,
        assists: bAssists,
        clean_sheets: bCleanSheets
      }
    }
  })

  return NextResponse.json({ history })
}
