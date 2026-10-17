import 'server-only'
import { LIVE_PING, matchdayTopic, matchTopic, type MatchPing } from './topics'

/**
 * Pings every open scoring screen for this match and every open matchday page, via Supabase Realtime's REST
 * broadcast (works from serverless functions). Screens refetch through the API, which applies access rules,
 * and also poll, so a missed ping only delays an update.
 */
export async function notifyMatch(matchId: string, bookingId: string, payload: MatchPing) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [matchTopic(matchId), matchdayTopic(bookingId)].map((topic) => ({ topic, event: LIVE_PING, payload, private: false })),
      }),
      cache: 'no-store',
    })
  } catch {
    // polling covers it
  }
}
