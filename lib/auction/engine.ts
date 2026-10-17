import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { auctionTopic, PING_EVENT } from './realtime'
import type { AuctionPing } from './types'

/**
 * Tells every open auction screen that something changed, via Supabase Realtime's REST broadcast
 * (works from serverless functions). Screens then refetch the state through the API, which applies
 * access rules. Screens also poll, so a missed ping only delays an update.
 */
export async function notifyAuction(auctionId: string, payload: AuctionPing = { kind: 'changed' }) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: auctionTopic(auctionId), event: PING_EVENT, payload, private: false }] }),
      cache: 'no-store',
    })
  } catch {
    // polling covers it
  }
}

/** Calls an engine function; the Postgres exception text becomes the user-facing error. */
export async function callAuctionEngine<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createAdminClient().rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}
