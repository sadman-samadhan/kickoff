// Realtime channel names shared by the server (broadcast pings) and the client (subscribe).
export const matchTopic = (matchId: string) => `match:${matchId}`
export const matchdayTopic = (bookingId: string) => `matchday:${bookingId}`
export const LIVE_PING = 'ping'

/** Public channel: pings say only what kind of thing changed; screens refetch through the members-only API. */
export type MatchPing = { kind: 'event' | 'clock' | 'status' }
