'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Share2, X } from 'lucide-react'
import { formatMoney } from '@/lib/auctionRules'
import type { AuctionEntry, AuctionTeam, AuctionTier } from '@/lib/auction/types'
import { toPng } from '@/lib/toPng'
import { Wordmark } from '@/components/brand/BrandLogo'
import { initials, onColor } from './derive'

type Props = { entry: AuctionEntry; team: AuctionTeam; tier: AuctionTier | null; title: string; subtitle: string }

/** Light: "Kit Colours" card in the buying team's colour. Dark: "Floodlight" card. 432×540 → 1080×1350 export. */
function SoldCardArt({ entry, team, tier, title, subtitle, dark }: Props & { dark: boolean }) {
  const ink = onColor(team.color)
  if (dark) {
    return (
      <div style={{ width: 432, height: 540, background: '#020617', color: '#f8fafc', fontFamily: 'var(--font-ka-barlow), sans-serif', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 28, boxSizing: 'border-box' }}>
        <div style={{ position: 'absolute', right: -120, top: -120, width: 420, height: 420, background: `radial-gradient(closest-side, ${team.color}66, transparent)` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8' }}>{title}</span>
          {tier && <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: tier.color, border: `1px solid ${tier.color}88`, borderRadius: 999, padding: '3px 8px' }}>{tier.name}</span>}
        </div>
        <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
          <span style={{ width: 104, height: 104, borderRadius: 999, background: tier?.color ?? '#64748b', color: onColor(tier?.color ?? '#64748b'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-ka-barlow-condensed), sans-serif', fontWeight: 800, fontSize: 44 }}>{initials(entry.name)}</span>
          <div>
            <div style={{ fontFamily: 'var(--font-ka-barlow-condensed), sans-serif', fontWeight: 800, fontSize: 60, textTransform: 'uppercase', lineHeight: 0.9 }}>{entry.name}</div>
            <div style={{ fontSize: 15, color: '#cbd5e1', marginTop: 8 }}>goes to <b style={{ color: team.color === '#e2e8f0' ? '#f8fafc' : team.color }}>{team.name}</b></div>
          </div>
        </div>
        <div style={{ marginTop: 34, fontFamily: 'var(--font-ka-barlow-condensed), sans-serif', fontWeight: 800, fontSize: 116, lineHeight: 0.8, color: '#4ade80', position: 'relative' }}>{formatMoney(entry.soldPrice)}</div>
        <span style={{ position: 'absolute', right: 26, top: 168, transform: 'rotate(-12deg)', border: '5px solid #4ade80', color: '#4ade80', borderRadius: 12, padding: '0 14px', fontFamily: 'var(--font-ka-barlow-condensed), sans-serif', fontWeight: 800, fontSize: 52, letterSpacing: '0.06em' }}>SOLD</span>
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', position: 'relative' }}>
          <span>{subtitle}</span>
          <span style={{ color: '#f8fafc', ['--app-primary' as string]: '#4ade80' }}><Wordmark size={18} /></span>
        </div>
      </div>
    )
  }
  return (
    <div style={{ width: 432, height: 540, background: team.color, color: ink, fontFamily: 'var(--font-ka-figtree), sans-serif', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ padding: '22px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-ka-archivo), sans-serif', fontWeight: 800, fontSize: 16 }}>{team.name}</span>
        {tier && <span style={{ fontSize: 12, fontWeight: 700 }}>{tier.name}</span>}
      </div>
      <div style={{ padding: '0 24px' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Signed for</div>
        <div style={{ fontFamily: 'var(--font-ka-archivo), sans-serif', fontWeight: 800, fontSize: 120, lineHeight: 0.85, letterSpacing: '-0.02em' }}>{formatMoney(entry.soldPrice)}</div>
      </div>
      <div style={{ margin: '24px 24px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ width: 92, height: 92, borderRadius: 20, background: ink, color: team.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-ka-archivo), sans-serif', fontWeight: 800, fontSize: 38 }}>{initials(entry.name)}</span>
        <div style={{ fontFamily: 'var(--font-ka-archivo), sans-serif', fontWeight: 800, fontSize: 50, lineHeight: 0.95 }}>{entry.name}</div>
      </div>
      <span style={{ position: 'absolute', right: 22, top: 70, transform: 'rotate(10deg)', background: ink, color: team.color, borderRadius: 10, padding: '4px 14px', fontFamily: 'var(--font-ka-archivo), sans-serif', fontWeight: 800, fontSize: 38, letterSpacing: '0.06em' }}>SOLD</span>
      <div style={{ marginTop: 'auto', background: ink, color: team.color, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>{subtitle}</span>
        <span style={{ ['--app-primary' as string]: '#15803d' }}><Wordmark size={16} /></span>
      </div>
    </div>
  )
}

function usePrefersDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setDark(mq.matches || document.documentElement.classList.contains('dark'))
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return dark
}

export function SoldCardModal({ onClose, ...props }: Props & { onClose: () => void }) {
  const dark = usePrefersDark()
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  async function render() {
    const url = await toPng(ref.current!, { pixelRatio: 2.5, cacheBust: true })
    const blob = await (await fetch(url)).blob()
    return { url, file: new File([blob], `${props.entry.name.replace(/\W+/g, '-').toLowerCase()}-sold.png`, { type: 'image/png' }) }
  }
  async function share() {
    setBusy(true)
    try {
      const { url, file } = await render()
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${props.entry.name} sold` })
      else download(url, file.name)
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    setBusy(true)
    try {
      const { url, file } = await render()
      download(url, file.name)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="SOLD card">
      <div className="flex max-h-[92vh] w-full max-w-[464px] flex-col gap-3 overflow-y-auto rounded-3xl bg-ka-surface p-4">
        <div className="flex items-center justify-between">
          <span className="ka-display text-lg">Share SOLD card</span>
          <button onClick={onClose} aria-label="Close" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ka-soft">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex justify-center">
          <div style={{ transform: 'scale(var(--s, 1))' }} className="origin-top">
            <div ref={ref}>
              <SoldCardArt {...props} dark={dark} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={save} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-ka-line font-bold">
            <Download className="size-4" /> Save
          </button>
          <button onClick={share} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ka-primary font-bold text-ka-on-primary">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} Share
          </button>
        </div>
      </div>
    </div>
  )
}

function download(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}
