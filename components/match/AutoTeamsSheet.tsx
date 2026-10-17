'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Loader2, Minus, Plus, Shuffle, Sparkles, X } from 'lucide-react'
import { proposeAutoTeams, type AutoTeamsProposal, type AutoTeamPlayer } from '@/app/(dashboard)/groups/[groupId]/match/[bookingId]/autoTeamsActions'
import { saveTeamsAction } from '@/app/(dashboard)/groups/[groupId]/match/[bookingId]/actions'

const KITS = [
  { name: 'Red', color: '#ef4444' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Black', color: '#111827' },
  { name: 'White', color: '#ffffff' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Purple', color: '#8b5cf6' },
]

const POS_STYLE: Record<string, string> = {
  GK: 'bg-amber-100 text-amber-800',
  DEF: 'bg-green-100 text-green-800',
  MID: 'bg-blue-100 text-blue-800',
  ATT: 'bg-red-100 text-red-800',
}

function avg(players: AutoTeamPlayer[]) {
  return players.reduce((s, p) => s + p.strength, 0) / Math.max(1, players.length)
}

/** Admin-only: suggest balanced teams from confirmed players, let the admin tweak, then save as normal teams. */
export function AutoTeamsSheet({
  bookingId,
  groupId,
  playerCount,
  onClose,
}: {
  bookingId: string
  groupId: string
  playerCount: number
  onClose: () => void
}) {
  const router = useRouter()
  const [numTeams, setNumTeams] = useState(playerCount >= 15 ? 3 : 2)
  const [proposal, setProposal] = useState<AutoTeamsProposal | null>(null)
  const [teams, setTeams] = useState<AutoTeamPlayer[][]>([])
  const [selected, setSelected] = useState<{ team: number; index: number } | null>(null)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const [saving, startSave] = useTransition()

  function suggest(seed = Math.floor(Math.random() * 1e9)) {
    setError('')
    setSelected(null)
    start(async () => {
      const r = await proposeAutoTeams(bookingId, groupId, numTeams, seed)
      if (!r.ok) return setError(r.error)
      setProposal(r.data)
      setTeams(r.data.teams.map((t) => t.players))
    })
  }

  function tap(team: number, index: number) {
    if (!selected) return setSelected({ team, index })
    if (selected.team === team) return setSelected(selected.index === index ? null : { team, index })
    setTeams((ts) => {
      const next = ts.map((t) => [...t])
      const a = next[selected.team][selected.index]
      next[selected.team][selected.index] = next[team][index]
      next[team][index] = a
      return next
    })
    setSelected(null)
  }

  function save() {
    setError('')
    startSave(async () => {
      try {
        await saveTeamsAction(
          bookingId,
          groupId,
          teams.map((players, i) => {
            const kit = KITS[i % KITS.length]
            const captain = [...players].filter((p) => !p.isGuest).sort((a, b) => b.strength - a.strength)[0]
            return { name: kit.name, jerseyColor: kit.color, captainId: captain?.id || '', playerIds: players.map((p) => p.id) }
          }),
        )
        router.refresh()
        onClose()
      } catch (e) {
        setError((e as Error).message || 'Could not save the teams')
      }
    })
  }

  const avgs = teams.map(avg)
  const maxAvg = Math.max(...avgs, 1)
  const minAvg = Math.min(...avgs, maxAvg)
  const spreadPct = teams.length ? Math.round((100 * (maxAvg - minAvg)) / maxAvg) : 0

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Auto-make teams">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-100">
          <h3 className="font-black text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-green-600" /> Suggested teams
          </h3>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full hover:bg-neutral-100 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-neutral-700">{playerCount} players into</span>
            <div className="flex items-center gap-2">
              <button aria-label="Fewer teams" disabled={numTeams <= 2} onClick={() => setNumTeams((n) => n - 1)} className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center disabled:opacity-40">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-16 text-center font-black text-lg">{numTeams} teams</span>
              <button aria-label="More teams" disabled={numTeams >= Math.min(8, playerCount)} onClick={() => setNumTeams((n) => n + 1)} className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center disabled:opacity-40">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</p>}

          {!proposal ? (
            <p className="text-sm text-neutral-500">
              Makes teams with equal numbers, one keeper each where possible, positions spread out, and strong players split up.
              Strength is learned from this group&apos;s past results and goal involvement; new players and guests count as average.
            </p>
          ) : (
            <>
              <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-3 py-2 text-xs text-neutral-600">
                Based on {proposal.matchesUsed} past matches · {proposal.ratedPlayers} of {playerCount} players have history.
                {' '}Teams are within <b>{spreadPct}%</b> of each other. Tap two players in different teams to swap them.
              </div>
              <div className="grid gap-3">
                {teams.map((players, ti) => {
                  const kit = KITS[ti % KITS.length]
                  const strengthPct = Math.round((100 * avgs[ti]) / maxAvg)
                  return (
                    <section key={ti} className="rounded-2xl border border-neutral-200 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50">
                        <span className="w-4 h-4 rounded-full border border-neutral-300" style={{ background: kit.color }} aria-hidden />
                        <span className="font-black flex-1">{kit.name}</span>
                        <span className="text-xs text-neutral-500">{players.length} players</span>
                      </div>
                      <div className="px-3 pt-2">
                        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden" aria-label={`Strength ${strengthPct}%`}>
                          <div className="h-full bg-green-500" style={{ width: `${strengthPct}%` }} />
                        </div>
                      </div>
                      <ul className="p-2 grid grid-cols-2 gap-1.5">
                        {players.map((p, pi) => {
                          const isSel = selected?.team === ti && selected.index === pi
                          return (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => tap(ti, pi)}
                                className={`w-full min-h-11 flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-sm ${isSel ? 'border-green-600 bg-green-50 ring-2 ring-green-600' : 'border-neutral-200'}`}
                              >
                                <span className="flex-1 truncate font-semibold">{p.name}</span>
                                {p.position && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${POS_STYLE[p.position] || 'bg-neutral-100'}`}>{p.position}</span>}
                                {p.isGuest && <span className="text-[10px] text-neutral-400">guest</span>}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )
                })}
              </div>
              {selected && (
                <p className="text-xs text-green-700 flex items-center gap-1">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Now tap a player in another team to swap.
                </p>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-neutral-100 flex gap-2">
          {!proposal ? (
            <button onClick={() => suggest()} disabled={pending} className="flex-1 h-12 rounded-xl bg-neutral-900 text-white font-bold flex items-center justify-center gap-2">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Suggest teams
            </button>
          ) : (
            <>
              <button onClick={() => suggest()} disabled={pending || saving} className="h-12 px-4 rounded-xl border border-neutral-200 font-bold flex items-center justify-center gap-2">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />} Shuffle
              </button>
              <button onClick={save} disabled={pending || saving} className="flex-1 h-12 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save these teams
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
