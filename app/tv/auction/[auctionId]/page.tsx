import { redirect } from 'next/navigation'
import '@/app/auction.css'
import { auctionFontVars } from '@/components/auction/fonts'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser, getGroupRole } from '@/lib/groupAuth'
import { loadAuctionState } from '@/lib/auction/state'
import TvScreen from './TvScreen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Auction — TV' }

// Big-type auction view for a TV or projector at the venue (no app header or navigation).
export default async function TvAuctionPage({ params }: { params: { auctionId: string } }) {
  const user = await getAuthUser()
  if (!user) redirect(`/login`)
  const { data: a } = await createAdminClient().from('auctions').select('group_id').eq('id', params.auctionId).maybeSingle()
  if (!a) redirect('/dashboard')
  const role = await getGroupRole(a.group_id)
  if (!role) redirect('/dashboard')
  const state = await loadAuctionState({ auctionId: params.auctionId }, { userId: user.id, isAdmin: role === 'admin' })
  if (!state) redirect('/dashboard')
  return (
    <div className={`ka min-h-dvh ${auctionFontVars}`}>
      <TvScreen initial={{ ...state, myTeamId: null }} />
    </div>
  )
}
