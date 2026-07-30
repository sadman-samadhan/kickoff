/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import { dismissBroadcastAction } from '@/app/(dashboard)/admin/actions'

interface BroadcastBannerProps {
  broadcast: {
    id: string
    title: string
    message: string
    created_at: string
  } | null
}

export function SystemBroadcastBanner({ broadcast }: BroadcastBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (!broadcast || isDismissed) return null

  const handleDismiss = async () => {
    setIsDismissed(true)
    try {
      await dismissBroadcastAction(broadcast.id)
    } catch (e) {
      console.error('Failed to record broadcast dismissal:', e)
    }
  }

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white rounded-2xl p-4 shadow-lg border border-amber-400/40 relative animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
          <Megaphone className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded text-amber-100">
              System Announcement
            </span>
          </div>
          <h4 className="text-sm font-black tracking-tight text-white leading-snug">
            {broadcast.title}
          </h4>
          <p className="text-xs text-amber-50 mt-1 leading-relaxed font-medium">
            {broadcast.message}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/20 text-amber-100 transition-colors"
          title="Dismiss Banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
