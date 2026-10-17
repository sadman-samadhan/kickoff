'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Loader2, Minus, MoreHorizontal, Pause, Play, Plus, Share2 } from 'lucide-react'
import type { LiveEvent, LiveMatchState, LiveTeam } from '@/lib/live/types'
import { calculateMatchPlayerPitchTime } from '@/lib/tournamentScoring'
import { clockMs, matchMinute, useLiveMatch } from '@/components/live/useLiveMatch'
import { kit, shortNames } from '@/components/live/kit'
import { editedEvent, goalFor, isOwnGoal, keyFields, keyOf, mergeEvents, newId, onPitch, scoreOf, secondKeyOf, tallies } from '@/components/live/derive'
import {
  ClockText, LineupTab, MinutesTab, MvpPicker, PERIOD_LABEL, PeriodPrompt, PickRow, Sheet, TeamHalf, Timeline, Toast, eventLabel,
} from '@/components/live/LiveParts'
import { MatchShareCard } from '@/components/live/MatchShareCard'
import {
  completeMatchAction, logMatchEventAction, matchClockAction, updateMatchEventAction, updateMatchMvpAction, updateStartingLineupAction,
  voidMatchEventAction, type ClockCommand, type LogEventInput,
} from './gameActions'

type ToastState =
  | { kind: 'goal'; eventId: string; teamId: string; scorer: string | null; assist?: string | null; minute: number; ownGoal?: boolean }
  | { kind: 'logged'; eventId: string; teamId: string; text: string }
  | { kind: 'dup'; eventId: string; teamId: string; text: string }
  | { kind: 'error'; text: string }

type SheetState =
  | { kind: 'player'; key: string; teamId: string }
  | { kind: 'sub'; key: string; teamId: string }
  | { kind: 'edit'; eventId: string }
  | { kind: 'kickoff' }
  | { kind: 'fulltime' }
  | { kind: 'clock' }

type Tab = 'events' | 'lineup' | 'minutes'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Server actions throw only on network trouble (app errors come back as { ok: false }); retry those. */
async function withRetry<T extends { ok: boolean }>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  for (let i = 0; i < 4; i++) {
    try {
      return await fn()
    } catch {
      await sleep(700 * 2 ** i)
    }
  }
  return { ok: false, error: 'No connection. Check your internet and try again.' }
}

export default function LiveMatchClient({
  groupId, bookingId, initial, me, isAdmin, canLog,
}: {
  groupId: string
  bookingId: string
  initial: LiveMatchState
  me: string
  isAdmin: boolean
  canLog: boolean
}) {
  const { state, setState, stale, offsetMs, refresh } = useLiveMatch(initial)
  const { match, home, away } = state
  const matchId = match.id
  const serverNow = useCallback(() => Date.now() + offsetMs, [offsetMs])

  // ── Optimistic layer: events this phone logged / removed / edited that the server hasn't echoed yet ──
  const [pending, setPending] = useState<LiveEvent[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [overrides, setOverrides] = useState<Record<string, Partial<LiveEvent>>>({})
  const inflight = useRef(new Map<string, Promise<boolean>>())

  useEffect(() => {
    const ids = new Set(state.events.map((e) => e.id))
    setPending((p) => (p.some((e) => ids.has(e.id)) ? p.filter((e) => !ids.has(e.id)) : p))
    setHidden((h) => {
      const next = new Set(Array.from(h).filter((id) => ids.has(id) || inflight.current.has(id)))
      return next.size === h.size ? h : next
    })
  }, [state.events])

  const events = useMemo(() => mergeEvents(state.events, pending, hidden, overrides), [state.events, pending, hidden, overrides])
  const score = scoreOf(state, events)
  const tally = useMemo(() => tallies(events), [events])

  const teams = [home, away].filter(Boolean) as LiveTeam[]
  const allPlayers = useMemo(() => teams.flatMap((t) => t.players), [home, away]) // eslint-disable-line react-hooks/exhaustive-deps
  const names = useMemo(() => shortNames(allPlayers), [allPlayers])
  const fullName = (k: string | null) => (k ? allPlayers.find((p) => p.id === k)?.full_name || null : null)
  const nameOf = (k: string | null) => (k ? names.get(k) || fullName(k) || 'Player' : null)
  const teamById = (id: string | null) => (id === home?.id ? home : id === away?.id ? away : null)

  const [toast, setToast] = useState<ToastState | null>(null)
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [tab, setTab] = useState<Tab>('events')
  const [busy, setBusy] = useState(false)
  const [showShare, setShowShare] = useState(false)

  // Toasts close themselves unless they're waiting on a decision.
  useEffect(() => {
    if (!toast) return
    const ms = toast.kind === 'goal' ? 9000 : toast.kind === 'dup' ? 15000 : toast.kind === 'error' ? 6000 : 4000
    const t = setTimeout(() => setToast(null), ms)
    return () => clearTimeout(t)
  }, [toast])

  const showError = (text: string) => setToast({ kind: 'error', text })

  // ── Event actions ──

  function log(input: Omit<LogEventInput, 'id' | 'minute'>) {
    const id = newId()
    const minute = matchMinute(match, serverNow())
    const p = keyFields(input.player_key ?? null, 'primary')
    const s = keyFields(input.secondary_key ?? null, 'secondary')
    const optimistic: LiveEvent = {
      id,
      match_schedule_id: matchId,
      event_type: input.event_type,
      team_id: input.team_id,
      player_id: p.id,
      secondary_player_id: s.id,
      minute,
      details_json: {
        ...p.details,
        ...s.details,
        ...(input.event_type === 'goal' ? { is_own_goal: !!input.is_own_goal } : {}),
        ...(input.event_type === 'card' ? { card_type: input.card_type } : {}),
      },
      created_at: new Date().toISOString(),
      created_by: me,
      pending: true,
    }
    setPending((x) => [...x, optimistic])
    const promise = withRetry(() => logMatchEventAction(matchId, bookingId, groupId, { ...input, id, minute })).then((r) => {
      inflight.current.delete(id)
      if (!r.ok) {
        setPending((x) => x.filter((e) => e.id !== id))
        showError(r.error)
        return false
      }
      if (r.duplicate) {
        const who = r.duplicate.by ? r.duplicate.by.split(' ')[0] : 'Someone'
        setToast({ kind: 'dup', eventId: id, teamId: input.team_id, text: `${who} logged the same ${eventLabel(optimistic).toLowerCase()} ${r.duplicate.secondsAgo}s ago. Keep both?` })
      }
      refresh()
      return true
    })
    inflight.current.set(id, promise)
    return { id, minute }
  }

  async function voidEvent(id: string) {
    setHidden((h) => new Set(h).add(id))
    if (inflight.current.has(id) && !(await inflight.current.get(id))) return
    const r = await withRetry(() => voidMatchEventAction(matchId, bookingId, groupId, id))
    if (!r.ok) {
      setHidden((h) => {
        const n = new Set(h)
        n.delete(id)
        return n
      })
      showError(r.error)
    }
    refresh()
  }

  async function editEvent(id: string, scorer: string | null, assist: string | null, minute: number, extra: { is_own_goal?: boolean; card_type?: 'yellow' | 'red' } = {}) {
    const e = events.find((x) => x.id === id)
    if (!e) return
    setOverrides((o) => ({ ...o, [id]: editedEvent(e, scorer, assist, minute, extra) }))
    if (inflight.current.has(id) && !(await inflight.current.get(id))) return
    const r = await withRetry(() => updateMatchEventAction(matchId, bookingId, groupId, id, { player_key: scorer, secondary_key: assist, minute, ...extra }))
    if (!r.ok) showError(r.error)
    await refresh()
    setOverrides((o) => {
      const n = { ...o }
      delete n[id]
      return n
    })
  }

  function goal(teamId: string, key: string | null, ownGoal = false) {
    const { id, minute } = log({ event_type: 'goal', team_id: teamId, player_key: key, is_own_goal: ownGoal })
    setToast({ kind: 'goal', eventId: id, teamId, scorer: key, minute, ownGoal })
  }

  function quick(type: 'card' | 'penalty_save', teamId: string, key: string, card?: 'yellow' | 'red') {
    const { id } = log({ event_type: type, team_id: teamId, player_key: key, card_type: card })
    const label = type === 'penalty_save' ? 'Penalty save' : card === 'red' ? 'Red card' : 'Yellow card'
    setToast({ kind: 'logged', eventId: id, teamId, text: `${label} · ${nameOf(key)}` })
  }

  function sub(teamId: string, offKey: string, onKey: string) {
    const { id } = log({ event_type: 'sub', team_id: teamId, player_key: offKey, secondary_key: onKey })
    setToast({ kind: 'logged', eventId: id, teamId, text: `Sub · ${nameOf(offKey)} off, ${nameOf(onKey)} on` })
  }

  // ── Clock ──

  async function clock(c: ClockCommand) {
    const now = serverNow()
    // Pause / resume feel instant; the server confirms right after.
    if (c.cmd === 'pause' || c.cmd === 'resume') {
      setState((s) => ({
        ...s,
        match:
          c.cmd === 'pause'
            ? { ...s.match, clock_running: false, clock_started_at: null, clock_elapsed_ms: clockMs(s.match, now) }
            : { ...s.match, clock_running: true, clock_started_at: new Date(now).toISOString() },
      }))
    }
    setBusy(true)
    const r = await withRetry(() => matchClockAction(matchId, bookingId, groupId, c))
    setBusy(false)
    if (!r.ok) showError(r.error)
    refresh()
  }

  async function fullTime() {
    setBusy(true)
    // Let any goal still being saved land first, so the final score includes it.
    await Promise.all(Array.from(inflight.current.values()))
    const r = await withRetry(() => completeMatchAction(matchId, bookingId, groupId))
    setBusy(false)
    setSheet(null)
    if (!r.ok) return showError(r.error)
    refresh()
  }

  function endPeriod() {
    if (match.period === '1st_half' && match.timing_mode === 'halves') clock({ cmd: 'half_time' })
    else setSheet({ kind: 'fulltime' })
  }

  // ── Lineup & MVP ──

  const [starters, setStarters] = useState<Set<string>>(() => new Set(match.starting_player_ids ?? allPlayers.map((p) => p.id)))
  useEffect(() => {
    setStarters(new Set(match.starting_player_ids ?? allPlayers.map((p) => p.id)))
  }, [match.starting_player_ids, allPlayers])

  async function toggleStarter(id: string) {
    const next = new Set(starters)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setStarters(next)
    const r = await withRetry(() => updateStartingLineupAction(matchId, bookingId, groupId, Array.from(next)))
    if (!r.ok) showError(r.error)
  }

  const mvpKey = match.mvp_player_id || (match.motm_guest_name ? allPlayers.find((p) => p.is_guest && p.full_name === match.motm_guest_name)?.id || null : null)
  const [mvpBusy, setMvpBusy] = useState(false)
  async function pickMvp(k: string | null) {
    setMvpBusy(true)
    const r = await withRetry(() => updateMatchMvpAction(matchId, bookingId, groupId, k === mvpKey ? null : k))
    setMvpBusy(false)
    if (!r.ok) showError(r.error)
    refresh()
  }

  const pitch = useMemo(
    () =>
      calculateMatchPlayerPitchTime(
        events,
        match.duration_minutes || 30,
        home?.players.map((p) => p.id) || [],
        away?.players.map((p) => p.id) || [],
        Array.from(starters),
        home?.id,
      ),
    [events, match.duration_minutes, home, away, starters],
  )

  // ── Render ──

  const ongoing = match.status === 'ongoing'
  const finished = match.status === 'completed'
  const inHalf = ongoing && (match.period === '1st_half' || match.period === '2nd_half')
  const subtitle = [finished ? 'Full time' : ongoing ? PERIOD_LABEL[match.period || ''] || 'Live' : 'Not started', match.match_number ? `Match ${match.match_number}` : null, match.stage_name]
    .filter(Boolean)
    .join(' · ')

  const scorersFor = (side: 'home' | 'away') =>
    events
      .filter((e) => e.event_type === 'goal' && goalFor(e, home?.id) === side)
      .sort((a, b) => a.minute - b.minute)
      .map((e) => ({ id: e.id, name: nameOf(keyOf(e)) || 'Unknown', minute: e.minute, ownGoal: isOwnGoal(e) }))

  const toastTeam = toast && 'teamId' in toast ? teamById(toast.teamId) : null
  const toastColor = toastTeam ? kit(toastTeam.jersey_color).base : undefined

  return (
    <div className="max-w-xl mx-auto min-h-[calc(100dvh-64px)] flex flex-col pb-40">
      {/* Header: back · shared clock · pause */}
      <header className="flex items-center justify-between gap-3 p-4">
        <Link href={`/groups/${groupId}/match/${bookingId}?tab=fixture`} aria-label="Back to fixtures" className="w-11 h-11 rounded-full border border-ka-line flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="text-center min-w-0">
          <ClockText match={match} offsetMs={offsetMs} className="ka-display ka-tabular text-3xl leading-none block" />
          <div className="text-xs text-ka-muted truncate">
            {subtitle}
            {stale && <span className="text-ka-danger font-semibold"> · reconnecting…</span>}
          </div>
        </div>
        {canLog && inHalf ? (
          <button
            onClick={() => clock({ cmd: match.clock_running ? 'pause' : 'resume' })}
            aria-label={match.clock_running ? 'Pause clock' : 'Resume clock'}
            className="w-11 h-11 rounded-full border border-ka-line flex items-center justify-center"
          >
            {match.clock_running ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
          </button>
        ) : (
          <span
            className={`h-7 px-2.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${ongoing ? 'bg-ka-danger text-white' : 'bg-ka-soft text-ka-muted'}`}
          >
            {ongoing && <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden />}
            {ongoing ? 'Live' : finished ? 'FT' : 'Soon'}
          </span>
        )}
      </header>

      {canLog && <PeriodPrompt match={match} offsetMs={offsetMs} onEnd={endPeriod} />}

      {/* Kit-coloured halves */}
      {home && away ? (
        <div className="grid grid-cols-2 mt-3">
          {([['home', home], ['away', away]] as const).map(([side, team]) => (
            <TeamHalf
              key={team.id}
              team={team}
              side={side}
              score={score[side]}
              names={names}
              tally={tally}
              canLog={canLog}
              onGoal={(k) => goal(team.id, k)}
              onUnknownGoal={() => goal(team.id, null)}
              onMore={(k) => setSheet({ kind: 'player', key: k, teamId: team.id })}
            />
          ))}
        </div>
      ) : (
        <p className="m-4 rounded-2xl border border-ka-line bg-ka-surface p-4 text-sm text-ka-muted">Both teams need to be set for this fixture before it can be scored.</p>
      )}

      {canLog && home && away && <p className="text-xs text-ka-muted text-center px-4 pt-3">Tap a name for a goal · hold a name for cards, saves, own goals and subs</p>}

      {/* MVP once it's over */}
      {finished && isAdmin && (
        <div className="px-4 pt-4">
          <MvpPicker teams={teams} selected={mvpKey} busy={mvpBusy} onPick={pickMvp} />
        </div>
      )}
      {finished && !isAdmin && mvpKey && (
        <p className="mx-4 mt-4 rounded-2xl bg-ka-soft px-4 py-3 text-sm font-bold">⭐ Player of the match: {fullName(mvpKey)}</p>
      )}

      {/* Tabs */}
      <div className="px-4 pt-5">
        <div role="tablist" className="flex gap-1 rounded-2xl bg-ka-soft p-1">
          {(['events', 'lineup', 'minutes'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 h-10 rounded-xl text-sm font-bold capitalize ${tab === t ? 'bg-ka-surface shadow-sm' : 'text-ka-muted'}`}
            >
              {t === 'events' ? `Events (${events.length})` : t}
            </button>
          ))}
        </div>
        <div className="pt-4">
          {tab === 'events' && <Timeline events={events} home={home} away={away} nameOf={nameOf} canLog={canLog} onEdit={(id) => setSheet({ kind: 'edit', eventId: id })} />}
          {tab === 'lineup' && <LineupTab teams={teams} starters={starters} canLog={canLog} onToggle={toggleStarter} />}
          {tab === 'minutes' && <MinutesTab teams={teams} minutes={pitch.minutesPlayed} conceded={pitch.goalsConcededOnPitch} />}
        </div>
        <button onClick={() => setShowShare(true)} className="mt-5 w-full h-12 rounded-2xl border border-ka-line bg-ka-surface font-bold flex items-center justify-center gap-2">
          <Share2 className="w-4 h-4" /> Share result card
        </button>
      </div>

      {/* Bottom: toast + period control */}
      <div className="fixed inset-x-0 bottom-[61px] z-[60] pointer-events-none">
        <div className="max-w-xl mx-auto px-4 pb-3 flex flex-col gap-2 pointer-events-auto">
          {toast && (
            <ToastView
              toast={toast}
              color={toastColor}
              team={toastTeam}
              names={names}
              nameOf={nameOf}
              onClose={() => setToast(null)}
              onUndo={(id) => {
                voidEvent(id)
                setToast(null)
              }}
              onScorer={(t, k) => {
                editEvent(t.eventId, k, null, t.minute, { is_own_goal: !!t.ownGoal })
                setToast({ ...t, scorer: k })
              }}
              onAssist={(t, k) => {
                if (k) editEvent(t.eventId, t.scorer, k, t.minute, { is_own_goal: false })
                setToast({ kind: 'logged', eventId: t.eventId, teamId: t.teamId, text: `Goal · ${nameOf(t.scorer)}${k ? ` (assist ${nameOf(k)})` : ''} ${t.minute}'` })
              }}
            />
          )}
          {canLog && home && away && !finished && (
            <div className="flex gap-2">
              {match.status === 'scheduled' ? (
                <button onClick={() => setSheet({ kind: 'kickoff' })} className="flex-1 h-14 rounded-2xl bg-ka-primary text-ka-on-primary ka-display text-lg flex items-center justify-center gap-2 shadow-lg">
                  <Play className="w-5 h-5" fill="currentColor" /> Kick off
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => (match.period === 'half_time' ? clock({ cmd: 'second_half' }) : endPeriod())}
                  className="flex-1 h-14 rounded-2xl bg-ka-ink text-ka-bg ka-display text-lg flex items-center justify-center gap-2 shadow-lg"
                >
                  {busy && <Loader2 className="w-5 h-5 animate-spin" />}
                  {match.period === 'half_time' ? 'Start 2nd half' : match.period === '1st_half' && match.timing_mode === 'halves' ? 'End 1st half' : 'Full time'}
                </button>
              )}
              {ongoing && (
                <button onClick={() => setSheet({ kind: 'clock' })} aria-label="Clock options" className="w-14 h-14 rounded-2xl border border-ka-line bg-ka-surface flex items-center justify-center shadow-lg">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sheets */}
      {sheet?.kind === 'player' && (() => {
        const team = teamById(sheet.teamId)!
        const k = kit(team.jersey_color)
        const close = () => setSheet(null)
        return (
          <Sheet
            onClose={close}
            title={
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-full flex items-center justify-center font-bold" style={{ background: k.base, color: k.ink }}>
                  {(nameOf(sheet.key) || '?').slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="ka-display text-2xl leading-none truncate">{fullName(sheet.key)}</div>
                  <div className="text-sm text-ka-muted">{team.name}{ongoing ? ` · ${matchMinute(match, serverNow())}'` : ''}</div>
                </div>
              </div>
            }
          >
            <button onClick={() => { close(); goal(team.id, sheet.key) }} className="h-16 rounded-2xl bg-ka-primary text-ka-on-primary ka-display text-2xl">
              Goal
            </button>
            <div className="grid grid-cols-3 gap-2">
              <SheetButton onClick={() => { close(); quick('card', team.id, sheet.key, 'yellow') }}><span className="w-3 h-4 rounded-[2px] bg-yellow-400" />Yellow</SheetButton>
              <SheetButton onClick={() => { close(); quick('card', team.id, sheet.key, 'red') }}><span className="w-3 h-4 rounded-[2px] bg-red-600" />Red</SheetButton>
              <SheetButton onClick={() => { close(); quick('penalty_save', team.id, sheet.key) }}>🧤 Pen save</SheetButton>
              <SheetButton onClick={() => { close(); goal(team.id, sheet.key, true) }}>Own goal</SheetButton>
              <SheetButton onClick={() => setSheet({ kind: 'sub', key: sheet.key, teamId: team.id })}>🔄 Sub off</SheetButton>
            </div>
          </Sheet>
        )
      })()}

      {sheet?.kind === 'sub' && (() => {
        const team = teamById(sheet.teamId)!
        const { bench } = onPitch(team.players, Array.from(starters), events)
        return (
          <Sheet onClose={() => setSheet(null)} title={<div className="ka-display text-xl">{nameOf(sheet.key)} off — who comes on?</div>}>
            {bench.length ? (
              <PickRow players={bench.filter((p) => p.id !== sheet.key)} names={names} onPick={(k) => { if (k) sub(team.id, sheet.key, k); setSheet(null) }} />
            ) : (
              <>
                <p className="text-sm text-ka-muted">Everyone in {team.name} is on the pitch. Mark who started on the bench in the Lineup tab, then subs can bring them on.</p>
                <button onClick={() => { setSheet(null); setTab('lineup') }} className="h-12 rounded-xl border border-ka-line font-bold">Open Lineup</button>
              </>
            )}
          </Sheet>
        )
      })()}

      {sheet?.kind === 'edit' && (() => {
        const e = events.find((x) => x.id === sheet.eventId)
        if (!e) return null
        return (
          <EditSheet
            key={e.id}
            event={e}
            team={teamById(e.team_id)}
            names={names}
            onClose={() => setSheet(null)}
            onSave={(scorer, assist, minute, extra) => {
              editEvent(e.id, scorer, assist, minute, extra)
              setSheet(null)
            }}
            onDelete={() => {
              voidEvent(e.id)
              setSheet(null)
            }}
          />
        )
      })()}

      {sheet?.kind === 'kickoff' && <KickoffSheet bookingId={bookingId} busy={busy} onClose={() => setSheet(null)} onStart={async (mode, half) => { await clock({ cmd: 'start', timingMode: mode, halfMinutes: half }); setSheet(null) }} />}

      {sheet?.kind === 'fulltime' && (
        <Sheet onClose={() => setSheet(null)} title={<div className="ka-display text-2xl">Full time?</div>}>
          <p className="text-sm">
            Final score <b>{home?.name} {score.home} – {score.away} {away?.name}</b>. This stops the clock, writes clean sheets and updates the table.
            You can still correct events afterwards.
          </p>
          <button disabled={busy} onClick={fullTime} className="h-14 rounded-2xl bg-ka-primary text-ka-on-primary ka-display text-xl flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-5 h-5 animate-spin" />} Finish match
          </button>
          <button onClick={() => setSheet(null)} className="h-12 rounded-2xl border border-ka-line font-bold">Keep playing</button>
        </Sheet>
      )}

      {sheet?.kind === 'clock' && (
        <Sheet onClose={() => setSheet(null)} title={<div className="ka-display text-2xl">Clock</div>}>
          <p className="text-sm text-ka-muted">Every phone follows this clock. Fix it if it was started late or early.</p>
          <div className="grid grid-cols-2 gap-2">
            <SheetButton onClick={() => clock({ cmd: 'adjust', deltaMs: -60000 })}><Minus className="w-4 h-4" /> 1 min</SheetButton>
            <SheetButton onClick={() => clock({ cmd: 'adjust', deltaMs: 60000 })}><Plus className="w-4 h-4" /> 1 min</SheetButton>
          </div>
          <ResetButton onReset={() => { clock({ cmd: 'reset' }); setSheet(null) }} />
        </Sheet>
      )}

      {showShare && (
        <MatchShareCard
          matchNumber={match.match_number}
          stageName={match.stage_name}
          home={home}
          away={away}
          score={score}
          homeScorers={scorersFor('home')}
          awayScorers={scorersFor('away')}
          mvpName={fullName(mvpKey)}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}

function SheetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="min-h-14 rounded-2xl border border-ka-line bg-ka-soft font-bold text-sm flex items-center justify-center gap-1.5">
      {children}
    </button>
  )
}

function ResetButton({ onReset }: { onReset: () => void }) {
  const [armed, setArmed] = useState(false)
  return (
    <button onClick={() => (armed ? onReset() : setArmed(true))} className={`h-12 rounded-2xl font-bold border ${armed ? 'bg-ka-danger text-white border-transparent' : 'border-ka-line text-ka-danger'}`}>
      {armed ? 'Tap again to reset to not started' : 'Reset clock (false start)'}
    </button>
  )
}

function ToastView({
  toast, color, team, names, nameOf, onClose, onUndo, onScorer, onAssist,
}: {
  toast: ToastState
  color?: string
  team: LiveTeam | null
  names: Map<string, string>
  nameOf: (k: string | null) => string | null
  onClose: () => void
  onUndo: (id: string) => void
  onScorer: (t: Extract<ToastState, { kind: 'goal' }>, k: string | null) => void
  onAssist: (t: Extract<ToastState, { kind: 'goal' }>, k: string | null) => void
}) {
  const undo = (id: string, label = 'Undo') => (
    <button onClick={() => onUndo(id)} className="h-10 px-3.5 rounded-xl border-2 border-current font-bold text-sm shrink-0">
      {label}
    </button>
  )
  if (toast.kind === 'error') {
    return (
      <Toast onClose={onClose}>
        <p className="text-sm font-semibold py-1.5">{toast.text}</p>
      </Toast>
    )
  }
  if (toast.kind === 'logged') {
    return (
      <Toast color={color}>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm font-bold">{toast.text}</p>
          {undo(toast.eventId)}
        </div>
      </Toast>
    )
  }
  if (toast.kind === 'dup') {
    return (
      <Toast color={color}>
        <p className="text-sm font-semibold">{toast.text}</p>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="h-10 px-3.5 rounded-xl bg-ka-bg text-ka-ink font-bold text-sm">Keep both</button>
          {undo(toast.eventId, 'Remove mine')}
        </div>
      </Toast>
    )
  }
  // Goal: who scored (if unknown) → who assisted (optional), with Undo throughout.
  const mates = team?.players || []
  const needsScorer = !toast.scorer
  return (
    <Toast color={color}>
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm">
          <b>{toast.ownGoal ? 'Own goal' : 'Goal'} · {needsScorer ? 'who scored?' : nameOf(toast.scorer)}</b> {toast.minute}&apos;
          {!needsScorer && !toast.ownGoal && <span className="opacity-80"> — assist?</span>}
        </p>
        {undo(toast.eventId)}
      </div>
      {(needsScorer || !toast.ownGoal) && (
        <div className="pt-2">
          {needsScorer ? (
            <PickRow players={mates} names={names} onPick={(k) => (k ? onScorer(toast, k) : onClose())} none="Don’t know" />
          ) : (
            <PickRow players={mates.filter((p) => p.id !== toast.scorer)} names={names} onPick={(k) => onAssist(toast, k)} none="No assist" />
          )}
        </div>
      )}
    </Toast>
  )
}

function EditSheet({
  event, team, names, onClose, onSave, onDelete,
}: {
  event: LiveEvent
  team: LiveTeam | null
  names: Map<string, string>
  onClose: () => void
  onSave: (scorer: string | null, assist: string | null, minute: number, extra: { is_own_goal?: boolean; card_type?: 'yellow' | 'red' }) => void
  onDelete: () => void
}) {
  const [scorer, setScorer] = useState<string | null>(keyOf(event))
  const [assist, setAssist] = useState<string | null>(secondKeyOf(event))
  const [minute, setMinute] = useState(event.minute)
  const [own, setOwn] = useState(isOwnGoal(event))
  const [card, setCard] = useState<'yellow' | 'red'>(event.details_json?.card_type === 'red' ? 'red' : 'yellow')
  const [armed, setArmed] = useState(false)
  const players = team?.players || []
  const t = event.event_type
  const firstLabel = t === 'sub' ? 'Off' : t === 'goal' ? 'Scorer' : 'Player'

  return (
    <Sheet onClose={onClose} title={<div className="ka-display text-2xl">Edit {eventLabel({ ...event, details_json: { ...event.details_json, is_own_goal: own, card_type: card } }).toLowerCase()}</div>}>
      {team && <div className="text-sm text-ka-muted -mt-2">{team.name}</div>}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-ka-muted">{firstLabel}</span>
        <PickRow players={players} names={names} selected={scorer} onPick={setScorer} none={t === 'goal' ? 'Unknown' : undefined} />
      </div>
      {(t === 'sub' || (t === 'goal' && !own)) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-ka-muted">{t === 'sub' ? 'On' : 'Assist'}</span>
          <PickRow players={players.filter((p) => p.id !== scorer)} names={names} selected={assist} onPick={setAssist} none={t === 'goal' ? 'None' : undefined} />
        </div>
      )}
      {t === 'goal' && (
        <label className="flex items-center gap-3 min-h-11 font-semibold text-sm">
          <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} className="w-5 h-5 accent-current" />
          Own goal (counts for the other team)
        </label>
      )}
      {t === 'card' && (
        <div className="grid grid-cols-2 gap-2">
          {(['yellow', 'red'] as const).map((c) => (
            <button key={c} onClick={() => setCard(c)} aria-pressed={card === c} className={`h-12 rounded-xl font-bold border flex items-center justify-center gap-2 capitalize ${card === c ? 'bg-ka-ink text-ka-bg border-transparent' : 'border-ka-line'}`}>
              <span className={`w-3 h-4 rounded-[2px] ${c === 'red' ? 'bg-red-600' : 'bg-yellow-400'}`} /> {c}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-ka-muted flex-1">Minute</span>
        <button onClick={() => setMinute((m) => Math.max(0, m - 1))} aria-label="Earlier" className="w-11 h-11 rounded-full border border-ka-line flex items-center justify-center"><Minus className="w-4 h-4" /></button>
        <span className="ka-display ka-tabular text-2xl w-12 text-center">{minute}&apos;</span>
        <button onClick={() => setMinute((m) => m + 1)} aria-label="Later" className="w-11 h-11 rounded-full border border-ka-line flex items-center justify-center"><Plus className="w-4 h-4" /></button>
      </div>
      <button
        disabled={t !== 'goal' && !scorer}
        onClick={() => onSave(scorer, t === 'goal' && own ? null : assist, minute, t === 'goal' ? { is_own_goal: own } : t === 'card' ? { card_type: card } : {})}
        className="h-14 rounded-2xl bg-ka-primary text-ka-on-primary ka-display text-xl disabled:opacity-50"
      >
        Save
      </button>
      <button onClick={() => (armed ? onDelete() : setArmed(true))} className={`h-12 rounded-2xl font-bold border ${armed ? 'bg-ka-danger text-white border-transparent' : 'border-ka-line text-ka-danger'}`}>
        {armed ? 'Tap again to delete' : 'Delete'}
      </button>
    </Sheet>
  )
}

function KickoffSheet({ bookingId, busy, onClose, onStart }: { bookingId: string; busy: boolean; onClose: () => void; onStart: (mode: 'halves' | 'continuous', half: number) => void }) {
  const storeKey = `khelahobe_match_timing_${bookingId}`
  const [mode, setMode] = useState<'halves' | 'continuous'>('halves')
  const [half, setHalf] = useState(15)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) || 'null')
      if (saved?.matchStructure) setMode(saved.matchStructure)
      if (saved?.halfDuration) setHalf(saved.halfDuration)
    } catch {
      // first match of the day
    }
  }, [storeKey])
  function start() {
    try {
      localStorage.setItem(storeKey, JSON.stringify({ matchStructure: mode, halfDuration: half }))
    } catch {
      // private mode
    }
    onStart(mode, half)
  }
  return (
    <Sheet onClose={onClose} title={<div className="ka-display text-2xl">Kick off</div>}>
      <div className="grid grid-cols-2 gap-2">
        {(['halves', 'continuous'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`h-12 rounded-xl font-bold border ${mode === m ? 'bg-ka-ink text-ka-bg border-transparent' : 'border-ka-line'}`}>
            {m === 'halves' ? 'Two halves' : 'One period'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold flex-1">{mode === 'halves' ? 'Minutes per half' : 'Match length (minutes)'}</span>
        <button onClick={() => setHalf((h) => Math.max(1, h - 1))} aria-label="Fewer minutes" className="w-11 h-11 rounded-full border border-ka-line flex items-center justify-center"><Minus className="w-4 h-4" /></button>
        <span className="ka-display ka-tabular text-2xl w-10 text-center">{half}</span>
        <button onClick={() => setHalf((h) => Math.min(90, h + 1))} aria-label="More minutes" className="w-11 h-11 rounded-full border border-ka-line flex items-center justify-center"><Plus className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-ka-muted">The clock runs on every phone. When time is up you&apos;ll be asked to end the half; nothing ends by itself.</p>
      <button disabled={busy} onClick={start} className="h-14 rounded-2xl bg-ka-primary text-ka-on-primary ka-display text-xl flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" fill="currentColor" />} Start the clock
      </button>
    </Sheet>
  )
}
