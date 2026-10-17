'use client'

import { useEffect, useRef, useState } from 'react'
import { kit } from '@/components/live/kit'

// The hero's hook: a working mini version of the live scoring screen. It plays a few goals by itself until the
// visitor taps a name, then it's theirs to score.

type Side = 'home' | 'away'
const TEAMS = {
  home: { name: 'Royals', color: '#2563eb', players: ['Rafi', 'Tanvir', 'Sabbir', 'Nayeem'] },
  away: { name: 'Tigers', color: '#f97316', players: ['Arif', 'Mahin', 'Joy', 'Shuvo'] },
} as const

type Goal = { id: number; side: Side; name: string; minute: number }

export function LiveScoreDemo() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [seconds, setSeconds] = useState(23 * 60 + 14)
  const [pop, setPop] = useState<Side | null>(null)
  const [toast, setToast] = useState<Goal | null>(null)
  const touched = useRef(false)
  const nextId = useRef(1)
  const secondsRef = useRef(seconds)
  secondsRef.current = seconds

  const score = (side: Side) => goals.filter((g) => g.side === side).length

  function addGoal(side: Side, name: string) {
    const g: Goal = { id: nextId.current++, side, name, minute: Math.floor(secondsRef.current / 60) + 1 }
    setGoals((gs) => (gs.length >= 9 ? [g] : [...gs, g]))
    setToast(g)
    setPop(side)
    setTimeout(() => setPop(null), 450)
  }

  function tap(side: Side, name: string) {
    touched.current = true
    addGoal(side, name)
  }

  function undo() {
    if (!toast) return
    setGoals((gs) => gs.filter((g) => g.id !== toast.id))
    setToast(null)
  }

  // shared clock
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // autoplay until the visitor takes over
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let n = 0
    const t = setInterval(() => {
      if (touched.current || n >= 3) return clearInterval(t)
      n++
      const side: Side = Math.random() < 0.5 ? 'home' : 'away'
      const ps = TEAMS[side].players
      addGoal(side, ps[Math.floor(Math.random() * ps.length)])
    }, 2600)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      {/* glow */}
      <div className="absolute -inset-8 rounded-[48px] bg-[radial-gradient(closest-side,rgba(34,197,94,0.28),transparent)] dark:bg-[radial-gradient(closest-side,rgba(74,222,128,0.22),transparent)]" aria-hidden />
      <div className="no-dark relative rounded-[40px] bg-[#111111] p-2.5 shadow-2xl ring-1 ring-black/10">
        <div className="overflow-hidden rounded-[32px] bg-[#111111] text-white">
          {/* header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <span className="flex items-center gap-1.5 rounded-full bg-[#dc2626] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden /> Live
            </span>
            <div className="text-center">
              <div className="font-[family-name:var(--font-ka-archivo)] text-2xl font-extrabold tabular leading-none" aria-label={`Clock ${mm}:${ss}`}>
                {mm}:{ss}
              </div>
              <div className="text-[10px] text-white/60">2nd half · all phones in sync</div>
            </div>
            <span className="w-11" aria-hidden />
          </div>
          {/* halves */}
          <div className="grid grid-cols-2">
            {(['home', 'away'] as const).map((side) => {
              const t = TEAMS[side]
              const k = kit(t.color)
              return (
                <div key={side} className="flex min-w-0 flex-col gap-2 p-3 pb-4" style={{ background: k.stripes(side === 'home' ? 90 : 135), color: k.ink }}>
                  <div className={`text-xs font-extrabold uppercase ${side === 'away' ? 'text-right' : ''}`}>{t.name}</div>
                  <div
                    className={`font-[family-name:var(--font-ka-archivo)] text-6xl font-extrabold leading-[0.9] tabular transition-transform duration-300 ${side === 'away' ? 'text-right' : ''} ${pop === side ? 'scale-125' : ''}`}
                    aria-live="polite"
                    aria-label={`${t.name} ${score(side)}`}
                  >
                    {score(side)}
                  </div>
                  {t.players.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => tap(side, p)}
                      className="min-h-10 rounded-xl px-3 text-left text-sm font-bold transition-transform active:scale-95"
                      style={{ background: k.chipBg, color: k.chipInk }}
                      aria-label={`Goal for ${p}`}
                    >
                      {p}
                      {goals.filter((g) => g.name === p).length > 0 && <span className="float-right text-xs">⚽{goals.filter((g) => g.name === p).length > 1 ? `×${goals.filter((g) => g.name === p).length}` : ''}</span>}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
          {/* toast */}
          <div className="h-16 px-3 py-2.5">
            {toast ? (
              <div role="status" className="flex items-center gap-2 rounded-2xl bg-[#fbfaf6] px-3 py-2 text-[#111111]">
                <span className="h-7 w-1.5 rounded" style={{ background: TEAMS[toast.side].color }} aria-hidden />
                <span className="flex-1 text-sm">
                  <b>Goal · {toast.name}</b> {toast.minute}&apos;
                </span>
                <button type="button" onClick={undo} className="h-8 rounded-lg border-2 border-[#111111] px-2.5 text-xs font-bold">
                  Undo
                </button>
              </div>
            ) : (
              <p className="pt-2 text-center text-xs text-white/60">Tap a name to score a goal</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
