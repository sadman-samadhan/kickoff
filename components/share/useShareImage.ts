'use client'

import { useState } from 'react'
import { toPng } from '@/lib/toPng'

/** Cards are laid out at 432px wide; exporting at 2.5× gives 1080×1350 (post) or 1080×1920 (story). */
export const CARD_WIDTH = 432
export const EXPORT_SCALE = 2.5
export type CardFormat = 'post' | 'story'
export const cardHeight = (f: CardFormat) => (f === 'post' ? 540 : 768)

export type ShareMeta = { fileName: string; title: string; text?: string }

/** Renders a card node to a PNG data URL at export size. */
export async function renderCard(node: HTMLElement, format: CardFormat) {
  return toPng(node, {
    width: CARD_WIDTH,
    height: cardHeight(format),
    pixelRatio: EXPORT_SCALE,
    cacheBust: true,
  })
}

function download(dataUrl: string, fileName: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Share (phone share sheet) or save a card node as a PNG. */
export function useShareImage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setError('Could not make the image. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const share = (node: HTMLElement | null, format: CardFormat, meta: ShareMeta) =>
    run(async () => {
      if (!node) return
      const dataUrl = await renderCard(node, format)
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], meta.fileName, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: meta.title, text: meta.text, files: [file] })
      } else {
        download(dataUrl, meta.fileName)
      }
    })

  const save = (node: HTMLElement | null, format: CardFormat, meta: ShareMeta) =>
    run(async () => {
      if (!node) return
      download(await renderCard(node, format), meta.fileName)
    })

  return { busy, error, share, save }
}
