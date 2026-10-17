/* eslint-disable @next/next/no-img-element */
'use client'

import { Crown, Gavel, Wifi, WifiOff } from 'lucide-react'
import { formatMoney } from '@/lib/auctionRules'
import type { AuctionState } from '@/lib/auction/types'
import { cn } from '@/lib/utils'
import { initials, onColor, tierOf, type Derived } from './derive'

const statusLabel: Record<string, string> = { draft: 'Setting up', live: 'Live', paused: 'Paused', done: 'Teams picked' }

export function StatusPill({ status, finalized }: { status: string; finalized?: boolean }) {
  const cls =
    status === 'live'
      ? 'bg-ka-danger text-white'
      : status === 'paused'
        ? 'bg-ka-warn text-ka-on-warn'
        : status === 'done'
          ? 'bg-ka-primary text-ka-on-primary'
          : 'bg-ka-soft text-ka-muted'
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider', cls)}>
      {status === 'live' && <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />}
      {finalized ? 'Teams locked' : statusLabel[status] ?? status}
    </span>
  )
}

export function LiveHeader({ state, connected, stale, right }: { state: AuctionState; connected: boolean; stale?: boolean; right?: React.ReactNode }) {
  const a = state.auction
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-ka-muted">
          {a.groupName} · {a.matchLabel}
        </p>
        <h1 className="ka-display truncate text-2xl">Auction</h1>
      </div>
      <div className="flex items-center gap-2">
        {a.phase === 'reauction' && a.status !== 'done' && (
          <span className="rounded-full bg-ka-warn px-2.5 py-1 text-[11px] font-bold uppercase text-ka-on-warn">Second round</span>
        )}
        <StatusPill status={a.status} finalized={!!a.finalizedAt} />
        <span className={cn('inline-flex', connected && !stale ? 'text-ka-primary' : 'text-ka-warn')} title={connected ? 'Live updates on' : 'Reconnecting'}>
          {connected && !stale ? <Wifi className="size-4" aria-hidden /> : <WifiOff className="size-4" aria-hidden />}
          <span className="sr-only">{connected ? 'Live' : 'Reconnecting'}</span>
        </span>
        {right}
      </div>
    </div>
  )
}

export function Avatar({ name, src, size = 40, color }: { name: string; src?: string | null; size?: number; color?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{ width: size, height: size, background: color || 'var(--ka-soft)', color: color ? onColor(color) : 'var(--ka-ink)', fontSize: size * 0.38 }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  )
}

/** The player up for bidding: tier colour on the left, the leading team's colour along the bottom. */
export function OnTheBlock({ state, d, size = 'md' }: { state: AuctionState; d: Derived; size?: 'md' | 'xl' }) {
  const a = state.auction
  const e = d.current
  const big = size === 'xl'

  if (a.status === 'done') {
    return (
      <Shell big={big}>
        <Crown className="size-10 text-ka-warn" aria-hidden />
        <p className="ka-display text-3xl">{a.finalizedAt ? 'Teams are locked in' : 'Teams are picked'}</p>
        <p className="text-sm text-ka-muted">
          {d.counts.sold} players sold{d.counts.unsold ? ` · ${d.counts.unsold} unsold` : ''}
        </p>
      </Shell>
    )
  }
  if (!e) {
    return (
      <Shell big={big}>
        <Gavel className="size-9 text-ka-muted" aria-hidden />
        <p className="ka-display text-2xl text-ka-muted">Next player coming up…</p>
      </Shell>
    )
  }

  const tier = tierOf(e, d.tierById)
  const tierColor = tier?.color ?? '#64748b'
  const leader = d.top ? d.teamById.get(d.top.teamId) : null
  const soldTo = e.soldTeamId ? d.teamById.get(e.soldTeamId) : null
  const barTeam = e.status === 'sold' ? soldTo : leader

  return (
    <section aria-label="Player up for bidding" className="relative overflow-hidden rounded-2xl border border-ka-line bg-ka-surface">
      <div className="flex items-stretch">
        <div
          className={cn('flex shrink-0 items-center justify-center ka-display', big ? 'w-44 text-7xl' : 'w-24 text-4xl')}
          style={{ background: tierColor, color: onColor(tierColor) }}
        >
          {e.avatarUrl ? <img src={e.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(e.name)}
        </div>
        <div className={cn('min-w-0 flex-1', big ? 'p-8' : 'p-4')}>
          <div className="flex flex-wrap items-center gap-1.5">
            {tier && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ background: `${tierColor}22`, color: tierColor }}>
                {tier.name}
              </span>
            )}
            {e.position && <span className="rounded-full bg-ka-soft px-2 py-0.5 text-[11px] font-bold uppercase text-ka-muted">{e.position}</span>}
            {e.isGuest && <span className="rounded-full bg-ka-soft px-2 py-0.5 text-[11px] font-bold uppercase text-ka-muted">Guest</span>}
          </div>
          <h2 className={cn('ka-display mt-1 break-words leading-none', big ? 'text-8xl' : 'text-4xl')}>{e.name}</h2>
          {e.status === 'on_block' && !d.top && (
            <p className={cn('mt-2 text-ka-muted', big ? 'text-3xl' : 'text-sm')}>
              Opening bid <b className="ka-tabular text-ka-ink">{formatMoney(d.minPrice)}</b>
            </p>
          )}
        </div>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true">
        {barTeam && (e.status === 'on_block' || e.status === 'sold') && (
          <div
            key={d.top?.id ?? e.id}
            className={cn('flex items-center justify-between gap-3 ka-bid-flash', big ? 'px-8 py-5' : 'px-4 py-3')}
            style={{ background: barTeam.color, color: onColor(barTeam.color) }}
          >
            <span className={cn('font-bold', big ? 'text-3xl' : 'text-base')}>
              {e.status === 'sold' ? `Sold to ${barTeam.name}` : `${barTeam.name} leading`}
            </span>
            <span className={cn('ka-display ka-tabular leading-none', big ? 'text-8xl' : 'text-4xl')}>
              {formatMoney(e.status === 'sold' ? e.soldPrice : d.top?.amount)}
            </span>
          </div>
        )}
        {e.status === 'unsold' && (
          <div className={cn('bg-ka-soft text-center font-bold text-ka-muted', big ? 'py-5 text-3xl' : 'py-3 text-sm')}>No bids — back in the second round</div>
        )}
      </div>

      {e.status === 'on_block' && a.callState !== 'none' && (
        <div role="alert" className={cn('animate-pulse bg-ka-warn text-center ka-display text-ka-on-warn', big ? 'py-4 text-5xl' : 'py-2 text-xl')}>
          Going {a.callState}…
        </div>
      )}
      {a.status === 'paused' && <div className={cn('bg-ka-soft text-center ka-display', big ? 'py-4 text-4xl' : 'py-2 text-lg')}>Paused</div>}
      {e.status === 'sold' && (
        <span aria-hidden className={cn('ka-stamp pointer-events-none absolute right-3 top-3 rounded-lg border-4 border-ka-primary px-2 ka-display text-ka-primary', big ? 'text-7xl' : 'text-3xl')}>
          Sold
        </span>
      )}
    </section>
  )
}

function Shell({ children, big }: { children: React.ReactNode; big: boolean }) {
  return (
    <section className={cn('flex flex-col items-center justify-center gap-2 rounded-2xl border border-ka-line bg-ka-surface p-8 text-center', big ? 'min-h-[50vh]' : 'min-h-48')}>
      {children}
    </section>
  )
}

export function BidList({ state, d, limit = 6 }: { state: AuctionState; d: Derived; limit?: number }) {
  const bids = state.currentBids.slice(0, limit)
  return (
    <section aria-label="Bids" className="rounded-2xl border border-ka-line bg-ka-surface">
      <h3 className="border-b border-ka-line px-4 py-2 text-xs font-bold uppercase tracking-wider text-ka-muted">
        Bids {state.currentBids.length > 0 && `(${state.currentBids.length})`}
      </h3>
      {bids.length === 0 ? (
        <p className="px-4 py-3 text-sm text-ka-muted">No bids yet.</p>
      ) : (
        <ol>
          {bids.map((b, i) => {
            const team = d.teamById.get(b.teamId)
            return (
              <li key={b.id} className={cn('flex items-center gap-2 border-b border-ka-line px-4 py-2 last:border-0', i === 0 && 'font-semibold')}>
                <span className="size-3 shrink-0 rounded-full" style={{ background: team?.color }} aria-hidden />
                <span className={cn('flex-1 truncate text-sm', i !== 0 && 'text-ka-muted')}>{team?.name}</span>
                <span className={cn('ka-display ka-tabular text-lg', i !== 0 && 'text-ka-muted')}>{formatMoney(b.amount)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/** Every team: squad with prices, money left, spent, spots, max bid. */
export function TeamsGrid({ state, d, highlightTeamId, compact }: { state: AuctionState; d: Derived; highlightTeamId?: string | null; compact?: boolean }) {
  const leaderId = d.current?.status === 'on_block' ? d.top?.teamId : null
  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'sm:grid-cols-2')}>
      {state.teams.map((team) => {
        const squad = d.squad(team.id).sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
        const open = Math.max(0, state.auction.squadSize - squad.length)
        const s = team.standing
        return (
          <section
            key={team.id}
            aria-label={team.name}
            className={cn(
              'flex flex-col overflow-hidden rounded-2xl border bg-ka-surface',
              highlightTeamId === team.id ? 'border-ka-primary ring-2 ring-ka-primary' : 'border-ka-line',
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: team.color, color: onColor(team.color) }}>
              <span className="ka-display min-w-0 flex-1 truncate text-lg">{team.name}</span>
              {leaderId === team.id && <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase">Leading</span>}
            </div>
            <dl className="grid grid-cols-3 border-b border-ka-line text-center">
              {[
                ['Left', formatMoney(s.remaining), true],
                ['Spent', formatMoney(s.spent), false],
                ['Spots', String(s.slotsLeft), false],
              ].map(([k, v, strong]) => (
                <div key={k as string} className="py-1.5">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-ka-muted">{k}</dt>
                  <dd className={cn('ka-display ka-tabular text-xl leading-tight', strong && 'text-ka-primary')}>{v}</dd>
                </div>
              ))}
            </dl>
            <ul className={cn('flex flex-1 flex-col', compact ? 'text-xs' : 'text-sm')}>
              <li className="flex items-center gap-2 border-b border-ka-line px-3 py-1.5">
                <Crown className="size-3.5 text-ka-warn" aria-label="Captain" />
                <span className="flex-1 truncate font-semibold">{team.captainName ?? '—'}</span>
                <span className="text-xs text-ka-muted">Captain</span>
              </li>
              {squad.map((e) => {
                const tier = tierOf(e, d.tierById)
                return (
                  <li key={e.id} className="flex items-center gap-2 border-b border-ka-line px-3 py-1.5 last:border-0">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: tier?.color ?? '#94a3b8' }} aria-hidden />
                    <span className="flex-1 truncate">{e.name}</span>
                    {e.soldVia === 'auto_assign' && <span className="text-[10px] uppercase text-ka-muted">auto</span>}
                    <span className="ka-tabular font-semibold">{formatMoney(e.soldPrice)}</span>
                  </li>
                )
              })}
              {!compact &&
                Array.from({ length: open }).map((_, i) => (
                  <li key={`open-${i}`} className="border-b border-dashed border-ka-line px-3 py-1.5 text-ka-muted/60 last:border-0">
                    Open spot
                  </li>
                ))}
            </ul>
            {s.slotsLeft > 0 && state.auction.status !== 'done' && (
              <p className="flex flex-wrap items-center gap-1.5 border-t border-ka-line px-3 py-1.5 text-xs text-ka-muted">
                <span>
                  Max bid <b className="ka-tabular text-ka-ink">{formatMoney(s.maxBid)}</b>
                </span>
                {d.missingTiers(team.id).length > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span>Needs</span>
                    {d.missingTiers(team.id).map((t) => (
                      <span key={t.id} className="inline-flex items-center gap-1 font-semibold" style={{ color: t.color }}>
                        <span className="size-2 rounded-full" style={{ background: t.color }} aria-hidden />
                        {t.name}
                      </span>
                    ))}
                  </>
                )}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

/** Players still to come (and what happened to the rest), by tier. */
export function PoolByTier({ state, d, onPick }: { state: AuctionState; d: Derived; onPick?: (entryId: string) => void }) {
  const groups = [
    ...state.tiers.map((t) => ({ id: t.id as string | null, name: t.name, color: t.color })),
    ...(state.entries.some((e) => !e.tierId) ? [{ id: null, name: 'No tier', color: '#94a3b8' }] : []),
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((g) => {
        const list = state.entries.filter((e) => e.tierId === g.id)
        const left = list.filter((e) => e.status !== 'sold').length
        return (
          <section key={g.id ?? 'none'} className="rounded-2xl border border-ka-line bg-ka-surface">
            <h3 className="flex items-center gap-2 border-b border-ka-line px-3 py-2">
              <span className="size-2.5 rounded-full" style={{ background: g.color }} aria-hidden />
              <span className="ka-display flex-1 text-base">{g.name}</span>
              <span className="text-xs text-ka-muted">
                {left} of {list.length} left
              </span>
            </h3>
            <ul className="flex flex-wrap gap-1.5 p-3">
              {list.map((e) => {
                const team = e.soldTeamId ? d.teamById.get(e.soldTeamId) : null
                const pickable = onPick && (e.status === 'queued' || e.status === 'unsold')
                const cls = cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                  e.status === 'on_block' && 'border-ka-primary bg-ka-soft font-semibold',
                  e.status === 'queued' && 'border-ka-line',
                  e.status === 'unsold' && 'border-dashed border-ka-warn',
                  e.status === 'sold' && 'border-transparent bg-ka-soft text-ka-muted',
                  pickable && 'hover:border-ka-primary',
                )
                const chip = (
                  <>
                    {team && <span className="size-2 rounded-full" style={{ background: team.color }} aria-hidden />}
                    {e.name}
                    {e.status === 'sold' && <span className="ka-tabular">{formatMoney(e.soldPrice)}</span>}
                  </>
                )
                return (
                  <li key={e.id}>
                    {pickable ? (
                      <button type="button" className={cls} onClick={() => onPick(e.id)} title={`Put ${e.name} up next`}>
                        {chip}
                      </button>
                    ) : (
                      <span className={cls}>{chip}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

const EVENT_TEXT: Record<string, string> = {
  sold: 'sold to',
  unsold: 'went unsold',
  auto_assign: 'auto-assigned to',
  manual_assign: 'moved by admin to',
  undo: 'decision undone',
  bid_retracted: 'bid retracted —',
  skip: 'skipped',
  pause: 'Auction paused',
  resume: 'Auction resumed',
  finalized: 'Teams locked in',
}

export function ActivityFeed({ state, d, limit = 10 }: { state: AuctionState; d: Derived; limit?: number }) {
  const names = new Map(state.entries.map((e) => [e.id, e.name]))
  const items = state.events.filter((e) => e.type !== 'phase_change').slice(0, limit)
  return (
    <section aria-label="Activity" className="rounded-2xl border border-ka-line bg-ka-surface">
      <h3 className="border-b border-ka-line px-4 py-2 text-xs font-bold uppercase tracking-wider text-ka-muted">Activity</h3>
      {items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-ka-muted">Nothing yet.</p>
      ) : (
        <ol className="max-h-64 overflow-y-auto">
          {items.map((ev) => {
            const team = ev.teamId ? d.teamById.get(ev.teamId) : null
            const who = ev.entryId ? names.get(ev.entryId) : null
            return (
              <li key={ev.id} className={cn('flex items-center gap-2 border-b border-ka-line px-4 py-1.5 text-sm last:border-0', ev.undone && 'line-through opacity-50')}>
                <span className="flex-1">
                  {who && <b>{who} </b>}
                  <span className="text-ka-muted">{EVENT_TEXT[ev.type] ?? ev.type}</span>
                  {team && <> {team.name}</>}
                </span>
                {ev.amount != null && <span className="ka-tabular font-semibold">{formatMoney(ev.amount)}</span>}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
