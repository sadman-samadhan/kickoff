'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LIVE_PING, matchdayTopic } from '@/lib/live/topics'

/**
 * Re-renders the matchday page when any of its fixtures changes (goal, clock, full time, a correction later),
 * so the Fixture list shows live scores. Bursts of pings are batched; a slow poll covers missed pings while a
 * match is live.
 *
 * `renderedAt` is a stamp the server puts on each render. If this mount shows a stamp we've already shown,
 * it's a cached copy (Back from the scoring screen), so it is refreshed once. No clock comparison, so a wrong
 * phone clock can't cause refresh loops.
 */
export function useMatchdayLive(bookingId: string, opts: { hasFixtures: boolean; live: boolean; renderedAt: number }) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { hasFixtures, live, renderedAt } = opts

  // Cached copy check: once per distinct render stamp.
  useEffect(() => {
    if (!hasFixtures) return
    const key = `kh-md-seen-${bookingId}`
    try {
      if (sessionStorage.getItem(key) === String(renderedAt)) router.refresh()
      else sessionStorage.setItem(key, String(renderedAt))
    } catch {
      // storage blocked: skip
    }
  }, [bookingId, hasFixtures, renderedAt, router])

  // One subscription per matchday (not per render, which would tear the channel down on every refresh).
  useEffect(() => {
    if (!hasFixtures) return
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => router.refresh(), 1200)
    }
    const supabase = createClient()
    const channel = supabase.channel(matchdayTopic(bookingId)).on('broadcast', { event: LIVE_PING }, refresh).subscribe()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [bookingId, hasFixtures, router])

  useEffect(() => {
    if (!live) return
    const id = setInterval(() => document.visibilityState === 'visible' && router.refresh(), 60000)
    return () => clearInterval(id)
  }, [live, router])
}
