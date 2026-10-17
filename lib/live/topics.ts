// Realtime channel names shared by the server (broadcast pings) and the client (subscribe).
export const matchTopic = (matchId: string) => `match:${matchId}`
export const matchdayTopic = (bookingId: string) => `matchday:${bookingId}`
export const LIVE_PING = 'ping'

export type MatchPing = { kind: 'event' | 'clock' | 'status'; by?: string }
