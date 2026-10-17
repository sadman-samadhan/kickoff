'use client'

import { useState } from 'react'
import { Maximize, Volume2, VolumeX } from 'lucide-react'
import type { AuctionState } from '@/lib/auction/types'
import { useAuction } from '@/components/auction/useAuction'
import { useBidSound } from '@/components/auction/useBidSound'
import { derive } from '@/components/auction/derive'
import { BidList, LiveHeader, OnTheBlock, TeamsGrid } from '@/components/auction/panels'

export default function TvScreen({ initial }: { initial: AuctionState }) {
  const sound = useBidSound()
  const [key] = useState(() => `viewer:tv-${Math.random().toString(36).slice(2, 8)}`)
  const { state, connected, stale } = useAuction(initial, {
    presenceKey: key,
    onPing: (p) => (p.kind === 'bid' ? sound.play('bid') : p.kind === 'sold' ? sound.play('sold') : undefined),
  })
  const d = derive(state)
  return (
    <main className="flex min-h-dvh flex-col gap-4 p-4 xl:p-6">
      <LiveHeader
        state={state}
        connected={connected}
        stale={stale}
        right={
          <>
            <button onClick={sound.toggle} aria-label={sound.enabled ? 'Mute' : 'Sound on'} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ka-soft">
              {sound.enabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>
            <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} aria-label="Full screen" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ka-soft">
              <Maximize className="size-5" />
            </button>
          </>
        }
      />
      <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <OnTheBlock state={state} d={d} size="xl" />
          <BidList state={state} d={d} limit={5} />
        </div>
        <TeamsGrid state={state} d={d} compact />
      </div>
    </main>
  )
}
