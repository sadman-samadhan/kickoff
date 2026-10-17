'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, ChevronLeft, ChevronRight, Crown, Gavel, Lock, Minus, MonitorPlay, Pause, Play, Plus, Redo2, RotateCcw, Share2,
  SkipForward, Trash2, TriangleAlert, Undo2, Volume2, VolumeX, X,
} from 'lucide-react'
import { checkBid, formatMoney, minNextBid } from '@/lib/auctionRules'
import type { AuctionState } from '@/lib/auction/types'
import { cn } from '@/lib/utils'
import { useAuction } from '@/components/auction/useAuction'
import { useBidSound } from '@/components/auction/useBidSound'
import { derive, onColor, rulesOf, tierOf, type Derived } from '@/components/auction/derive'
import { ActivityFeed, BidList, LiveHeader, OnTheBlock, PoolByTier, TeamsGrid } from '@/components/auction/panels'
import { SoldCardModal } from '@/components/auction/SoldCard'
import dynamic from 'next/dynamic'
import { SquadsCard } from '@/components/share/cards'

const ShareSheet = dynamic(() => import('@/components/share/ShareSheet').then((m) => m.ShareSheet))
import { cancelAuction, controlAuction, finalizeAuction, placeAuctionBid, type AuctionControl } from './actions'

type Props = { initial: AuctionState; groupId: string; bookingId: string }

export default function AuctionRoom({ initial, groupId, bookingId }: Props) {
  const sound = useBidSound()
  const presenceKey = initial.myTeamId ? `team:${initial.myTeamId}` : initial.isAdmin ? 'admin' : `viewer:${Math.random().toString(36).slice(2, 8)}`
  const [key] = useState(presenceKey)
  const { state, connected, stale, online, refresh } = useAuction(initial, {
    presenceKey: key,
    onPing: (p) => {
      if (p.kind === 'bid' && p.teamId !== initial.myTeamId) sound.play('bid')
      if (p.kind === 'sold') sound.play('sold')
    },
  })
  const d = derive(state)
  const [view, setView] = useState<'control' | 'watch'>(initial.isAdmin ? 'control' : 'watch')
  const [soldCardOpen, setSoldCardOpen] = useState(false)
  const [squadsOpen, setSquadsOpen] = useState(false)
  const matchPath = `/groups/${groupId}/match/${bookingId}`

  const current = d.current
  const soldTeam = current?.soldTeamId ? d.teamById.get(current.soldTeamId) : null

  const header = (
    <>
      <div className="flex items-center gap-2">
        <Link href={`${matchPath}?tab=teams`} aria-label="Back to matchday" className="inline-flex size-11 items-center justify-center rounded-full border border-ka-line bg-ka-surface">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <LiveHeader
            state={state}
            connected={connected}
            stale={stale}
            right={
              <button onClick={sound.toggle} aria-label={sound.enabled ? 'Mute bid sounds' : 'Play bid sounds'} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-ka-soft">
                {sound.enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {state.isAdmin && (
          <div role="tablist" aria-label="View" className="inline-flex rounded-xl border border-ka-line bg-ka-surface p-1">
            {(['control', 'watch'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn('h-9 rounded-lg px-3 text-sm font-semibold capitalize', view === v ? 'bg-ka-ink text-ka-surface' : 'text-ka-muted')}
              >
                {v === 'control' ? 'Run auction' : 'Watch'}
              </button>
            ))}
          </div>
        )}
        <Link href={`/tv/auction/${state.auction.id}`} target="_blank" className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-ka-line bg-ka-surface px-3 text-sm font-semibold">
          <MonitorPlay className="size-4" /> TV view
        </Link>
        {state.auction.status === 'done' && (
          <button onClick={() => setSquadsOpen(true)} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-ka-line bg-ka-surface px-3 text-sm font-semibold">
            <Share2 className="size-4" /> Share squads
          </button>
        )}
        {current?.status === 'sold' && soldTeam && (
          <button onClick={() => setSoldCardOpen(true)} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-ka-line bg-ka-surface px-3 text-sm font-semibold">
            <Share2 className="size-4" /> SOLD card
          </button>
        )}
      </div>
      {state.auction.finalizedAt && (
        <Link href={`${matchPath}?tab=teams`} className="flex items-center gap-2 rounded-2xl bg-ka-primary p-3 font-semibold text-ka-on-primary">
          <Lock className="size-5" aria-hidden />
          <span className="flex-1">Teams are locked in. See them on the matchday.</span>
          <ChevronRight className="size-5" />
        </Link>
      )}
    </>
  )

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-8">
      {header}
      {state.isAdmin && view === 'control' ? (
        <ControlView state={state} d={d} online={online} refresh={refresh} matchPath={matchPath} />
      ) : state.myTeamId ? (
        <CaptainView state={state} d={d} refresh={refresh} />
      ) : (
        <WatchView state={state} d={d} />
      )}
      {squadsOpen && (
        <ShareSheet title="Share final squads" onClose={() => setSquadsOpen(false)} meta={{ fileName: 'khelahobe-auction-squads.png', title: `${state.auction.groupName} — final squads` }}>
          {(o) => (
            <SquadsCard
              {...o}
              data={{
                meta: { group: state.auction.groupName, label: state.auction.matchLabel || undefined },
                teams: state.teams.map((t) => ({
                  name: t.name,
                  color: t.color,
                  captain: t.captainName,
                  spent: state.entries.filter((e) => e.soldTeamId === t.id).reduce((sum, e) => sum + (e.soldPrice || 0), 0),
                  players: state.entries.filter((e) => e.soldTeamId === t.id).map((e) => e.name),
                })),
              }}
            />
          )}
        </ShareSheet>
      )}
      {soldCardOpen && current && soldTeam && (
        <SoldCardModal
          entry={current}
          team={soldTeam}
          tier={tierOf(current, d.tierById)}
          title={`${state.auction.groupName} · Auction`}
          subtitle={state.auction.matchLabel}
          onClose={() => setSoldCardOpen(false)}
        />
      )}
    </div>
  )
}

// ───────────────────────── Watch ─────────────────────────

function WatchView({ state, d }: { state: AuctionState; d: Derived }) {
  return (
    <>
      <OnTheBlock state={state} d={d} />
      <div className="grid gap-3 sm:grid-cols-2">
        <BidList state={state} d={d} />
        <ActivityFeed state={state} d={d} limit={8} />
      </div>
      <h2 className="ka-display text-xl">Teams</h2>
      <TeamsGrid state={state} d={d} highlightTeamId={state.myTeamId} />
      <h2 className="ka-display text-xl">Player pool</h2>
      <PoolByTier state={state} d={d} />
    </>
  )
}

// ───────────────────────── Captain ─────────────────────────

const JUMPS = [50, 100, 250, 500]

function BidPad({ state, d, teamId, refresh, compact }: { state: AuctionState; d: Derived; teamId: string; refresh: () => void; compact?: boolean }) {
  const team = d.teamById.get(teamId)!
  const r = rulesOf(state)
  const e = d.current
  const open = state.auction.status === 'live' && e?.status === 'on_block'
  const topId = d.top?.id
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const top = useMemo(() => (d.top ? { teamId: d.top.teamId, amount: d.top.amount } : null), [topId])
  const leading = top?.teamId === teamId
  const next = minNextBid(r, d.minPrice, top?.amount ?? null)
  const [custom, setCustom] = useState(next)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  useEffect(() => setCustom((c) => (c < next ? next : c)), [next])
  useEffect(() => setError(''), [e?.id])

  const tierReason = d.tierProblemFor(teamId, e)
  const check = useCallback(
    (amount: number) => {
      if (!open) return { ok: false, reason: 'Bidding is closed' } as const
      if (tierReason) return { ok: false, reason: tierReason } as const
      return checkBid({ rules: r, minPrice: d.minPrice, amount, top, teamId, standing: team.standing })
    },
    [open, r, d.minPrice, top, teamId, team.standing, tierReason],
  )

  const options = useMemo(() => {
    const base = top?.amount ?? d.minPrice - r.bidIncrement
    return Array.from(new Set([next, ...JUMPS.map((j) => base + j)])).filter((a) => a >= next).slice(0, 5)
  }, [top?.amount, d.minPrice, r.bidIncrement, next])

  function bid(amount: number) {
    const c = check(amount)
    if (!c.ok) return setError(c.reason)
    if (amount - next >= 1000 && !confirm(`Bid ${formatMoney(amount)}?`)) return
    setError('')
    start(async () => {
      const res = await placeAuctionBid(state.auction.id, e!.id, amount, teamId)
      if (!res.ok) setError(res.error)
      else if ('vibrate' in navigator) navigator.vibrate?.(40)
      refresh()
    })
  }

  if (team.standing.slotsLeft <= 0) return <p className="ka-display py-4 text-center text-xl text-ka-primary">Squad is full</p>
  if (!open)
    return (
      <p className="py-4 text-center text-sm text-ka-muted">
        {state.auction.status === 'paused' ? 'The auction is paused.' : state.auction.status === 'done' ? 'The auction is over.' : 'Waiting for the next player…'}
      </p>
    )

  const customCheck = check(custom)
  return (
    <div className="flex flex-col gap-2">
      {error && <p role="alert" className="rounded-xl bg-ka-danger/10 px-3 py-2 text-sm text-ka-danger">{error}</p>}
      {tierReason && <p className="rounded-xl bg-ka-warn/15 px-3 py-2 text-sm font-semibold">{tierReason}</p>}
      <div className="grid grid-cols-2 gap-2">
        {options.map((amount, i) => {
          const c = check(amount)
          return (
            <button
              key={amount}
              disabled={!c.ok || pending || leading}
              title={c.ok ? undefined : c.reason}
              onClick={() => bid(amount)}
              className={cn(
                'flex flex-col items-center justify-center rounded-2xl disabled:opacity-40',
                i === 0 ? 'col-span-2 bg-ka-primary text-ka-on-primary' : 'bg-ka-soft text-ka-ink',
                compact ? 'h-14' : i === 0 ? 'h-20' : 'h-16',
              )}
            >
              <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">{i === 0 ? 'Bid' : `+${formatMoney(amount - (top?.amount ?? 0))}`}</span>
              <span className={cn('ka-display ka-tabular leading-none', i === 0 ? 'text-4xl' : 'text-2xl')}>{formatMoney(amount)}</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <button aria-label={`Lower by ${r.bidIncrement}`} onClick={() => setCustom((c) => Math.max(next, c - r.bidIncrement))} className="inline-flex size-14 items-center justify-center rounded-xl border border-ka-line">
          <Minus className="size-5" />
        </button>
        <label className="sr-only" htmlFor={`custom-${teamId}`}>Custom bid</label>
        <input
          id={`custom-${teamId}`}
          inputMode="numeric"
          value={custom}
          onChange={(ev) => setCustom(Number(ev.target.value.replace(/\D/g, '')) || 0)}
          className="ka-display ka-tabular h-14 min-w-0 flex-1 rounded-xl border border-ka-line bg-ka-surface text-center text-3xl"
        />
        <button aria-label={`Raise by ${r.bidIncrement}`} onClick={() => setCustom((c) => Math.min(team.standing.maxBid, c + r.bidIncrement))} className="inline-flex size-14 items-center justify-center rounded-xl border border-ka-line">
          <Plus className="size-5" />
        </button>
        <button disabled={!customCheck.ok || pending || leading} onClick={() => bid(custom)} className="ka-display h-14 rounded-xl bg-ka-primary px-5 text-xl text-ka-on-primary disabled:opacity-40">
          Bid
        </button>
      </div>
      {!customCheck.ok && !leading && <p className="text-sm text-ka-warn">{customCheck.reason}</p>}
    </div>
  )
}

function CaptainView({ state, d, refresh }: { state: AuctionState; d: Derived; refresh: () => void }) {
  const team = d.teamById.get(state.myTeamId!)!
  const top = d.top
  const leading = top?.teamId === team.id
  const open = state.auction.status === 'live' && d.current?.status === 'on_block'
  const squad = d.squad(team.id)
  return (
    <>
      <section className="overflow-hidden rounded-2xl" style={{ background: team.color, color: onColor(team.color) }}>
        <div className="px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">You&apos;re captain</p>
          <p className="ka-display text-2xl leading-tight">{team.name}</p>
        </div>
        <dl className="grid grid-cols-3 bg-black/15 text-center">
          {[
            ['Money left', formatMoney(team.standing.remaining)],
            ['Max bid', formatMoney(team.standing.maxBid)],
            ['Spots left', String(team.standing.slotsLeft)],
          ].map(([k, v]) => (
            <div key={k} className="py-2">
              <dt className="text-[10px] font-bold uppercase tracking-wider opacity-80">{k}</dt>
              <dd className="ka-display ka-tabular text-2xl leading-none">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <OnTheBlock state={state} d={d} />

      {open && (
        <div
          role="status"
          className={cn(
            'ka-display flex items-center gap-2 rounded-2xl px-4 py-3 text-lg',
            leading ? 'bg-ka-primary text-ka-on-primary' : top ? 'bg-ka-danger text-white' : 'bg-ka-soft',
          )}
        >
          {leading ? <CheckCircle2 className="size-5" aria-hidden /> : top ? <TriangleAlert className="size-5" aria-hidden /> : null}
          {leading ? `You're winning at ${formatMoney(top!.amount)}` : top ? `${d.teamById.get(top.teamId)?.name} has ${formatMoney(top.amount)}` : `Opening at ${formatMoney(d.minPrice)}`}
        </div>
      )}

      {d.missingTiers(team.id).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-ka-muted">Still need:</span>
          {d.missingTiers(team.id).map((t) => (
            <span key={t.id} className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${t.color}26`, color: t.color }}>
              {t.name}
            </span>
          ))}
        </div>
      )}

      <section aria-label="Place a bid" className="rounded-2xl border border-ka-line bg-ka-surface p-3">
        <BidPad state={state} d={d} teamId={team.id} refresh={refresh} />
      </section>

      <section className="rounded-2xl border border-ka-line bg-ka-surface">
        <h2 className="ka-display border-b border-ka-line px-4 py-2 text-lg">
          My squad ({squad.length}/{state.auction.squadSize})
        </h2>
        <ul>
          <li className="flex items-center gap-2 border-b border-ka-line px-4 py-2 text-sm">
            <Crown className="size-4 text-ka-warn" aria-label="Captain" />
            <span className="flex-1 font-semibold">{team.captainName}</span>
          </li>
          {squad.map((p) => (
            <li key={p.id} className="flex items-center gap-2 border-b border-ka-line px-4 py-2 text-sm last:border-0">
              <span className="flex-1">{p.name}</span>
              <span className="ka-tabular font-semibold">{formatMoney(p.soldPrice)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-ka-line bg-ka-surface">
        <h2 className="ka-display border-b border-ka-line px-4 py-2 text-lg">Other teams</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-ka-muted">
            <tr>
              <th className="px-4 py-1.5 text-left font-semibold">Team</th>
              <th className="px-2 py-1.5 text-right font-semibold">Left</th>
              <th className="px-2 py-1.5 text-right font-semibold">Max bid</th>
              <th className="px-4 py-1.5 text-right font-semibold">Spots</th>
            </tr>
          </thead>
          <tbody>
            {state.teams
              .filter((t) => t.id !== team.id)
              .map((t) => (
                <tr key={t.id} className="border-t border-ka-line">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ background: t.color }} aria-hidden /> {t.name}
                    </span>
                  </td>
                  <td className="ka-tabular px-2 py-2 text-right">{formatMoney(t.standing.remaining)}</td>
                  <td className="ka-tabular px-2 py-2 text-right">{formatMoney(t.standing.maxBid)}</td>
                  <td className="ka-tabular px-4 py-2 text-right">{t.standing.slotsLeft}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

// ───────────────────────── Admin control ─────────────────────────

function ControlView({ state, d, online, refresh, matchPath }: { state: AuctionState; d: Derived; online: string[]; refresh: () => void; matchPath: string }) {
  const router = useRouter()
  const a = state.auction
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const [proxyTeam, setProxyTeam] = useState(state.myTeamId ?? state.teams[0]?.id ?? '')

  const run = useCallback(
    (cmd: AuctionControl) =>
      start(async () => {
        setError('')
        const r = await controlAuction(a.id, cmd)
        if (!r.ok) setError(r.error)
        refresh()
      }),
    [a.id, refresh],
  )

  const e = d.current
  const live = a.status === 'live'
  const onBlock = live && e?.status === 'on_block'
  const hasBids = state.currentBids.length > 0
  const resolved = live && (!e || e.status === 'sold' || e.status === 'unsold')
  const canUndo = !a.finalizedAt && state.events.some((ev) => ['sold', 'unsold', 'auto_assign'].includes(ev.type) && !ev.undone)
  const captainsOnline = new Set(online.filter((k) => k.startsWith('team:')).map((k) => k.slice(5)))
  const watching = online.filter((k) => k.startsWith('viewer:')).length

  // Keyboard shortcuts for a laptop at the venue.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement
      if (pending || ev.metaKey || ev.ctrlKey || ev.altKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return
      const k = ev.key.toLowerCase()
      if (k === 's' && onBlock && hasBids) run({ op: 'sold' })
      else if (k === 'u' && onBlock && !hasBids) run({ op: 'unsold' })
      else if ((k === 'n' || k === 'enter') && resolved) run({ op: 'next' })
      else if (k === '1' && onBlock) run({ op: 'call', state: 'once' })
      else if (k === '2' && onBlock) run({ op: 'call', state: 'twice' })
      else if (k === 'z' && canUndo) run({ op: 'undo' })
      else return
      ev.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBlock, hasBids, resolved, canUndo, pending, run])

  const btn = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold disabled:opacity-40'

  return (
    <>
      {error && (
        <div role="alert" className="sticky top-16 z-20 flex items-center gap-2 rounded-xl bg-ka-danger px-3 py-2 text-sm text-white">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss"><X className="size-4" /></button>
        </div>
      )}

      <OnTheBlock state={state} d={d} />

      <section className="flex flex-col gap-2 rounded-2xl border border-ka-line bg-ka-surface p-3">
        {onBlock ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!hasBids || pending} onClick={() => run({ op: 'sold' })} className="ka-display inline-flex h-16 items-center justify-center gap-2 rounded-2xl bg-ka-primary text-xl text-ka-on-primary disabled:opacity-40">
                <Gavel className="size-5" /> Sold {d.top ? `· ${formatMoney(d.top.amount)}` : ''}
              </button>
              <button disabled={hasBids || pending} onClick={() => run({ op: 'unsold' })} className="ka-display h-16 rounded-2xl bg-ka-soft text-xl disabled:opacity-40">
                Unsold
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['once', 'twice'] as const).map((s) => (
                <button
                  key={s}
                  disabled={pending}
                  onClick={() => run({ op: 'call', state: a.callState === s ? 'none' : s })}
                  className={cn(btn, a.callState === s ? 'bg-ka-warn text-ka-on-warn' : 'border border-ka-line')}
                >
                  Going {s}
                </button>
              ))}
              <span className="flex-1" />
              <button disabled={!hasBids || pending} onClick={() => run({ op: 'retract' })} className={cn(btn, 'text-ka-muted')}>
                <Redo2 className="size-4" /> Retract bid
              </button>
              <button disabled={hasBids || pending} onClick={() => run({ op: 'skip' })} className={cn(btn, 'text-ka-muted')}>
                <SkipForward className="size-4" /> Skip
              </button>
            </div>
          </>
        ) : resolved ? (
          <button disabled={pending} onClick={() => run({ op: 'next' })} className="ka-display inline-flex h-16 items-center justify-center gap-2 rounded-2xl bg-ka-primary text-xl text-ka-on-primary">
            Next player <ChevronRight className="size-5" />
          </button>
        ) : a.status === 'paused' ? (
          <button disabled={pending} onClick={() => run({ op: 'resume' })} className="ka-display inline-flex h-16 items-center justify-center gap-2 rounded-2xl bg-ka-primary text-xl text-ka-on-primary">
            <Play className="size-5" /> Resume
          </button>
        ) : a.status === 'done' && !a.finalizedAt ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ka-muted">Every spot is filled. Check the squads, then lock them in — this creates the teams on the matchday and tells every player.</p>
            <button
              disabled={pending}
              onClick={() =>
                confirm('Lock in these teams? You can’t undo after this.') &&
                start(async () => {
                  const r = await finalizeAuction(a.id)
                  if (!r.ok) return setError(r.error)
                  router.push(`${matchPath}?tab=teams`)
                })
              }
              className="ka-display inline-flex h-16 items-center justify-center gap-2 rounded-2xl bg-ka-primary text-xl text-ka-on-primary"
            >
              <Lock className="size-5" /> Lock in teams
            </button>
          </div>
        ) : null}

        {!a.finalizedAt && (
          <div className="flex flex-wrap items-center gap-2 border-t border-ka-line pt-2">
            <button disabled={!canUndo || pending} onClick={() => run({ op: 'undo' })} className={cn(btn, 'text-ka-muted')}>
              <Undo2 className="size-4" /> Undo last
            </button>
            {live && (
              <button disabled={pending} onClick={() => run({ op: 'pause' })} className={cn(btn, 'text-ka-muted')}>
                <Pause className="size-4" /> Pause
              </button>
            )}
            <span className="flex-1" />
            <button
              disabled={pending}
              onClick={() => confirm('Reset to setup? Every sale and bid will be cleared.') && run({ op: 'reset' })}
              className={cn(btn, 'text-ka-muted')}
            >
              <RotateCcw className="size-4" /> Reset
            </button>
            <button
              disabled={pending}
              onClick={() =>
                confirm('Cancel the auction and delete its teams?') &&
                start(async () => {
                  const r = await cancelAuction(a.id)
                  if (!r.ok) return setError(r.error)
                  router.push(`${matchPath}?tab=teams`)
                })
              }
              className={cn(btn, 'text-ka-danger')}
            >
              <Trash2 className="size-4" /> Cancel
            </button>
          </div>
        )}
      </section>

      {onBlock && (
        <section className="rounded-2xl border border-ka-line bg-ka-surface p-3">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="ka-display flex-1 text-lg">Bid for a team</h2>
            <select
              aria-label="Team to bid for"
              value={proxyTeam}
              onChange={(ev) => setProxyTeam(ev.target.value)}
              className="h-11 rounded-xl border border-ka-line bg-ka-surface px-2 text-sm"
            >
              {state.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.id === state.myTeamId ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="mb-2 text-xs text-ka-muted">For a captain whose phone isn&apos;t working. The bid is recorded as placed by you.</p>
          {proxyTeam && <BidPad key={proxyTeam} state={state} d={d} teamId={proxyTeam} refresh={refresh} compact />}
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <section aria-label="Captains" className="rounded-2xl border border-ka-line bg-ka-surface">
          <h3 className="flex items-center border-b border-ka-line px-4 py-2 text-xs font-bold uppercase tracking-wider text-ka-muted">
            <span className="flex-1">Captains</span>
            <span className="font-normal normal-case">{watching} watching</span>
          </h3>
          <ul>
            {state.teams.map((t) => {
              const on = captainsOnline.has(t.id)
              return (
                <li key={t.id} className="flex items-center gap-2 border-b border-ka-line px-4 py-2 text-sm last:border-0">
                  <span className="size-3 rounded-full" style={{ background: t.color }} aria-hidden />
                  <span className="flex-1 truncate">{t.captainName}</span>
                  <span className={cn('text-xs', on ? 'text-ka-primary' : 'text-ka-muted')}>{on ? 'Online' : 'Offline'}</span>
                </li>
              )
            })}
          </ul>
        </section>
        <BidList state={state} d={d} />
      </div>

      <h2 className="ka-display text-xl">Teams</h2>
      <TeamsGrid state={state} d={d} />

      <h2 className="ka-display text-xl">Player pool</h2>
      <p className="-mt-2 text-sm text-ka-muted">
        {d.counts.queued} to come · {d.counts.sold} sold · {d.counts.unsold} unsold.
        {live && (resolved || (onBlock && !hasBids)) ? ' Tap a player to put them up next.' : ''}
      </p>
      <PoolByTier state={state} d={d} onPick={live && (resolved || (onBlock && !hasBids)) ? (id) => run({ op: 'next', entryId: id }) : undefined} />

      {!a.finalizedAt && <Overrides state={state} run={run} pending={pending} />}
      <ActivityFeed state={state} d={d} />
    </>
  )
}

function Overrides({ state, run, pending }: { state: AuctionState; run: (c: AuctionControl) => void; pending: boolean }) {
  const [entryId, setEntryId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [price, setPrice] = useState('')
  const [budgetTeam, setBudgetTeam] = useState(state.teams[0]?.id ?? '')
  const [adj, setAdj] = useState('')
  const entries = state.entries.filter((e) => e.status !== 'on_block' || state.currentBids.length === 0)
  const field = 'h-11 w-full rounded-xl border border-ka-line bg-ka-surface px-2 text-sm'
  return (
    <details className="rounded-2xl border border-ka-line bg-ka-surface p-3">
      <summary className="ka-display cursor-pointer text-lg">Admin overrides</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ka-muted">Put a player in a team at a price, move them, or release them.</p>
          <select aria-label="Player" className={field} value={entryId} onChange={(e) => setEntryId(e.target.value)}>
            <option value="">Player…</option>
            {entries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.status}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Team" className={field} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Release</option>
              {state.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input aria-label="Price" inputMode="numeric" placeholder="Price" className={field} value={price} disabled={!teamId} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
          </div>
          <button
            disabled={!entryId || (!!teamId && price === '') || pending}
            onClick={() => {
              run({ op: 'assign', entryId, teamId: teamId || null, price: teamId ? Number(price) : null })
              setEntryId('')
              setPrice('')
            }}
            className="h-11 rounded-xl bg-ka-soft text-sm font-semibold disabled:opacity-40"
          >
            Apply
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ka-muted">Give a team extra money or take some away.</p>
          <select aria-label="Team" className={field} value={budgetTeam} onChange={(e) => setBudgetTeam(e.target.value)}>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.budgetAdjustment >= 0 ? '+' : ''}
                {t.budgetAdjustment})
              </option>
            ))}
          </select>
          <input aria-label="Adjustment" inputMode="numeric" placeholder="e.g. 200 or -100" className={field} value={adj} onChange={(e) => setAdj(e.target.value.replace(/[^\d-]/g, ''))} />
          <button
            disabled={!budgetTeam || adj === '' || adj === '-' || pending}
            onClick={() => run({ op: 'budget', teamId: budgetTeam, adjustment: Number(adj) })}
            className="h-11 rounded-xl bg-ka-soft text-sm font-semibold disabled:opacity-40"
          >
            Set adjustment
          </button>
        </div>
      </div>
    </details>
  )
}
