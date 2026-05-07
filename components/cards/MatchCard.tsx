"use client"

import { format, parseISO } from 'date-fns'
import { ChevronRight, Clock, MapPin, Users } from 'lucide-react'

interface MatchCardProps {
  booking: {
    id: string
    match_date: string
    match_time: string
    field_name: string
    max_players: number
    confirmed_count?: number
    group_id?: string
  }
  userRsvpStatus?: 'in' | 'out' | 'waitlist' | null
  groupName?: string
  onClick?: () => void
}

export function MatchCard({ booking, userRsvpStatus, groupName, onClick }: MatchCardProps) {
  const borderColor =
    userRsvpStatus === 'in' ? 'border-l-green-500' :
    userRsvpStatus === 'out' ? 'border-l-red-400' :
    'border-l-amber-400'

  const confirmed = booking.confirmed_count ?? 0
  const pct = booking.max_players > 0 ? Math.min((confirmed / booking.max_players) * 100, 100) : 0

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-sm border border-neutral-100 border-l-4 ${borderColor} p-4 cursor-pointer active:scale-[0.98] transition-transform`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {groupName && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
              {groupName}
            </span>
          )}
          {userRsvpStatus === 'in' && (
            <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✅ You&apos;re In</span>
          )}
          {userRsvpStatus === 'out' && (
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">❌ Can&apos;t Make It</span>
          )}
          {(!userRsvpStatus || userRsvpStatus === 'waitlist') && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">❓ Pending</span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0 mt-0.5" />
      </div>

      <h3 className="text-sm font-bold text-neutral-900 mb-1.5">
        {format(parseISO(booking.match_date), 'EEE, d MMM')}
      </h3>

      <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium mb-3">
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{booking.match_time.slice(0, 5)}</span>
        <span className="flex items-center gap-1 truncate"><MapPin className="w-3.5 h-3.5" />{booking.field_name}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-1 shrink-0">
          <Users className="w-3 h-3" />{confirmed}/{booking.max_players}
        </span>
      </div>
    </div>
  )
}
