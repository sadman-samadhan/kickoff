"use client"

import { format, parseISO } from 'date-fns'
import { ChevronRight, Users, CalendarDays } from 'lucide-react'

interface GroupCardProps {
  group: { id: string; name: string }
  nextBooking?: { match_date: string; match_time: string } | null
  memberCount: number
  onClick?: () => void
}

export function GroupCard({ group, nextBooking, memberCount, onClick }: GroupCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 cursor-pointer active:scale-[0.98] transition-transform flex items-center gap-3"
    >
      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
        <Users className="w-5 h-5 text-green-600" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-neutral-900 truncate">{group.name}</h3>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[11px] text-neutral-500 font-medium flex items-center gap-1">
            <Users className="w-3 h-3" />{memberCount} members
          </span>
          {nextBooking ? (
            <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {format(parseISO(nextBooking.match_date), 'MMM d')} · {nextBooking.match_time.slice(0, 5)}
            </span>
          ) : (
            <span className="text-[11px] text-neutral-400 font-medium">No upcoming matches</span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-green-500 shrink-0" />
    </div>
  )
}
