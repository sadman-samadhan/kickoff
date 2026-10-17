'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { auctionTopic, PING_EVENT } from '@/lib/auction/realtime'
import type { AuctionPing, AuctionState } from '@/lib/auction/types'

/**
 * Keeps an auction snapshot fresh. The server broadcasts a small ping after every change and we refetch
 * the full state (access rules apply on the API). Polling covers missed pings and lost connections.
 * Presence lets the admin see which captains are online.
 */
export function useAuction(
  initial: AuctionState,
  opts: { presenceKey?: string; onPing?: (p: AuctionPing) => void } = {},
) {
  const [state, setState] = useState<AuctionState>(initial)
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState<string[]>([])
  const [stale, setStale] = useState(false)
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onPingRef = useRef(opts.onPing)
  onPingRef.current = opts.onPing
  const auctionId = initial.auction.id

  const fetchNow = useCallback(async () => {
    const my = ++seq.current
    try {
      const res = await fetch(`/api/auction/${auctionId}/state`, { cache: 'no-store' })
      if (res.status === 404) {
        // Auction was cancelled: go back to the matchday.
        window.location.reload()
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const next = (await res.json()) as AuctionState
      if (my === seq.current) {
        setState(next)
        setStale(false)
      }
    } catch {
      if (my === seq.current) setStale(true)
    }
  }, [auctionId])

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(fetchNow, 120)
  }, [fetchNow])

  const presenceKey = opts.presenceKey

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(auctionTopic(auctionId), {
      config: { broadcast: { self: false }, presence: { key: presenceKey ?? '' } },
    })
    channel
      .on('broadcast', { event: PING_EVENT }, ({ payload }: { payload: unknown }) => {
        onPingRef.current?.(payload as AuctionPing)
        refresh()
      })
      .on('presence', { event: 'sync' }, () => setOnline(Object.keys(channel.presenceState()).filter(Boolean)))
      .subscribe((status: string) => {
        const ok = status === 'SUBSCRIBED'
        setConnected(ok)
        if (ok) {
          refresh()
          if (presenceKey) channel.track({ at: Date.now() })
        }
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [auctionId, presenceKey, refresh])

  useEffect(() => {
    const id = setInterval(fetchNow, connected ? 15000 : 3000)
    return () => clearInterval(id)
  }, [connected, fetchNow])

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

  return { state, connected, stale, online, refresh: fetchNow }
}
