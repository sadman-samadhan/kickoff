'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Share2 } from 'lucide-react'
import { Sheet, Tabs } from '@/components/ui/kit'
import { useTheme } from '@/components/theme/ThemeProvider'
import { CARD_WIDTH, cardHeight, useShareImage, type CardFormat, type ShareMeta } from './useShareImage'
import type { CardStyle } from './cards'

/**
 * The one share dialog for every card: pick Post (4:5) or Story (9:16) and the Kit Colours or Floodlight
 * look (defaults to the app theme), preview it, then share or save a 1080px PNG.
 */
export function ShareSheet({
  title, meta, onClose, children, formats = ['post', 'story'],
}: {
  title: string
  meta: ShareMeta
  onClose: () => void
  children: (opts: { format: CardFormat; style: CardStyle }) => React.ReactNode
  formats?: CardFormat[]
}) {
  const { resolved } = useTheme()
  const [format, setFormat] = useState<CardFormat>(formats[0])
  const [style, setStyle] = useState<CardStyle>(resolved === 'dark' ? 'floodlight' : 'kit')
  const cardRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [boxWidth, setBoxWidth] = useState(300)
  const { busy, error, share, save } = useShareImage()

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth))
    ro.observe(el)
    setBoxWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const h = cardHeight(format)
  // Fit the card in the dialog: by width, and stories also by height so the buttons stay on screen.
  const maxH = typeof window !== 'undefined' ? window.innerHeight * 0.52 : 420
  const scale = Math.min(boxWidth / CARD_WIDTH, maxH / h, 1)

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        {formats.length > 1 && (
          <Tabs stretch className="flex-1 min-w-[180px]" label="Format" value={format} onChange={setFormat} items={[{ key: 'post', label: 'Post 4:5' }, { key: 'story', label: 'Story 9:16' }]} />
        )}
        <Tabs stretch className="flex-1 min-w-[180px]" label="Style" value={style} onChange={setStyle} items={[{ key: 'kit', label: 'Kit' }, { key: 'floodlight', label: 'Floodlight' }]} />
      </div>

      <div ref={boxRef} className="w-full flex justify-center">
        <div style={{ width: CARD_WIDTH * scale, height: h * scale }} className="rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/10">
          <div style={{ width: CARD_WIDTH, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div ref={cardRef} className="no-dark" style={{ width: CARD_WIDTH, height: h }}>
              {children({ format, style })}
            </div>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 text-center">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => save(cardRef.current, format, meta)}
          className="h-12 rounded-2xl border border-app-line bg-app-surface font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Download className="w-4 h-4" /> Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => share(cardRef.current, format, meta)}
          className="h-12 rounded-2xl bg-app-primary text-app-on-primary font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Share
        </button>
      </div>
    </Sheet>
  )
}
