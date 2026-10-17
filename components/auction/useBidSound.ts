'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Short beeps for new bids and sales. Off by default (browsers need a tap before playing sound). */
export function useBidSound() {
  const [enabled, setEnabled] = useState(false)
  const ctx = useRef<AudioContext | null>(null)

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem('khelahobe-auction-sound') === '1')
    } catch {}
  }, [])

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on
      try {
        localStorage.setItem('khelahobe-auction-sound', next ? '1' : '0')
      } catch {}
      if (next && !ctx.current) ctx.current = new AudioContext()
      return next
    })
  }, [])

  const play = useCallback(
    (kind: 'bid' | 'sold') => {
      if (!enabled) return
      if (!ctx.current) ctx.current = new AudioContext()
      const ac = ctx.current
      const notes = kind === 'bid' ? [880] : [660, 880, 1320]
      notes.forEach((f, i) => {
        const o = ac.createOscillator()
        const g = ac.createGain()
        o.frequency.value = f
        o.type = 'triangle'
        const t0 = ac.currentTime + i * 0.12
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18)
        o.connect(g).connect(ac.destination)
        o.start(t0)
        o.stop(t0 + 0.2)
      })
      if (kind === 'sold' && 'vibrate' in navigator) navigator.vibrate?.(120)
    },
    [enabled],
  )

  return { enabled, toggle, play }
}
