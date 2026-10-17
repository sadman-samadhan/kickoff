import { NextResponse } from 'next/server'
import { AuthError, requireBookingMember } from '@/lib/groupAuth'
import { loadLiveMatch } from '@/lib/live/state'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Live match snapshot for scoring screens to refetch after a ping. Group members only.
export async function GET(_req: Request, { params }: { params: { matchId: string } }) {
  const { data: m } = await createAdminClient().from('match_schedule').select('booking_id').eq('id', params.matchId).maybeSingle()
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    await requireBookingMember(m.booking_id)
    const state = await loadLiveMatch(params.matchId)
    if (!state) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof AuthError ? e.status : 500 })
  }
}
