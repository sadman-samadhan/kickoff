/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { matchId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { home_score, away_score, status, dnp_player_ids, dnp_guest_names, motm_player_id, motm_guest_name } = await req.json()

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
    .eq('group_id', (match.bookings as any).group_id)
    .eq('player_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('match_schedule')
    .update({
      home_score,
      away_score,
      status,
      dnp_player_ids: dnp_player_ids || [],
      dnp_guest_names: dnp_guest_names || [],
      motm_player_id: motm_player_id || null,
      motm_guest_name: motm_guest_name || null
    })
    .eq('id', params.matchId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-populate knockout progression
  const { createAdminClient } = await import('@/lib/supabase/server')
  const { checkAndAutoPopulateKnockoutProgression } = await import('@/lib/knockoutProgression')
  const { data: fullMatch } = await supabase.from('match_schedule').select('booking_id').eq('id', params.matchId).single()
  if (fullMatch?.booking_id) {
    const admin = createAdminClient()
    await checkAndAutoPopulateKnockoutProgression(admin, fullMatch.booking_id)
  }

  return NextResponse.json({ success: true })
}
