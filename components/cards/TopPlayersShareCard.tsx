/* eslint-disable @next/next/no-img-element */
"use client"

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { QRCodeSVG } from 'qrcode.react'
import { Share2, Download, X, Loader2, Star, Award, Shield, Target, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface TopPlayerItem {
  id: string
  name: string
  position: string
  points: number
  goals?: number
  assists?: number
  cleanSheets?: number
  teamName?: string
  avatarUrl?: string
  motmCount?: number
}

interface TopPlayersShareCardProps {
  groupName: string
  matchDate: string
  fieldName: string
  topPlayers: TopPlayerItem[]
  topScorer?: { name: string; goals: number } | null
  topMidfielder?: { name: string; assists: number; points: number } | null
  topDefenderGk?: { name: string; position: string; cleanSheets: number; points: number } | null
}

export default function TopPlayersShareCard({
  groupName,
  matchDate,
  fieldName,
  topPlayers,
  topScorer,
  topMidfielder,
  topDefenderGk
}: TopPlayersShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const top3 = topPlayers.slice(0, 3)

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
      const fileName = `khelahobe-top-players-${groupName.replace(/\s+/g, '-').toLowerCase()}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        const top1 = top3[0] ? `${top3[0].name} (${top3[0].points} PTS)` : ''
        await navigator.share({
          title: `${groupName} Matchday Top Players`,
          text: `Check out our matchday top players on KhelaHobe! 🏆 1st: ${top1}`,
          files: [file],
        })
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = fileName
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
      link.download = `khelahobe-top-players-${groupName.replace(/\s+/g, '-').toLowerCase()}.png`
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
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 mt-4 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20"
      >
        <Share2 className="w-4 h-4" />
        Share Top Players
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="bg-neutral-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
            <div className="flex justify-between items-center px-5 py-4">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" /> Top Players Share Card
              </h3>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 pb-4">
              <div
                ref={cardRef}
                className="rounded-2xl overflow-hidden relative text-white"
                style={{
                  backgroundImage: "url('/images/match-card-green.jpeg')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#022c22',
                  padding: '28px 20px',
                }}
              >
                {/* Dark overlay for readability */}
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />

                {/* Content */}
                <div className="relative z-10 space-y-4">
                  {/* Branding */}
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                      KhelaHobe
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-400">
                      Matchday Stars ⭐
                    </span>
                  </div>

                  {/* Group Info */}
                  <div className="text-center">
                    <h2 className="text-lg font-black text-white tracking-tight leading-tight mb-0.5">{groupName}</h2>
                    <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest">{matchDate} @ {fieldName}</p>
                  </div>

                  {/* TOP 3 PODIUM LIST */}
                  <div className="space-y-2">
                    <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest text-center">
                      🏆 TOP 3 PLAYERS OF THE MATCHDAY
                    </div>

                    {top3.map((player, idx) => {
                      const badges = ['🥇', '🥈', '🥉']
                      const borderColors = ['border-amber-400/40 bg-amber-400/10', 'border-slate-300/40 bg-slate-300/10', 'border-amber-600/40 bg-amber-600/10']

                      return (
                        <div
                          key={player.id || idx}
                          className={`flex items-center justify-between p-2.5 rounded-xl border backdrop-blur-xs ${borderColors[idx] || 'border-white/10 bg-white/5'}`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className="text-base flex-shrink-0">{badges[idx]}</span>
                            {player.avatarUrl ? (
                              <img src={player.avatarUrl} className="w-8 h-8 rounded-full border border-white/20 object-cover shrink-0" alt={player.name} />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-500/30">
                                {player.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                                {player.name}
                                {player.motmCount ? <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" /> : null}
                              </div>
                              <div className="text-[9px] text-white/60 font-semibold uppercase">
                                {player.position} {player.teamName ? `• ${player.teamName}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-sm font-black text-emerald-400">
                              {player.points} <span className="text-[9px] text-white/80 font-normal">PTS</span>
                            </div>
                            <div className="text-[8px] text-white/60 font-medium">
                              {player.goals ? `${player.goals}G ` : ''}{player.assists ? `${player.assists}A` : ''}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* CATEGORY AWARDS / HIGHLIGHTS */}
                  <div className="space-y-1.5 pt-2 border-t border-white/10">
                    <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest text-center">
                      🎖️ CATEGORY AWARDS
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {/* Top Scorer */}
                      <div className="bg-white/5 border border-white/10 p-2 rounded-xl">
                        <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                        <div className="text-[8px] font-black text-amber-400 uppercase">Top Scorer</div>
                        <div className="text-[10px] font-bold text-white truncate mt-0.5">
                          {topScorer?.name || 'N/A'}
                        </div>
                        {topScorer && (
                          <div className="text-[8px] text-white font-semibold">{topScorer.goals} Goals</div>
                        )}
                      </div>

                      {/* Top Midfielder */}
                      <div className="bg-white/5 border border-white/10 p-2 rounded-xl">
                        <Target className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                        <div className="text-[8px] font-black text-sky-400 uppercase">Top Mid</div>
                        <div className="text-[10px] font-bold text-white truncate mt-0.5">
                          {topMidfielder?.name || 'N/A'}
                        </div>
                        {topMidfielder && (
                          <div className="text-[8px] text-white font-semibold">{topMidfielder.assists} Assists</div>
                        )}
                      </div>

                      {/* Top Defender / GK */}
                      <div className="bg-white/5 border border-white/10 p-2 rounded-xl">
                        <Shield className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                        <div className="text-[8px] font-black text-emerald-400 uppercase">Top Def/GK</div>
                        <div className="text-[10px] font-bold text-white truncate mt-0.5">
                          {topDefenderGk?.name || 'N/A'}
                        </div>
                        {topDefenderGk && (
                          <div className="text-[8px] text-white font-semibold">{topDefenderGk.cleanSheets} CS</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer website + QR Code */}
                  <div className="flex flex-col items-center justify-center pt-3 pb-1 gap-1.5">
                    <div className="p-1.5 bg-white rounded-xl shadow-md border border-white/20">
                      <QRCodeSVG
                        value="https://khelahbe.vercel.app/"
                        size={56}
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                        level="M"
                      />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                      {displayDomain}
                    </span>
                  </div>
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
                className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
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
