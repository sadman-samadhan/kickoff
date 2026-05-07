"use client"

import Image from 'next/image'
import { Goal, Target, Shield, Activity } from 'lucide-react'

interface PlayerStatCardProps {
  player: {
    player_id: string
    full_name: string
    avatar_url?: string | null
    preferred_position?: string | null
  }
  stats: { goals: number; assists: number; clean_sheets: number; matches_played: number }
  rank: number
}

const positionColors: Record<string, string> = {
  GK: 'bg-amber-100 text-amber-700',
  DEF: 'bg-blue-100 text-blue-700',
  MID: 'bg-green-100 text-green-700',
  ATT: 'bg-red-100 text-red-700',
}

export function PlayerStatCard({ player, stats, rank }: PlayerStatCardProps) {
  const ringColor =
    rank === 1 ? 'ring-2 ring-amber-400 border-amber-200' :
    rank === 2 ? 'ring-2 ring-neutral-300 border-neutral-200' :
    rank === 3 ? 'ring-2 ring-amber-600/50 border-amber-300' :
    'border-neutral-100'

  return (
    <div className={`bg-white rounded-2xl shadow-sm border p-3.5 flex items-center gap-3 ${ringColor}`}>
      <span className="text-lg font-black text-neutral-300 w-6 text-center shrink-0">{rank}</span>

      <div className="shrink-0">
        {player.avatar_url ? (
          <Image src={player.avatar_url || '/icons/icon-192.png'} alt={player.full_name} width={40} height={40} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-sm">
            {player.full_name?.charAt(0)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-neutral-900 truncate">{player.full_name}</span>
          {player.preferred_position && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${positionColors[player.preferred_position] || 'bg-neutral-100 text-neutral-500'}`}>
              {player.preferred_position}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 mt-1">
          <span className="text-[11px] font-bold text-amber-600 flex items-center gap-0.5"><Goal className="w-3 h-3" />{stats.goals}</span>
          <span className="text-[11px] font-bold text-blue-600 flex items-center gap-0.5"><Target className="w-3 h-3" />{stats.assists}</span>
          <span className="text-[11px] font-bold text-purple-600 flex items-center gap-0.5"><Shield className="w-3 h-3" />{stats.clean_sheets}</span>
          <span className="text-[11px] font-bold text-neutral-500 flex items-center gap-0.5"><Activity className="w-3 h-3" />{stats.matches_played}</span>
        </div>
      </div>
    </div>
  )
}
