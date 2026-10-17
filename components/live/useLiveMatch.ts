'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LIVE_PING, matchTopic } from '@/lib/live/topics'
import type { LiveMatchState } from '@/lib/live/types'

/**
 * Keeps a match snapshot fresh: the server pings after every change and we refetch the full state.
 * Polling covers missed pings. `offsetMs` is (server clock − this phone's clock), so every phone shows
 * the same match time even if its clock is wrong.
 */
export function useLiveMatch(initial: LiveMatchState) {
  const [state, setState] = useState(initial)
  const [connected, setConnected] = useState(false)
  const [stale, setStale] = useState(false)
  const [offsetMs, setOffsetMs] = useState(() => initial.serverNow - Date.now())
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const matchId = initial.match.id

  const fetchNow = useCallback(async () => {
    const my = ++seq.current
    const sent = Date.now()
    try {
      const res = await fetch(`/api/match/${matchId}/state`, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const next = (await res.json()) as LiveMatchState
      if (my !== seq.current) return
      const received = Date.now()
      // Assume the server stamped serverNow halfway through the round trip.
      setOffsetMs(next.serverNow - (sent + received) / 2)
      setState(next)
      setStale(false)
    } catch {
      if (my === seq.current) setStale(true)
    }
  }, [matchId])

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(fetchNow, 150)
  }, [fetchNow])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(matchTopic(matchId), { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: LIVE_PING }, () => refresh())
      .subscribe((status: string) => {
        const ok = status === 'SUBSCRIBED'
        setConnected(ok)
        if (ok) refresh()
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, refresh])

  useEffect(() => {
    if (state.match.status === 'completed' && connected) return
    const id = setInterval(() => document.visibilityState === 'visible' && fetchNow(), connected ? 15000 : 4000)
    return () => clearInterval(id)
  }, [connected, fetchNow, state.match.status])

  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && fetchNow()
    window.addEventListener('focus', onVis)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onVis)
    return () => {
      window.removeEventListener('focus', onVis)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onVis)
    }
  }, [fetchNow])

  return { state, setState, connected, stale, offsetMs, refresh: fetchNow }
}

/** Milliseconds on the match clock in the current period, as of `now` (server time). */
export function clockMs(m: LiveMatchState['match'], serverNowMs: number) {
  const running = m.clock_running && m.clock_started_at ? Math.max(0, serverNowMs - new Date(m.clock_started_at).getTime()) : 0
  return m.clock_elapsed_ms + running
}

/** The match minute shown on events (1-based; the 2nd half continues from the half length). */
export function matchMinute(m: LiveMatchState['match'], serverNowMs: number) {
  if (m.status !== 'ongoing') return m.status === 'completed' ? m.duration_minutes || 0 : 0
  const offset = m.period === '2nd_half' ? m.half_minutes || 0 : 0
  return offset + Math.floor(clockMs(m, serverNowMs) / 60000) + 1
}
