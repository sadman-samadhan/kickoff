/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useRef, useState } from 'react'
import { Crown, Pencil, X } from 'lucide-react'
import type { LiveEvent, LiveMatch, LivePlayer, LiveTeam } from '@/lib/live/types'
import { clockMs } from './useLiveMatch'
import { kit, type Kit } from './kit'
import { byMinute, isOwnGoal, keyOf, secondKeyOf, type Tally } from './derive'

const pad = (n: number) => String(n).padStart(2, '0')

export const PERIOD_LABEL: Record<string, string> = {
  '1st_half': '1st half',
  half_time: 'Half-time',
  '2nd_half': '2nd half',
  completed: 'Full time',
}

/** Re-renders every second with the server-corrected time. Kept tiny so only the clock re-renders. */
export function useServerNow(offsetMs: number, everyMs = 1000) {
  const [now, setNow] = useState(() => Date.now() + offsetMs)
  useEffect(() => {
    setNow(Date.now() + offsetMs)
    const id = setInterval(() => setNow(Date.now() + offsetMs), everyMs)
    return () => clearInterval(id)
  }, [offsetMs, everyMs])
  return now
}

export function ClockText({ match, offsetMs, className }: { match: LiveMatch; offsetMs: number; className?: string }) {
  const now = useServerNow(offsetMs)
  if (match.status === 'scheduled') return <span className={className}>00:00</span>
  if (match.status === 'completed') return <span className={className}>FT</span>
  if (match.period === 'half_time') return <span className={className}>HT</span>
  const total = Math.floor(clockMs(match, now) / 1000) + (match.period === '2nd_half' ? (match.half_minutes || 0) * 60 : 0)
  return (
    <span className={className} aria-live="off">
      {pad(Math.floor(total / 60))}:{pad(total % 60)}
    </span>
  )
}

/** "Half-time?" / "Full time?" once the clock passes the period length. Nothing ends on its own. */
export function PeriodPrompt({ match, offsetMs, onEnd }: { match: LiveMatch; offsetMs: number; onEnd: () => void }) {
  const now = useServerNow(offsetMs, 5000)
  const [snoozedUntil, setSnoozedUntil] = useState(0)
  const half = (match.half_minutes || 0) * 60000
  if (match.status !== 'ongoing' || !half || !match.clock_running) return null
  if (match.period !== '1st_half' && match.period !== '2nd_half') return null
  const ms = clockMs(match, now)
  if (ms < half || ms < snoozedUntil) return null
  const isFullTime = match.period === '2nd_half' || match.timing_mode === 'continuous'
  return (
    <div role="status" className="mx-4 mt-3 flex items-center gap-2 rounded-2xl bg-ka-warn text-ka-on-warn px-3 py-2">
      <span className="flex-1 text-sm font-bold">{isFullTime ? 'Time’s up — full time?' : 'Time’s up — half-time?'}</span>
      <button onClick={() => setSnoozedUntil(ms + 120000)} className="h-10 px-3 rounded-xl text-sm font-bold border-2 border-current">
        Keep playing
      </button>
      <button onClick={onEnd} className="h-10 px-3 rounded-xl text-sm font-bold bg-ka-on-warn text-ka-warn">
        {isFullTime ? 'Full time' : 'Half-time'}
      </button>
    </div>
  )
}

// ── Team halves ──

function Badges({ t }: { t?: Tally }) {
  if (!t) return null
  return (
    <span className="ml-auto flex items-center gap-1 shrink-0 text-xs font-bold">
      {t.goals > 0 && <span aria-label={`${t.goals} goals`}>⚽{t.goals > 1 ? `×${t.goals}` : ''}</span>}
      {t.assists > 0 && <span aria-label={`${t.assists} assists`} className="opacity-70">A{t.assists > 1 ? `×${t.assists}` : ''}</span>}
      {t.ownGoals > 0 && <span className="opacity-70">OG</span>}
      {t.saves > 0 && <span aria-label={`${t.saves} penalty saves`}>🧤</span>}
      {t.yellow > 0 && <span aria-label="yellow card" className="inline-block w-2.5 h-3.5 rounded-[2px] bg-yellow-400" />}
      {t.red > 0 && <span aria-label="red card" className="inline-block w-2.5 h-3.5 rounded-[2px] bg-red-600" />}
    </span>
  )
}

function useLongPress(onTap: () => void, onHold: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  return {
    onPointerDown: (e: React.PointerEvent) => {
      held.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = setTimeout(() => {
        held.current = true
        timer.current = null
        if (navigator.vibrate) navigator.vibrate(20)
        onHold()
      }, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      if (held.current) return
      onTap()
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      if (held.current) return
      clear()
      held.current = true
      onHold()
    },
  }
}

function NameChip({ k, name, tally, canLog, onTap, onHold }: { k: Kit; name: string; tally?: Tally; canLog: boolean; onTap: () => void; onHold: () => void }) {
  const press = useLongPress(onTap, onHold)
  const style = { background: k.chipBg, color: k.chipInk, opacity: tally?.subbedOff ? 0.55 : 1 }
  const body = (
    <>
      <span className="truncate">{name}</span>
      <Badges t={tally} />
    </>
  )
  if (!canLog) {
    return (
      <div className="min-h-12 rounded-xl px-3 flex items-center gap-1 font-bold text-[15px]" style={style}>
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      {...press}
      aria-label={`${name}: tap for a goal, hold for more`}
      aria-haspopup="dialog"
      className="min-h-12 rounded-xl px-3 flex items-center gap-1 font-bold text-[15px] text-left select-none [-webkit-touch-callout:none] active:scale-[0.98] transition-transform"
      style={style}
    >
      {body}
    </button>
  )
}

export function TeamHalf({
  team, side, score, names, tally, canLog, onGoal, onUnknownGoal, onMore,
}: {
  team: LiveTeam
  side: 'home' | 'away'
  score: number
  names: Map<string, string>
  tally: Map<string, Tally>
  canLog: boolean
  onGoal: (key: string) => void
  onUnknownGoal: () => void
  onMore: (key: string) => void
}) {
  const k = kit(team.jersey_color, side === 'home' ? '#16a34a' : '#2563eb')
  const right = side === 'away'
  return (
    <section aria-label={team.name} className="p-3 pb-4 flex flex-col gap-2.5 min-w-0" style={{ background: k.stripes(right ? 135 : 90), color: k.ink }}>
      <div className={`ka-display text-base uppercase truncate ${right ? 'text-right' : ''}`}>{team.name}</div>
      <div className={`ka-display ka-tabular text-[88px] leading-[0.9] ${right ? 'text-right' : ''}`} aria-label={`${team.name} ${score}`}>
        {score}
      </div>
      {canLog && (
        <button
          type="button"
          onClick={onUnknownGoal}
          className="h-12 rounded-xl font-bold text-sm border-2"
          style={{ borderColor: k.ghostBorder, background: k.ghostBg, color: k.ink }}
        >
          +1 goal
        </button>
      )}
      {team.players.map((p) => (
        <NameChip
          key={p.id}
          k={k}
          name={names.get(p.id) || p.full_name}
          tally={tally.get(p.id)}
          canLog={canLog}
          onTap={() => onGoal(p.id)}
          onHold={() => onMore(p.id)}
        />
      ))}
      {team.players.length === 0 && <p className="text-sm opacity-80">No players in this team yet.</p>}
    </section>
  )
}

// ── Toast (bottom) ──

export function Toast({ color, children, onClose }: { color?: string; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-2xl bg-ka-ink text-ka-bg px-3 py-2.5 shadow-xl">
      {color && <span className="w-2.5 self-stretch min-h-8 rounded" style={{ background: color }} aria-hidden />}
      <div className="flex-1 min-w-0">{children}</div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center opacity-70">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

/** Horizontal row of name chips (assist / scorer pickers in toasts and sheets). */
export function PickRow({ players, names, onPick, none, selected }: { players: LivePlayer[]; names: Map<string, string>; onPick: (k: string | null) => void; none?: string; selected?: string | null }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {none && (
        <button onClick={() => onPick(null)} className={`h-10 px-3 rounded-xl text-sm font-bold shrink-0 border ${selected === null ? 'bg-ka-primary text-ka-on-primary border-transparent' : 'border-ka-muted'}`}>
          {none}
        </button>
      )}
      {players.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p.id)}
          className={`h-10 px-3 rounded-xl text-sm font-bold shrink-0 border ${selected === p.id ? 'bg-ka-primary text-ka-on-primary border-transparent' : 'border-ka-muted'}`}
        >
          {names.get(p.id) || p.full_name}
        </button>
      ))}
    </div>
  )
}

// ── Bottom sheet ──

export function Sheet({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/55" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-ka-surface text-ka-ink border-t border-ka-line px-4 pt-3 pb-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-ka-line self-center" aria-hidden />
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">{title}</div>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full hover:bg-ka-soft flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Timeline ──

export function eventLabel(e: LiveEvent) {
  if (e.event_type === 'goal') return isOwnGoal(e) ? 'Own goal' : 'Goal'
  if (e.event_type === 'card') return e.details_json?.card_type === 'red' ? 'Red card' : 'Yellow card'
  if (e.event_type === 'sub') return 'Sub'
  return 'Penalty save'
}

function EventIcon({ e }: { e: LiveEvent }) {
  if (e.event_type === 'card') return <span className={`inline-block w-3 h-4 rounded-[2px] ${e.details_json?.card_type === 'red' ? 'bg-red-600' : 'bg-yellow-400'}`} aria-hidden />
  return <span aria-hidden>{e.event_type === 'goal' ? '⚽' : e.event_type === 'sub' ? '🔄' : '🧤'}</span>
}

export function Timeline({
  events, home, away, nameOf, canLog, onEdit,
}: {
  events: LiveEvent[]
  home: LiveTeam | null
  away: LiveTeam | null
  nameOf: (k: string | null) => string | null
  canLog: boolean
  onEdit: (id: string) => void
}) {
  if (events.length === 0) return <p className="text-sm text-ka-muted text-center py-8">Nothing logged yet.</p>
  const colorOf = (teamId: string | null) => kit(teamId === home?.id ? home?.jersey_color : away?.jersey_color).base
  return (
    <ol className="flex flex-col gap-2">
      {[...events].sort(byMinute).reverse().map((e) => {
        const who = nameOf(keyOf(e))
        const second = nameOf(secondKeyOf(e))
        const detail =
          e.event_type === 'sub'
            ? `${who || '?'} off · ${second || '?'} on`
            : e.event_type === 'goal'
              ? `${who || 'Unknown scorer'}${second && !isOwnGoal(e) ? ` (assist ${second})` : ''}`
              : who || 'Player'
        const row = (
          <>
            <span className="w-1.5 self-stretch rounded ring-1 ring-black/10" style={{ background: colorOf(e.team_id) }} aria-hidden />
            <span className="ka-tabular font-bold w-9 text-ka-muted">{e.minute}&apos;</span>
            <EventIcon e={e} />
            <span className="flex-1 min-w-0">
              <span className="font-bold">{eventLabel(e)}</span> <span className="text-ka-muted truncate">· {detail}</span>
              {e.pending && <span className="ml-1 text-xs text-ka-muted">(saving…)</span>}
            </span>
            {canLog && <Pencil className="w-4 h-4 text-ka-muted shrink-0" aria-hidden />}
          </>
        )
        return (
          <li key={e.id}>
            {canLog ? (
              <button onClick={() => onEdit(e.id)} className="w-full min-h-12 flex items-center gap-2.5 rounded-2xl bg-ka-surface border border-ka-line px-3 py-2 text-left text-sm" aria-label={`Edit ${eventLabel(e)} ${e.minute}'`}>
                {row}
              </button>
            ) : (
              <div className="min-h-12 flex items-center gap-2.5 rounded-2xl bg-ka-surface border border-ka-line px-3 py-2 text-sm">{row}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ── Lineup / minutes / MVP ──

export function TeamHeading({ team }: { team: LiveTeam }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold">
      <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: kit(team.jersey_color).base }} aria-hidden />
      {team.name}
    </div>
  )
}

export function LineupTab({ teams, starters, canLog, onToggle }: { teams: LiveTeam[]; starters: Set<string>; canLog: boolean; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ka-muted">Who started on the pitch. Everyone else starts on the bench; subs then count their minutes.</p>
      {teams.map((t) => (
        <div key={t.id} className="flex flex-col gap-2">
          <TeamHeading team={t} />
          <div className="flex flex-wrap gap-2">
            {t.players.map((p) => {
              const on = starters.has(p.id)
              return (
                <button
                  key={p.id}
                  disabled={!canLog}
                  onClick={() => onToggle(p.id)}
                  aria-pressed={on}
                  className={`min-h-11 px-3 rounded-xl text-sm font-bold border ${on ? 'bg-ka-primary text-ka-on-primary border-transparent' : 'bg-ka-surface border-ka-line text-ka-muted'}`}
                >
                  {p.full_name} <span className="text-xs font-semibold opacity-80">· {on ? 'Starter' : 'Bench'}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function MinutesTab({ teams, minutes, conceded }: { teams: LiveTeam[]; minutes: Record<string, number>; conceded: Record<string, number> }) {
  return (
    <div className="flex flex-col gap-4">
      {teams.map((t) => (
        <div key={t.id} className="flex flex-col gap-1.5">
          <TeamHeading team={t} />
          {t.players.map((p) => (
            <div key={p.id} className="min-h-11 flex items-center gap-3 rounded-xl bg-ka-surface border border-ka-line px-3 text-sm">
              <span className="flex-1 truncate font-semibold">{p.full_name}</span>
              <span className="ka-tabular font-bold">{minutes[p.id] || 0} min</span>
              <span className="ka-tabular text-xs font-bold text-ka-danger w-12 text-right">{conceded[p.id] || 0} GC</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function MvpPicker({ teams, selected, busy, onPick }: { teams: LiveTeam[]; selected: string | null; busy: boolean; onPick: (k: string | null) => void }) {
  return (
    <section className="rounded-3xl border border-ka-line bg-ka-surface p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-ka-warn" />
        <h3 className="ka-display text-lg flex-1">Player of the match</h3>
        {selected && (
          <button disabled={busy} onClick={() => onPick(null)} className="h-9 px-3 rounded-lg text-sm font-bold text-ka-danger border border-ka-line">
            Clear
          </button>
        )}
      </div>
      {teams.map((t) => (
        <div key={t.id} className="flex flex-col gap-1.5">
          <TeamHeading team={t} />
          <div className="flex flex-wrap gap-1.5">
            {t.players.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => onPick(p.id)}
                aria-pressed={selected === p.id}
                className={`min-h-11 px-3 rounded-xl text-sm font-bold border ${selected === p.id ? 'bg-ka-warn text-ka-on-warn border-transparent' : 'border-ka-line'}`}
              >
                {p.full_name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
