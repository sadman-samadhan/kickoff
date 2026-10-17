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

/**
 * Why a player can't drop out of this matchday right now, or null. While an auction is running (started, not
 * finalised), players in its pool and team captains are committed: dropping out would leave a sold player or a
 * captain in a team they're not playing for.
 */
export async function auctionDropOutBlock(admin: any, bookingId: string, rsvpId: string | null, playerId: string | null) {
  const { data: a } = await admin.from('auctions').select('id, status, finalized_at').eq('booking_id', bookingId).maybeSingle()
  if (!a || a.finalized_at || a.status === 'draft') return null
  const [{ data: entry }, { data: captainOf }] = await Promise.all([
    rsvpId ? admin.from('auction_entries').select('id').eq('auction_id', a.id).eq('rsvp_id', rsvpId).maybeSingle() : Promise.resolve({ data: null }),
    playerId
      ? admin.from('auction_teams').select('team_id, teams!inner(captain_id)').eq('auction_id', a.id).eq('teams.captain_id', playerId).limit(1)
      : Promise.resolve({ data: [] }),
  ])
  if (entry) return 'The player auction is running and you are in it. Ask an admin to sort it out.'
  if (captainOf?.length) return 'You are a captain in the running auction. Ask an admin to change captains first.'
  return null
}
