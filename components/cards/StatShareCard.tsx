/* eslint-disable @next/next/no-img-element */
"use client"

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { QRCodeSVG } from 'qrcode.react'
import { Share2, Download, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StatShareCardProps {
  playerName: string
  position: string | null
  avatarUrl: string | null
  goals: number
  assists: number
  cleanSheets: number
  matchesPlayed: number
}

const POSITION_THEMES: Record<string, { accent: string; gradient: string; glow: string; label: string }> = {
  ATT: {
    accent: '#ef4444',
    gradient: 'linear-gradient(135deg, #1a0505 0%, #2d0a0a 30%, #1c0808 70%, #0d0404 100%)',
    glow: 'rgba(239, 68, 68, 0.3)',
    label: 'Forward',
  },
  MID: {
    accent: '#3b82f6',
    gradient: 'linear-gradient(135deg, #050a1a 0%, #0a152d 30%, #08101c 70%, #04080d 100%)',
    glow: 'rgba(59, 130, 246, 0.3)',
    label: 'Midfielder',
  },
  DEF: {
    accent: '#22c55e',
    gradient: 'linear-gradient(135deg, #051a0a 0%, #0a2d15 30%, #081c10 70%, #040d08 100%)',
    glow: 'rgba(34, 197, 94, 0.3)',
    label: 'Defender',
  },
  GK: {
    accent: '#f59e0b',
    gradient: 'linear-gradient(135deg, #1a1505 0%, #2d240a 30%, #1c1c08 70%, #0d0d04 100%)',
    glow: 'rgba(245, 158, 11, 0.3)',
    label: 'Goalkeeper',
  },
}

const DEFAULT_THEME = {
  accent: '#22c55e',
  gradient: 'linear-gradient(135deg, #0a1a0f 0%, #0a2d15 30%, #081c10 70%, #040d08 100%)',
  glow: 'rgba(34, 197, 94, 0.3)',
  label: 'Player',
}

export default function StatShareCard({
  playerName,
  position,
  avatarUrl,
  goals,
  assists,
  cleanSheets,
  matchesPlayed,
}: StatShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const theme = position ? (POSITION_THEMES[position] || DEFAULT_THEME) : DEFAULT_THEME

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

      // Convert to blob for sharing
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], `khelahobe-stats-${playerName.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${playerName}'s KhelaHobe Stats`,
          text: `Check out my stats on KhelaHobe! ⚽ ${goals} Goals, ${assists} Assists, ${cleanSheets} Clean Sheets`,
          files: [file],
        })
      } else {
        // Fallback: download the image
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `khelahobe-stats-${playerName.replace(/\s+/g, '-').toLowerCase()}.png`
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
      link.download = `khelahobe-stats-${playerName.replace(/\s+/g, '-').toLowerCase()}.png`
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
      {/* Share Button - rendered inline wherever you place the component */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 mt-2"
        style={{
          backgroundColor: `${theme.accent}15`,
          color: theme.accent,
          border: `1px solid ${theme.accent}30`
        }}
      >
        <Share2 className="w-4 h-4" />
        Share My Stats
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-neutral-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-5 py-4">
              <h3 className="font-bold text-white text-lg">Your Stats Card</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* The actual card that gets captured */}
            <div className="px-4 pb-4">
              <div
                ref={cardRef}
                className="rounded-2xl overflow-hidden relative"
                style={{
                  backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.7)), url('/images/match-card-green.jpeg')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  padding: '24px 24px',
                }}
              >
                {/* Background decorations */}
                <div
                  className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[80px] pointer-events-none"
                  style={{ background: theme.glow }}
                />
                <div
                  className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-[60px] pointer-events-none"
                  style={{ background: `${theme.accent}15` }}
                />

                {/* Subtle grid pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: `linear-gradient(${theme.accent}40 1px, transparent 1px), linear-gradient(90deg, ${theme.accent}40 1px, transparent 1px)`,
                  backgroundSize: '24px 24px'
                }} />

                {/* Content */}
                <div className="relative z-10">
                  {/* App branding */}
                  <div className="flex justify-between items-center mb-6 relative -top-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">KhelaHobe</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: `${theme.accent}90` }}>
                      Season Recap
                    </span>
                  </div>

                  {/* Avatar + Name */}
                  <div className="flex flex-col items-center mb-8">
                    <div
                      className="w-20 h-20 rounded-full mb-4 flex items-center justify-center text-3xl font-black border-[3px] overflow-hidden"
                      style={{ borderColor: theme.accent, boxShadow: `0 0 25px ${theme.glow}` }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span style={{ color: theme.accent }}>
                          {playerName?.charAt(0) || 'P'}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-black text-white tracking-tight mb-1">{playerName}</h2>
                    <span
                      className="text-xs font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full"
                      style={{
                        color: theme.accent,
                        backgroundColor: `${theme.accent}18`,
                        border: `1px solid ${theme.accent}30`,
                      }}
                    >
                      {theme.label} ({position || 'N/A'})
                    </span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                      { value: goals, label: 'Goals', emoji: '⚽' },
                      { value: assists, label: 'Assists', emoji: '👟' },
                      { value: cleanSheets, label: 'Clean\nSheets', emoji: '🛡️' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl py-4 px-2 text-center relative overflow-hidden"
                        style={{
                          border: `1px solid ${theme.accent}25`,
                          background: `${theme.accent}25`,
                        }}
                      >
                        <div className="text-lg mb-0.5">{stat.emoji}</div>
                        <div className="text-3xl font-black text-white mb-1" style={{ textShadow: `0 0 20px ${theme.glow}` }}>
                          {stat.value}
                        </div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/50 whitespace-pre-line leading-tight">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Matches played */}
                  <div className="text-center mt-3 relative -top-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                      {matchesPlayed} Matches Played
                    </span>
                  </div>

                  {/* Project URL + QR Code */}
                  <div className="flex flex-col items-center justify-center pt-2 pb-1 gap-1.5 relative -top-3">
                    <div className="p-1.5 bg-white rounded-xl shadow-md border border-white/20">
                      <QRCodeSVG
                        value="https://khelahbe.vercel.app/"
                        size={54}
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                        level="M"
                      />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/70">
                      {displayDomain}
                    </span>
                  </div>

                  {/* Bottom accent line */}
                  <div
                    className="mt-4 h-[2px] rounded-full mx-auto w-16 relative -top-2"
                    style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
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
