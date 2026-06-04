/* eslint-disable @next/next/no-img-element */
"use client"

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Share2, Download, X, Loader2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MatchdayShareCardProps {
  groupName: string
  matchDate: string
  fieldName: string
  champion: string
  runnersUp: string
  topScorer: string
  winningColor?: string
}

function getDarkGradientFromHex(hexColor: string) {
  let hex = hexColor.replace('#', '')
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('')
  }

  const r = parseInt(hex.substring(0, 2), 16) || 0
  const g = parseInt(hex.substring(2, 4), 16) || 0
  const b = parseInt(hex.substring(4, 6), 16) || 0

  const brightness = (r * 299 + g * 587 + b * 114) / 1000

  // If the color is too dark (like black #000000), fall back to the emerald green theme
  if (brightness < 30) {
    return {
      gradient: 'linear-gradient(135deg, #022c22 0%, #064e3b 40%, #022c22 100%)',
      accent: '#10b981',
      glow: 'rgba(16, 185, 129, 0.25)'
    }
  }

  // If the color is too bright (like white #ffffff), use a sleek charcoal theme
  if (brightness > 200) {
    return {
      gradient: 'linear-gradient(135deg, #171717 0%, #262626 40%, #171717 100%)',
      accent: '#a3a3a3',
      glow: 'rgba(163, 163, 163, 0.15)'
    }
  }

  const rDark1 = Math.round(r * 0.08)
  const gDark1 = Math.round(g * 0.08)
  const bDark1 = Math.round(b * 0.08)

  const rDark2 = Math.round(r * 0.18)
  const gDark2 = Math.round(g * 0.18)
  const bDark2 = Math.round(b * 0.18)

  return {
    gradient: `linear-gradient(135deg, rgb(${rDark1}, ${gDark1}, ${bDark1}) 0%, rgb(${rDark2}, ${gDark2}, ${bDark2}) 40%, rgb(${rDark1}, ${gDark1}, ${bDark1}) 100%)`,
    accent: hexColor,
    glow: `rgba(${r}, ${g}, ${b}, 0.25)`
  }
}

export default function MatchdayShareCard({
  groupName,
  matchDate,
  fieldName,
  champion,
  runnersUp,
  topScorer,
  winningColor,
}: MatchdayShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const theme = winningColor
    ? getDarkGradientFromHex(winningColor)
    : {
      accent: '#10b981', // Emerald green
      gradient: 'linear-gradient(135deg, #022c22 0%, #064e3b 40%, #022c22 100%)', // Pitch theme
      glow: 'rgba(16, 185, 129, 0.25)',
    }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://khelahbe.vercel.app/'
  const displayDomain = siteUrl
    .replace(/https?:\/\//, '')
    .replace(/\/$/, '')

  const handleShare = async () => {
    if (!cardRef.current) return
    setIsGenerating(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 3,
        cacheBust: true,
      })

      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], `khelahobe-matchday-${groupName.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${groupName} Matchday Summary`,
          text: `Check out our matchday summary on KhelaHobe! 🏆 Champion: ${champion}, 🥈 Runner-up: ${runnersUp}, ⚽ Top Scorer: ${topScorer}`,
          files: [file],
        })
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `khelahobe-matchday-${groupName.replace(/\s+/g, '-').toLowerCase()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (e) {
      console.error('Share failed:', e)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (!cardRef.current) return
    setIsGenerating(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 3,
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `khelahobe-matchday-${groupName.replace(/\s+/g, '-').toLowerCase()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      console.error('Download failed:', e)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 mt-4"
        style={{
          backgroundColor: `${theme.accent}15`,
          color: theme.accent,
          border: `1px solid ${theme.accent}30`
        }}
      >
        <Share2 className="w-4 h-4" />
        Share Matchday Report
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-neutral-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-5 py-4">
              <h3 className="font-bold text-white text-lg">Matchday Share Card</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 pb-4">
              <div
                ref={cardRef}
                className="rounded-2xl overflow-hidden relative"
                style={{
                  backgroundImage: "url('/images/match-card.jpeg')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#022c22',
                  padding: '32px 24px',
                }}
              >
                {/* Dark overlay for readability */}
                <div className="absolute inset-0 bg-black/25 pointer-events-none" />

                {/* Content */}
                <div className="relative z-10">
                  {/* Branding */}
                  <div className="flex justify-between items-center mb-6">
                    <span
                      className="text-[10px] font-black uppercase tracking-[0.2em]"
                      style={{ color: theme.accent }}
                    >
                      KhelaHobe
                    </span>
                    <span
                      className="text-[10px] font-black uppercase tracking-[0.15em]"
                      style={{ color: theme.accent }}
                    >
                      Matchday Report
                    </span>
                  </div>

                  {/* Group Info */}
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-black text-white tracking-tight leading-tight mb-1">{groupName}</h2>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{matchDate} @ {fieldName}</p>
                  </div>

                  {/* Central Trophy Graphics */}
                  <div className="flex justify-center mb-6 relative">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center border shadow-lg"
                      style={{ backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}30` }}
                    >
                      <Trophy className="w-10 h-10 text-amber-400 animate-pulse" />
                    </div>
                  </div>

                  {/* Standings & Stats List */}
                  <div className="space-y-3.5 mb-6">
                    {/* Champion */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-lg border border-amber-500/20 flex-shrink-0">
                        🏆
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-black uppercase tracking-widest text-amber-500 leading-none mb-1">Champion</div>
                        <div className="text-sm font-bold text-white truncate">{champion}</div>
                      </div>
                    </div>

                    {/* Runners-up */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-10 h-10 rounded-lg bg-slate-300/10 flex items-center justify-center text-lg border border-slate-300/20 flex-shrink-0">
                        🥈
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-300 leading-none mb-1">Runners-up</div>
                        <div className="text-sm font-bold text-white truncate">{runnersUp}</div>
                      </div>
                    </div>

                    {/* Top Scorer */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg border flex-shrink-0"
                        style={{ backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}30` }}
                      >
                        ⚽
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[9px] font-black uppercase tracking-widest leading-none mb-1"
                          style={{ color: theme.accent }}
                        >
                          Top Scorer
                        </div>
                        <div className="text-sm font-bold text-white truncate">{topScorer}</div>
                      </div>
                    </div>
                  </div>

                  {/* Footer website */}
                  <div className="text-center">
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: theme.accent }}
                    >
                      {displayDomain}
                    </span>
                  </div>

                  {/* Bottom line */}
                  <div
                    className="mt-6 h-[2px] rounded-full mx-auto w-16"
                    style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-4 pb-5 flex gap-3">
              <Button
                onClick={handleDownload}
                disabled={isGenerating}
                variant="outline"
                className="flex-1 h-12 rounded-xl bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Save
              </Button>
              <Button
                onClick={handleShare}
                disabled={isGenerating}
                className="flex-1 h-12 rounded-xl text-white font-bold"
                style={{ backgroundColor: theme.accent }}
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                Share
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
