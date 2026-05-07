import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { matchId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { home_score, away_score, status } = await req.json()

  // Verify group membership
  const { data: match } = await supabase
    .from('match_schedule')
    .select('bookings(group_id)')
    .eq('id', params.matchId)
    .single()

  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', match.bookings.group_id)
    .eq('player_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('match_schedule')
    .update({ home_score, away_score, status })
    .eq('id', params.matchId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
