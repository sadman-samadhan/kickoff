/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'

/**
 * While a matchday has an auction that isn't finalised, its teams belong to the auction:
 * manual team edits, player assignment and fixture generation are blocked.
 */
export async function assertNoOpenAuction(admin: any, bookingId: string) {
  const { data } = await admin.from('auctions').select('id, finalized_at').eq('booking_id', bookingId).maybeSingle()
  if (data && !data.finalized_at) {
    throw new Error('This matchday has an auction in progress. Finish or cancel the auction first.')
  }
}

/** An RSVP that's in an open auction's pool can't be removed mid-auction. */
export async function assertRsvpNotInOpenAuction(admin: any, rsvpId: string) {
  const { data } = await admin
    .from('auction_entries')
    .select('id, auctions!inner(finalized_at, status)')
    .eq('rsvp_id', rsvpId)
    .maybeSingle()
  const a = data?.auctions as any
  if (a && !a.finalized_at && a.status !== 'draft') {
    throw new Error('This player is in the running auction. Undo or finish the auction first.')
  }
}
