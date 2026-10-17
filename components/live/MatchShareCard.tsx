'use client'

import { useRef, useState } from 'react'
import { Crown, Download, Loader2, Share2, X } from 'lucide-react'
import { toPng } from '@/lib/toPng'
import type { LiveTeam } from '@/lib/live/types'
import { kit } from './kit'

type Scorer = { id: string; name: string; minute: number; ownGoal: boolean }

/** Full-time result card (PNG via html-to-image). Ported from the old game page; restyled in Phase 6. */
export function MatchShareCard({
  matchNumber, stageName, home, away, score, homeScorers, awayScorers, mvpName, onClose,
}: {
  matchNumber: number | null
  stageName: string | null
  home: LiveTeam | null
  away: LiveTeam | null
  score: { home: number; away: number }
  homeScorers: Scorer[]
  awayScorers: Scorer[]
  mvpName: string | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const fileName = `khelahobe-match-${matchNumber ?? ''}-result.png`

  async function render() {
    if (!ref.current) return null
    return toPng(ref.current, { quality: 1, pixelRatio: 3, cacheBust: true })
  }

  async function share() {
    setBusy(true)
    try {
      const dataUrl = await render()
      if (!dataUrl) return
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Match #${matchNumber} Result — KhelaHobe`,
          text: `${home?.name || 'Home'} ${score.home} - ${score.away} ${away?.name || 'Away'} ⚽`,
          files: [file],
        })
      } else {
        download(dataUrl)
      }
    } catch (e) {
      console.error('Share match card failed:', e)
    } finally {
      setBusy(false)
    }
  }

  function download(dataUrl: string) {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function save() {
    setBusy(true)
    try {
      const dataUrl = await render()
      if (dataUrl) download(dataUrl)
    } finally {
      setBusy(false)
    }
  }

  const Side = ({ team, fallback }: { team: LiveTeam | null; fallback: string }) => (
    <div className="text-center">
      <div
        className="w-11 h-11 rounded-2xl mx-auto mb-1 flex items-center justify-center font-black text-sm shadow border"
        style={{ backgroundColor: kit(team?.jersey_color, fallback).base, color: kit(team?.jersey_color, fallback).ink, borderColor: 'rgba(255,255,255,0.2)' }}
      >
        {(team?.name || '?').charAt(0)}
      </div>
      <span className="text-xs font-bold text-neutral-200 block truncate max-w-[90px]">{team?.name}</span>
    </div>
  )
  const List = ({ list, align }: { list: Scorer[]; align: 'left' | 'right' }) => (
    <div className={`space-y-1 ${align === 'left' ? 'text-left' : 'text-right'} text-neutral-300 font-semibold`}>
      {list.length ? list.map((s) => <div key={s.id}>{s.name} {s.minute}&apos; {s.ownGoal && '(OG)'}</div>) : <span className="text-neutral-500 text-[10px] italic">No goals</span>}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-md flex items-center justify-center p-4 z-[85]" role="dialog" aria-modal="true" aria-label="Share match card">
      <div className="bg-neutral-900 rounded-3xl max-w-sm w-full max-h-[88vh] shadow-2xl flex flex-col border border-neutral-800 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 shrink-0 border-b border-neutral-800">
          <h3 className="font-bold text-base text-white">Share match card</h3>
          <button onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white w-10 h-10 rounded-full hover:bg-neutral-800 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          <div ref={ref} className="bg-neutral-950 text-white rounded-3xl p-5 shadow-xl border border-neutral-800 space-y-4">
            <div className="text-center space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Match Summary • #{matchNumber}
              </span>
              <h3 className="text-base font-black text-white pt-1">{stageName || 'Group Stage'}</h3>
            </div>
            <div className="flex items-center justify-around py-3 bg-neutral-900/90 rounded-2xl border border-neutral-800">
              <Side team={home} fallback="#16a34a" />
              <div className="text-center">
                <div className="text-3xl font-black tracking-tight">{score.home} - {score.away}</div>
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400">FULL-TIME</span>
              </div>
              <Side team={away} fallback="#2563eb" />
            </div>
            {mvpName && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-2.5 text-center space-y-0.5">
                <div className="flex items-center justify-center gap-1 text-amber-400 font-black text-xs uppercase tracking-wider">
                  <Crown className="w-3.5 h-3.5" /> Match MVP
                </div>
                <div className="text-sm font-black">{mvpName}</div>
              </div>
            )}
            <div className="space-y-1.5 pt-1 border-t border-neutral-800">
              <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block text-center">Goal Scorers</span>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-[11px]">
                <List list={homeScorers} align="left" />
                <div className="text-center text-neutral-500">⚽</div>
                <List list={awayScorers} align="right" />
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 shrink-0 border-t border-neutral-800 flex gap-3">
          <button onClick={save} disabled={busy} className="flex-1 h-11 rounded-xl bg-neutral-800 border border-neutral-700 text-white font-bold text-xs flex items-center justify-center gap-1.5">
            <Download className="w-4 h-4" /> Save
          </button>
          <button onClick={share} disabled={busy} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Share2 className="w-4 h-4" /> Share</>}
          </button>
        </div>
      </div>
    </div>
  )
}
