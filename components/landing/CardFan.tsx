'use client'

import { useState } from 'react'
import { MotmCard, ResultCard, StandingsCard } from '@/components/share/cards'

// Three real share cards (the same components the app exports), fanned out. Tap to bring the next one forward.

const meta = { group: 'Friday Futsal', label: 'Match 4', date: 'Fri 17 Oct', venue: 'Khulna Turf' }

const CARDS = [
  <ResultCard
    key="r"
    style="kit"
    format="post"
    data={{ meta, home: { name: 'Royals', color: '#2563eb', score: 3, scorers: ["Rafi 12' 31'", "Tanvir 27'"] }, away: { name: 'Tigers', color: '#f97316', score: 2, scorers: ["Arif 8'", "Joy 22'"] }, potm: { name: 'Rafi' } }}
  />,
  <MotmCard
    key="m"
    style="floodlight"
    format="post"
    data={{ meta, player: { name: 'Rafi', team: 'Royals', color: '#2563eb', position: 'ATT' }, stats: [{ label: 'goals', value: 2 }, { label: 'assists', value: 1 }, { label: 'points', value: 14 }], resultLine: 'Royals 3–2 Tigers' }}
  />,
  <StandingsCard
    key="s"
    style="kit"
    format="post"
    data={{
      meta,
      headline: { name: 'Royals', color: '#2563eb', label: 'Matchday champions', line: '7 pts · 2W 1D 0L · GD +3' },
      topScorer: 'Rafi Hasan (4 goals)',
      rows: [
        { name: 'Royals', color: '#2563eb', p: 3, w: 2, d: 1, l: 0, gd: 3, pts: 7 },
        { name: 'Tigers', color: '#f97316', p: 3, w: 2, d: 0, l: 1, gd: 1, pts: 6 },
        { name: 'Falcons', color: '#16a34a', p: 3, w: 1, d: 0, l: 2, gd: -1, pts: 3 },
        { name: 'Wolves', color: '#111827', p: 3, w: 0, d: 1, l: 2, gd: -3, pts: 1 },
      ],
    }}
  />,
]

const SCALE = 0.42
const W = 432 * SCALE
const H = 540 * SCALE

export function CardFan() {
  const [front, setFront] = useState(0)
  const order = [front, (front + 1) % 3, (front + 2) % 3]
  const place = [
    { x: 0, r: 0, z: 3 },
    { x: 52, r: 8, z: 2 },
    { x: -52, r: -8, z: 1 },
  ]
  return (
    <button
      type="button"
      onClick={() => setFront((f) => (f + 1) % 3)}
      className="group relative mx-auto block"
      style={{ width: W + 110, height: H + 30 }}
      aria-label="Show the next share card"
    >
      {CARDS.map((card, i) => {
        const slot = order.indexOf(i)
        const p = place[slot]
        return (
          <div
            key={i}
            className="no-dark absolute top-2 overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/10 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:[&:not(:first-child)]:scale-[1.02]"
            style={{ left: 55, width: W, height: H, zIndex: p.z, transform: `translateX(${p.x}px) rotate(${p.r}deg)` }}
          >
            <div style={{ width: 432, height: 540, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>{card}</div>
          </div>
        )
      })}
    </button>
  )
}
