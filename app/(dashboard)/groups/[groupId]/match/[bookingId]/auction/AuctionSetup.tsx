/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronLeft, Minus, Play, Plus, Save, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initials, onColor } from '@/components/auction/derive'
import { cancelAuction, saveAuctionSetup, startAuction } from './actions'

export type SetupData = {
  groupId: string
  bookingId: string
  groupName: string
  blocked: boolean
  players: { rsvpId: string; playerId: string | null; name: string; avatarUrl: string | null; position: string | null; tier: string | null }[]
  rules: { budget: number; squadSize: number; bidIncrement: number; basePrice: number }
  teams: { name: string; color: string; captainId: string }[]
  tiers: { name: string; color: string; basePrice: number | null }[]
  existingAuctionId: string | null
}

const TEAM_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#eab308', '#7c3aed', '#0f172a', '#e2e8f0', '#ea580c']
const TIER_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fb923c']
const NONE = '__none'

export default function AuctionSetup({ data }: { data: SetupData }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')

  const registered = data.players.filter((p) => p.playerId)
  const [teams, setTeams] = useState(
    data.teams.length
      ? data.teams
      : [0, 1].map((i) => ({ name: `Team ${i + 1}`, color: TEAM_COLORS[i], captainId: '' })),
  )
  const [tiers, setTiers] = useState(data.tiers)
  const [assign, setAssign] = useState<Record<string, string | null>>(() => Object.fromEntries(data.players.map((p) => [p.rsvpId, p.tier])))
  const [brush, setBrush] = useState<string>(data.tiers[0]?.name ?? NONE)
  const [rules, setRules] = useState(data.rules)
  const [squadTouched, setSquadTouched] = useState(data.rules.squadSize > 0)
  const [remember, setRemember] = useState(true)

  const captainIds = new Set(teams.map((t) => t.captainId).filter(Boolean))
  const pool = data.players.filter((p) => !p.playerId || !captainIds.has(p.playerId))
  const autoSquad = Math.max(1, Math.ceil(pool.length / Math.max(1, teams.length)))
  const squadSize = squadTouched ? rules.squadSize : autoSquad
  const tierCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of pool) {
      const t = assign[p.rsvpId] ?? NONE
      m[t] = (m[t] ?? 0) + 1
    }
    return m
  }, [pool, assign])

  const problems = [
    teams.length < 2 && 'Add at least two teams.',
    teams.some((t) => !t.captainId) && 'Pick a captain for every team.',
    captainIds.size !== teams.filter((t) => t.captainId).length && 'Each team needs a different captain.',
    pool.length === 0 && 'Nobody is left in the pool.',
    rules.basePrice * squadSize > rules.budget && 'Budget is too small to fill a squad at the base price.',
  ].filter(Boolean) as string[]

  function setTeam(i: number, patch: Partial<(typeof teams)[number]>) {
    setTeams((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  }

  function save(andStart: boolean) {
    setError('')
    start(async () => {
      const res = await saveAuctionSetup(data.bookingId, data.groupId, {
        rules: { ...rules, squadSize },
        teams,
        tiers,
        assignments: Object.fromEntries(pool.map((p) => [p.rsvpId, assign[p.rsvpId] && tiers.some((t) => t.name === assign[p.rsvpId]) ? assign[p.rsvpId] : null])),
        rememberTiers: remember,
      })
      if (!res.ok) return setError(res.error)
      if (andStart && res.data) {
        const s = await startAuction(res.data.auctionId)
        if (!s.ok) return setError(s.error)
      }
      router.refresh()
    })
  }

  const matchPath = `/groups/${data.groupId}/match/${data.bookingId}`

  if (data.blocked) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 p-6 pt-16 text-center">
        <AlertTriangle className="size-10 text-ka-warn" aria-hidden />
        <h1 className="ka-display text-2xl">Teams already exist</h1>
        <p className="text-sm text-ka-muted">This matchday already has teams or fixtures. Delete them in the Teams tab to run an auction instead.</p>
        <Link href={`${matchPath}?tab=teams`} className="inline-flex h-11 items-center gap-1 rounded-xl border border-ka-line px-4 font-semibold">
          <ChevronLeft className="size-4" /> Back to teams
        </Link>
      </div>
    )
  }

  const input = 'h-11 w-full rounded-xl border border-ka-line bg-ka-surface px-3 text-base text-ka-ink focus:border-ka-primary focus:outline-none'

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 p-4 pb-32">
      <div className="flex items-center gap-3">
        <Link href={`${matchPath}?tab=teams`} aria-label="Back to matchday" className="inline-flex size-11 items-center justify-center rounded-full border border-ka-line bg-ka-surface">
          <ChevronLeft className="size-5" />
        </Link>
        <div>
          <p className="text-xs font-semibold text-ka-muted">{data.groupName}</p>
          <h1 className="ka-display text-2xl">Set up the auction</h1>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-ka-danger/40 bg-ka-danger/10 px-3 py-2 text-sm text-ka-danger">{error}</p>}

      {/* Teams & captains */}
      <section className="flex flex-col gap-3 rounded-2xl border border-ka-line bg-ka-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="ka-display text-lg">Teams & captains</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Remove a team"
              disabled={teams.length <= 2}
              onClick={() => setTeams((t) => t.slice(0, -1))}
              className="inline-flex size-10 items-center justify-center rounded-full border border-ka-line disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span className="ka-display w-6 text-center text-xl">{teams.length}</span>
            <button
              type="button"
              aria-label="Add a team"
              disabled={teams.length >= 8}
              onClick={() => setTeams((t) => [...t, { name: `Team ${t.length + 1}`, color: TEAM_COLORS[t.length % TEAM_COLORS.length], captainId: '' }])}
              className="inline-flex size-10 items-center justify-center rounded-full border border-ka-line disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-ka-muted">Captains bid from their own phone, so they must be registered players confirmed for this matchday.</p>
        {teams.map((t, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-ka-line p-3">
            <div className="flex gap-2">
              <input aria-label={`Team ${i + 1} name`} className={input} value={t.name} onChange={(e) => setTeam(i, { name: e.target.value })} />
              <select
                aria-label={`Team ${i + 1} captain`}
                className={cn(input, 'w-44')}
                value={t.captainId}
                onChange={(e) => setTeam(i, { captainId: e.target.value })}
              >
                <option value="">Captain…</option>
                {registered
                  .filter((p) => p.playerId === t.captainId || !captainIds.has(p.playerId!))
                  .map((p) => (
                    <option key={p.playerId} value={p.playerId!}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Team ${i + 1} colour`}>
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={t.color === c}
                  aria-label={c}
                  onClick={() => setTeam(i, { color: c })}
                  className={cn('size-9 rounded-full border-2', t.color === c ? 'border-ka-ink' : 'border-ka-line')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Rules */}
      <section className="flex flex-col gap-3 rounded-2xl border border-ka-line bg-ka-surface p-4">
        <h2 className="ka-display text-lg">Money</h2>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['budget', 'Budget per team'],
              ['bidIncrement', 'Bid step'],
              ['basePrice', 'Lowest opening bid'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex flex-col gap-1 text-sm font-semibold">
              {label}
              <input
                inputMode="numeric"
                className={input}
                value={rules[k]}
                onChange={(e) => setRules({ ...rules, [k]: Number(e.target.value.replace(/\D/g, '')) || 0 })}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Players per team
            <input
              inputMode="numeric"
              className={input}
              value={squadSize}
              onChange={(e) => {
                setSquadTouched(true)
                setRules({ ...rules, squadSize: Number(e.target.value.replace(/\D/g, '')) || 0 })
              }}
            />
          </label>
        </div>
        <p className="text-xs text-ka-muted">
          {pool.length} players in the pool for {teams.length} teams. Captains aren&apos;t bought.
        </p>
      </section>

      {/* Tiers */}
      <section className="flex flex-col gap-3 rounded-2xl border border-ka-line bg-ka-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="ka-display text-lg">Tiers</h2>
          <button
            type="button"
            onClick={() => setTiers((t) => [...t, { name: `Tier ${t.length + 1}`, color: TIER_COLORS[t.length % TIER_COLORS.length], basePrice: null }])}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-ka-line px-3 text-sm font-semibold"
          >
            <Plus className="size-4" /> Tier
          </button>
        </div>
        <p className="text-xs text-ka-muted">Players come up tier by tier, shuffled within each tier. Pick a tier, then tap players to put them in it.</p>
        <div className="flex flex-wrap gap-2">
          {tiers.map((t, i) => (
            <div key={i} className={cn('flex items-center gap-1 rounded-xl border-2 p-1', brush === t.name ? 'border-ka-ink' : 'border-transparent')}>
              <button type="button" onClick={() => setBrush(t.name)} className="inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-bold" style={{ background: `${t.color}26`, color: t.color }}>
                <span className="size-3 rounded-full" style={{ background: t.color }} aria-hidden />
                {t.name} · {tierCounts[t.name] ?? 0}
              </button>
              <input
                aria-label={`Rename ${t.name}`}
                className="h-9 w-24 rounded-lg border border-ka-line bg-ka-surface px-2 text-sm"
                value={t.name}
                onChange={(e) => {
                  const name = e.target.value
                  setAssign((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v === t.name ? name : v])))
                  if (brush === t.name) setBrush(name)
                  setTiers((ts) => ts.map((x, j) => (j === i ? { ...x, name } : x)))
                }}
              />
              <button
                type="button"
                aria-label={`Remove ${t.name}`}
                onClick={() => setTiers((ts) => ts.filter((_, j) => j !== i))}
                className="inline-flex size-9 items-center justify-center rounded-lg text-ka-muted hover:text-ka-danger"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBrush(NONE)}
            className={cn('inline-flex h-11 items-center rounded-xl border-2 px-3 text-sm font-bold text-ka-muted', brush === NONE ? 'border-ka-ink' : 'border-ka-line')}
          >
            No tier · {tierCounts[NONE] ?? 0}
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {pool.map((p) => {
            const tier = tiers.find((t) => t.name === assign[p.rsvpId])
            return (
              <li key={p.rsvpId}>
                <button
                  type="button"
                  onClick={() => setAssign((a) => ({ ...a, [p.rsvpId]: brush === NONE ? null : brush }))}
                  className="flex min-h-12 w-full items-center gap-2 rounded-xl border-2 px-2 py-1.5 text-left"
                  style={{ borderColor: tier ? tier.color : 'var(--ka-line)' }}
                >
                  <span
                    className="inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold"
                    style={{ background: tier?.color ?? 'var(--ka-soft)', color: tier ? onColor(tier.color) : 'var(--ka-muted)' }}
                  >
                    {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block text-[11px] text-ka-muted">
                      {tier?.name ?? 'No tier'}
                      {p.playerId ? '' : ' · guest'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--ka-primary)]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember tiers for next matchday
        </label>
      </section>

      {problems.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl border border-ka-warn/50 bg-ka-warn/10 px-3 py-2 text-sm">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-[76px] z-30 border-t border-ka-line bg-ka-surface/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          {data.existingAuctionId && (
            <button
              type="button"
              aria-label="Cancel auction"
              disabled={pending}
              onClick={() => {
                if (confirm('Cancel this auction? Its teams will be removed.'))
                  start(async () => {
                    const r = await cancelAuction(data.existingAuctionId!)
                    if (!r.ok) return setError(r.error)
                    router.push(`${matchPath}?tab=teams`)
                  })
              }}
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-ka-line text-ka-danger"
            >
              <Trash2 className="size-5" />
            </button>
          )}
          <button type="button" disabled={pending || problems.length > 0} onClick={() => save(false)} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-ka-line font-bold disabled:opacity-50">
            <Save className="size-4" /> Save
          </button>
          <button
            type="button"
            disabled={pending || problems.length > 0}
            onClick={() => confirm('Start the auction now? Captains will get a notification.') && save(true)}
            className="ka-display inline-flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-ka-primary text-lg text-ka-on-primary disabled:opacity-50"
          >
            <Play className="size-4" /> Start auction
          </button>
        </div>
      </div>
    </div>
  )
}
