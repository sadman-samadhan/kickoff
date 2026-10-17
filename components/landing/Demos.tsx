'use client'

import { useEffect, useRef, useState } from 'react'
import { Gavel, Moon, Shuffle, Sun, UserPlus } from 'lucide-react'
import { kit } from '@/components/live/kit'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

// Small working demos for the landing page. Names and numbers are made up for the demo, and look it.

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── RSVP: spots fill, then a waitlist ──

const SQUAD = ['RH', 'TA', 'SB', 'NK', 'AR', 'MH', 'JY', 'SH', 'LB', 'AN', 'RT', 'JW', 'MD']

export function RsvpDemo() {
  const [inCount, setInCount] = useState(13)
  const [me, setMe] = useState(false)
  const spots = 14
  const full = inCount >= spots
  function toggle() {
    if (me) {
      setMe(false)
      setInCount((n) => n - 1)
    } else if (!full) {
      setMe(true)
      setInCount((n) => n + 1)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl font-extrabold tabular">{inCount}</span>
        <span className="text-sm text-app-muted">of {spots} spots filled</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-app-soft">
        <div className="h-full rounded-full bg-app-primary transition-[width] duration-500" style={{ width: `${(inCount / spots) * 100}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Who's in">
        {SQUAD.map((s) => (
          <span key={s} className="flex h-8 w-8 items-center justify-center rounded-full bg-app-soft text-[11px] font-bold text-app-muted">
            {s}
          </span>
        ))}
        {me && <span className="flex h-8 w-8 animate-in zoom-in-95 fade-in items-center justify-center rounded-full bg-app-primary text-[11px] font-bold text-app-on-primary">You</span>}
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={me}
        className={cn(
          'h-12 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2',
          me ? 'bg-app-soft text-app-ink border border-app-line' : 'bg-app-primary text-app-on-primary',
        )}
      >
        <UserPlus className="h-4 w-4" aria-hidden /> {me ? "I'm in · tap to drop out" : "I'm in"}
      </button>
      <p className="text-xs text-app-muted">{full ? 'Full. The next person goes on the waitlist and gets in when someone drops.' : `${spots - inCount} spot left`}</p>
    </div>
  )
}

// ── Balanced teams: players fly into two even teams ──

const POOL = [
  { n: 'Rafi', s: 9 }, { n: 'Arif', s: 8 }, { n: 'Mahin', s: 7 }, { n: 'Tanvir', s: 7 }, { n: 'Joy', s: 6 },
  { n: 'Sabbir', s: 6 }, { n: 'Shuvo', s: 5 }, { n: 'Nayeem', s: 5 }, { n: 'Labib', s: 4 }, { n: 'Anan', s: 3 },
]

function balance(seed: number) {
  // snake draft with a little jitter, like the real balancer's starting point
  const order = [...POOL].map((p, i) => ({ ...p, k: p.s + (((seed * 9301 + i * 49297) % 233280) / 233280 - 0.5) * 1.6 })).sort((a, b) => b.k - a.k)
  const teams: Record<string, 0 | 1> = {}
  order.forEach((p, i) => {
    const round = Math.floor(i / 2)
    teams[p.n] = (round % 2 === 0 ? i % 2 : 1 - (i % 2)) as 0 | 1
  })
  return teams
}

export function TeamsDemo() {
  const [seed, setSeed] = useState(0)
  const [split, setSplit] = useState(false)
  const teams = balance(seed)
  const sums = [0, 1].map((t) => POOL.filter((p) => teams[p.n] === t).reduce((a, p) => a + p.s, 0))
  const pct = Math.round((sums[0] / (sums[0] + sums[1])) * 100)
  const colors = [kit('#16a34a'), kit('#f8fafc')]
  const ROW = 34

  return (
    <div className="flex flex-col gap-4">
      <div className="relative" style={{ height: ROW * 5 + 30 }} aria-live="polite">
        <div className="absolute left-0 right-1/2 top-0 pr-1.5 text-center text-xs font-bold text-app-muted">{split ? 'Greens' : 'Everyone'}</div>
        <div className="absolute left-1/2 right-0 top-0 pl-1.5 text-center text-xs font-bold text-app-muted">{split ? 'Whites' : ''}</div>
        {POOL.map((p, i) => {
          const t = split ? teams[p.n] : (i % 2) as 0 | 1
          const idx = split ? POOL.filter((q) => teams[q.n] === t).indexOf(p) : Math.floor(i / 2)
          const k = split ? colors[t] : null
          return (
            <div
              key={p.n}
              className="absolute flex h-[30px] items-center gap-2 rounded-xl border px-2.5 text-sm font-semibold transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{
                width: 'calc(50% - 6px)',
                left: t === 0 ? 0 : 'calc(50% + 6px)',
                top: 22 + idx * ROW,
                background: k ? k.base : undefined,
                color: k ? k.ink : undefined,
                borderColor: k ? (k.isLight ? '#d4d4d4' : 'transparent') : undefined,
              }}
            >
              <span className="flex-1 truncate">{p.n}</span>
              <span className="text-[10px] tracking-tighter opacity-80" aria-label={`strength ${p.s}`}>{'●'.repeat(Math.ceil(p.s / 2))}</span>
            </div>
          )
        })}
      </div>
      {split && (
        <div className="flex flex-col gap-1">
          <div className="flex h-2 overflow-hidden rounded-full bg-app-soft">
            <div className="bg-app-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-app-muted">Strength {pct}% vs {100 - pct}%: as even as these ten get.</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          if (split) setSeed((s) => s + 1)
          setSplit(true)
        }}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-app-ink font-bold text-app-bg"
      >
        <Shuffle className="h-4 w-4" aria-hidden /> {split ? 'Shuffle again' : 'Make balanced teams'}
      </button>
    </div>
  )
}

// ── Auction: bid against a rival captain, then SOLD ──

const LOTS = [
  { name: 'Labib', tier: 'Apex', color: '#f59e0b', pos: 'ATT' },
  { name: 'Mahin', tier: 'Prestige', color: '#0ea5e9', pos: 'MID' },
  { name: 'Joy', tier: 'Dominion', color: '#8b5cf6', pos: 'DEF' },
]

export function AuctionDemo() {
  const [lot, setLot] = useState(0)
  const [price, setPrice] = useState(100)
  const [leader, setLeader] = useState<'you' | 'rival' | null>(null)
  const [stage, setStage] = useState<'open' | 'once' | 'twice' | 'sold'>('open')
  const [budget, setBudget] = useState(8000)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clear, [])

  function goingGone(by: 'you' | 'rival', at: number) {
    clear()
    setStage('open')
    timers.current.push(setTimeout(() => setStage('once'), 1300))
    timers.current.push(setTimeout(() => setStage('twice'), 2300))
    timers.current.push(
      setTimeout(() => {
        setStage('sold')
        if (by === 'you') setBudget((b) => b - at)
      }, 3300),
    )
  }

  function bid() {
    if (stage === 'sold') return
    const p = leader ? price + 50 : price
    setPrice(p)
    setLeader('you')
    goingGone('you', p)
    // the rival sometimes comes back over the top
    if (p < 450 && Math.random() < 0.7) {
      timers.current.push(
        setTimeout(() => {
          const rp = p + 50
          setPrice(rp)
          setLeader('rival')
          goingGone('rival', rp)
        }, 900),
      )
    }
  }

  function next() {
    clear()
    setLot((l) => (l + 1) % LOTS.length)
    setPrice(100)
    setLeader(null)
    setStage('open')
  }

  const L = LOTS[lot]
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-app-line bg-app-soft p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full text-base font-extrabold text-white" style={{ background: L.color }}>
            {L.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl font-extrabold leading-none">{L.name}</div>
            <div className="mt-1 flex gap-1.5 text-xs font-bold">
              <span className="rounded-md px-1.5 py-0.5 text-white" style={{ background: L.color }}>{L.tier}</span>
              <span className="rounded-md bg-app-surface px-1.5 py-0.5 text-app-muted">{L.pos}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-extrabold tabular leading-none" aria-live="polite">{price.toLocaleString()}</div>
            <div className="text-xs text-app-muted">{leader === 'you' ? 'You lead' : leader === 'rival' ? 'Wolves lead' : 'Opening bid'}</div>
          </div>
        </div>
        <div className="mt-3 h-5 text-sm font-bold text-app-muted" aria-live="polite">
          {stage === 'once' ? 'Going once…' : stage === 'twice' ? 'Going twice…' : ''}
        </div>
        {stage === 'sold' && (
          <span className="absolute right-4 top-3 rotate-[-12deg] animate-in zoom-in-95 fade-in rounded-lg border-4 border-app-primary px-2 font-display text-3xl font-extrabold text-app-primary">
            SOLD
          </span>
        )}
      </div>
      {stage === 'sold' ? (
        <button type="button" onClick={next} className="h-12 rounded-2xl border border-app-line bg-app-surface font-bold">
          {leader === 'you' ? `${L.name} joins your team. Next player` : `Wolves got ${L.name}. Next player`}
        </button>
      ) : (
        <button type="button" onClick={bid} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-app-primary font-bold text-app-on-primary">
          <Gavel className="h-4 w-4" aria-hidden /> {leader ? `Bid ${(price + 50).toLocaleString()}` : `Bid ${price}`}
        </button>
      )}
      <p className="text-xs text-app-muted">Your budget: {budget.toLocaleString()} · steps of 50</p>
    </div>
  )
}

// ── Stats: a leaderboard that counts up when it scrolls into view ──

const BOARD = [
  { n: 'Rafi Hasan', g: 14, a: 6, p: 92 },
  { n: 'Arif Khan', g: 9, a: 11, p: 81 },
  { n: 'Mahin Ali', g: 7, a: 4, p: 64 },
  { n: 'Tanvir Ahmed', g: 3, a: 9, p: 58 },
]

export function StatsDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [t, setT] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced()) return setT(1)
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / 1200)
        setT(1 - (1 - k) ** 3)
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    })
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <div ref={ref} className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[1fr_40px_40px_48px] gap-2 px-3 text-[11px] font-bold uppercase tracking-wide text-app-muted">
        <span>Player</span><span className="text-right">G</span><span className="text-right">A</span><span className="text-right">Pts</span>
      </div>
      {BOARD.map((r, i) => (
        <div key={r.n} className={cn('grid grid-cols-[1fr_40px_40px_48px] items-center gap-2 rounded-xl px-3 py-2 text-sm', i === 0 ? 'bg-app-primary text-app-on-primary' : 'bg-app-soft')}>
          <span className="truncate font-semibold">{i + 1}. {r.n}</span>
          <span className="text-right tabular">{Math.round(r.g * t)}</span>
          <span className="text-right tabular">{Math.round(r.a * t)}</span>
          <span className="text-right font-display text-lg font-extrabold tabular">{Math.round(r.p * t)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Night mode: flips the whole page ──

export function NightSwitch() {
  const { resolved, setChoice } = useTheme()
  const dark = resolved === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={() => setChoice(dark ? 'light' : 'dark')}
      className="flex h-14 w-full items-center gap-3 rounded-2xl border border-app-line bg-app-surface px-4 text-left font-bold"
    >
      <span className={cn('relative h-8 w-14 rounded-full transition-colors', dark ? 'bg-app-primary' : 'bg-app-soft')}>
        <span className={cn('absolute top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#14211a] shadow transition-transform duration-300', dark ? 'translate-x-7' : 'translate-x-1')}>
          {dark ? <Moon className="h-3.5 w-3.5" aria-hidden /> : <Sun className="h-3.5 w-3.5" aria-hidden />}
        </span>
      </span>
      {dark ? 'Floodlights on' : 'Switch the floodlights on'}
    </button>
  )
}
