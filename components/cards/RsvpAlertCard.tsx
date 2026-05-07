"use client"

import { CalendarDays, Clock, MapPin } from 'lucide-react'

interface RsvpAlertCardProps {
  notification: {
    id: string
    match_date?: string
    match_time?: string
    field_name?: string
    booking_id?: string
    group_id?: string
  }
  groupName: string
  onAccept: () => void
  onDecline: () => void
}

export function RsvpAlertCard({ notification, groupName, onAccept, onDecline }: RsvpAlertCardProps) {
  return (
    <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 p-4 animate-[pulse-border_2s_ease-in-out_infinite]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📢</span>
        <span className="text-sm font-bold text-neutral-900">{groupName} has a match!</span>
      </div>

      {(notification.match_date || notification.match_time || notification.field_name) && (
        <div className="flex items-center gap-3 text-xs text-neutral-600 font-medium mb-4 flex-wrap">
          {notification.match_date && (
            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-amber-500" />{notification.match_date}</span>
          )}
          {notification.match_time && (
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" />{notification.match_time.slice(0, 5)}</span>
          )}
          {notification.field_name && (
            <span className="flex items-center gap-1 truncate"><MapPin className="w-3.5 h-3.5 text-amber-500" />{notification.field_name}</span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onAccept}
          className="flex-1 bg-green-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-green-700 active:scale-95 transition-all"
        >
          ✅ I'm In
        </button>
        <button
          onClick={onDecline}
          className="flex-1 bg-white text-red-600 text-sm font-bold py-2.5 rounded-xl border border-red-200 hover:bg-red-50 active:scale-95 transition-all"
        >
          ❌ Can't Make It
        </button>
      </div>
    </div>
  )
}
