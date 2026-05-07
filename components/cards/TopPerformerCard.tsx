"use client"

interface TopPerformerCardProps {
  title: string
  emoji: string
  player: { full_name: string; avatar_url?: string | null } | null
  statValue: number
  statLabel: string
}

export function TopPerformerCard({ title, emoji, player, statValue, statLabel }: TopPerformerCardProps) {
  if (!player) {
    return (
      <div className="bg-gradient-to-b from-green-50 to-white rounded-2xl shadow-sm border border-neutral-100 p-4 flex flex-col items-center text-center min-h-[180px] justify-center">
        <span className="text-3xl mb-2">{emoji}</span>
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{title}</span>
        <span className="text-xs text-neutral-400 mt-2">No data yet</span>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-b from-green-50 to-white rounded-2xl shadow-sm border border-neutral-100 p-4 flex flex-col items-center text-center">
      <span className="text-3xl mb-2">{emoji}</span>
      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-3">{title}</span>

      {player.avatar_url ? (
        <img src={player.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover mb-2 border-2 border-white shadow-sm" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-lg mb-2 border-2 border-white shadow-sm">
          {player.full_name?.charAt(0)}
        </div>
      )}

      <span className="text-xs font-bold text-neutral-800 truncate max-w-full">{player.full_name}</span>
      <span className="text-2xl font-black text-green-600 mt-1">{statValue}</span>
      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">{statLabel}</span>
    </div>
  )
}
