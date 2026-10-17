'use client'

import { useEffect, useState } from 'react'
import { Maximize, Minimize, RotateCw, Volume2, VolumeX } from 'lucide-react'
import type { AuctionState } from '@/lib/auction/types'
import { useAuction } from '@/components/auction/useAuction'
import { useBidSound } from '@/components/auction/useBidSound'
import { derive } from '@/components/auction/derive'
import { BidList, LiveHeader, OnTheBlock, TeamsGrid } from '@/components/auction/panels'

type OrientationLock = { lock?: (o: 'landscape') => Promise<void>; unlock?: () => void }

/**
 * Big-type auction view for a TV, projector, laptop or a phone turned sideways. In landscape it is two columns
 * that fit the screen (player + bids | teams, the teams column scrolls on its own); upright it stacks and offers
 * to rotate. "Rotate" goes full screen and locks landscape where the browser allows it (Android); iPhones
 * can't be locked from a web page, so they get a hint to turn the phone instead.
 */
export default function TvScreen({ initial }: { initial: AuctionState }) {
  const sound = useBidSound()
  const [key] = useState(() => `viewer:tv-${Math.random().toString(36).slice(2, 8)}`)
  const { state, connected, stale } = useAuction(initial, {
    presenceKey: key,
    onPing: (p) => (p.kind === 'bid' ? sound.play('bid') : p.kind === 'sold' ? sound.play('sold') : undefined),
  })
  const d = derive(state)
  const [isFull, setIsFull] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(''), 5000)
    return () => clearTimeout(t)
  }, [hint])

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      setHint('Full screen isn’t available in this browser. Use the browser’s own full-screen or “Add to Home Screen”.')
    }
  }

  async function rotate() {
    const orientation = screen.orientation as unknown as OrientationLock | undefined
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      if (!orientation?.lock) throw new Error('no lock')
      await orientation.lock('landscape')
    } catch {
      setHint('Turn your phone sideways. If it doesn’t rotate, switch on auto-rotate (or turn off Portrait Lock on iPhone).')
    }
  }

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3 sm:gap-4 sm:p-4 landscape:h-dvh landscape:overflow-hidden xl:p-6">
      <LiveHeader
        state={state}
        connected={connected}
        stale={stale}
        right={
          <>
            <button onClick={sound.toggle} aria-label={sound.enabled ? 'Mute' : 'Sound on'} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ka-soft">
              {sound.enabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>
            <button onClick={rotate} aria-label="Rotate to landscape" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ka-soft landscape:hidden">
              <RotateCw className="size-5" />
            </button>
            <button onClick={toggleFull} aria-label={isFull ? 'Exit full screen' : 'Full screen'} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ka-soft">
              {isFull ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          </>
        }
      />

      {/* Upright phone: suggest turning it. */}
      <button
        type="button"
        onClick={rotate}
        className="flex items-center gap-3 rounded-2xl border border-ka-line bg-ka-surface px-4 py-3 text-left text-sm font-semibold sm:hidden landscape:hidden"
      >
        <RotateCw className="size-5 shrink-0 text-ka-primary" aria-hidden />
        <span className="flex-1">Turn your phone sideways for the full TV view</span>
        <span className="text-ka-primary">Rotate</span>
      </button>

      {hint && (
        <p role="status" className="rounded-2xl bg-ka-ink px-4 py-3 text-sm font-semibold text-ka-bg">
          {hint}
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-3 sm:gap-4 landscape:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-3 sm:gap-4 landscape:overflow-y-auto [&>*]:shrink-0">
          <OnTheBlock state={state} d={d} size="xl" />
          <BidList state={state} d={d} limit={5} />
        </div>
        <div className="min-h-0 landscape:overflow-y-auto">
          <TeamsGrid state={state} d={d} compact />
        </div>
      </div>
    </main>
  )
}
