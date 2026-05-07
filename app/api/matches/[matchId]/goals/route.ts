/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { matchId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: match } = await supabase
    .from('match_schedule')
    .select('bookings(group_id)')
    .eq('id', params.matchId)
    .single()

  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', (match.bookings as any).group_id)
    .eq('player_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: goals, error } = await supabase
    .from('goal_events')
    .select('*, scorer:profiles!scorer_id(*), assist:profiles!assist_id(*)')
    .eq('match_schedule_id', params.matchId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ goals })
}

export async function POST(req: Request, { params }: { params: { matchId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data: match } = await supabase
    .from('match_schedule')
    .select('bookings(group_id)')
    .eq('id', params.matchId)
    .single()
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', (match.bookings as any).group_id)
    .eq('player_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('goal_events')
    .insert({
      match_schedule_id: params.matchId,
      scorer_id: body.scorer_id,
      assist_id: body.assist_id || null,
      team_id: body.team_id,
      is_own_goal: body.is_own_goal || false,
      minute: body.minute || null
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
