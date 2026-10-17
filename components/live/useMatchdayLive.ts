'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LIVE_PING, matchdayTopic } from '@/lib/live/topics'

/**
 * Re-renders the matchday page when any of its fixtures changes (goal, clock, full time), so the Fixture
 * list shows live scores. Listens only while fixtures are still to be finished, and batches bursts of pings.
 * `renderedAt` is when the server rendered the page: a cached copy (e.g. after Back from the scoring
 * screen) is refreshed once on arrival.
 */
export function useMatchdayLive(bookingId: string, active: boolean, renderedAt: number) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) return
    const refresh = (delay = 1200) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => router.refresh(), delay)
    }
    if (Date.now() - renderedAt > 10000) refresh(0)
    const supabase = createClient()
    const channel = supabase.channel(matchdayTopic(bookingId)).on('broadcast', { event: LIVE_PING }, () => refresh()).subscribe()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [active, bookingId, renderedAt, router])
}
