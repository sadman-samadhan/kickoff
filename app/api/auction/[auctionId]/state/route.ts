import { NextResponse } from 'next/server'
import { AuthError, requireBookingMember } from '@/lib/groupAuth'
import { loadAuctionState } from '@/lib/auction/state'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Live auction snapshot for screens to refetch after a ping. Group members only.
export async function GET(_req: Request, { params }: { params: { auctionId: string } }) {
  const { data: a } = await createAdminClient().from('auctions').select('booking_id').eq('id', params.auctionId).maybeSingle()
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const { user, role } = await requireBookingMember(a.booking_id)
    const state = await loadAuctionState({ auctionId: params.auctionId }, { userId: user.id, isAdmin: role === 'admin' })
    if (!state) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof AuthError ? e.status : 500 })
  }
}
