"use client"

import { useState, useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths, parseISO
} from 'date-fns'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'

interface Booking {
  id: string
  match_date: string
  match_time: string
  field_name: string
  group_id?: string
  group_name?: string
  google_maps_url?: string
}

interface MiniCalendarProps {
  bookings: Booking[]
}

function generateIcs(b: Booking): string {
  const d = b.match_date.replace(/-/g, '')
  const [h, m] = b.match_time.split(':')
  const startH = parseInt(h, 10)
  const endH = startH + 2
  const dtStart = `${d}T${String(startH).padStart(2, '0')}${m}00`
  const dtEnd = `${d}T${String(endH).padStart(2, '0')}${m}00`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KhelaHobe//EN',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${b.group_name || 'KhelaHobe'} Match`,
    `LOCATION:${b.field_name}`,
    `DESCRIPTION:${b.google_maps_url || ''}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
}

function downloadIcs(b: Booking) {
  const blob = new Blob([generateIcs(b)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `match-${b.match_date}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

export function MiniCalendar({ bookings }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  const bookingDates = useMemo(() => {
    const map = new Map<string, Booking>()
    bookings.forEach(b => map.set(b.match_date, b))
    return map
  }, [bookings])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 rounded-lg hover:bg-neutral-100 active:scale-90 transition-all">
          <ChevronLeft className="w-4 h-4 text-neutral-500" />
        </button>
        <span className="text-sm font-bold text-neutral-800">{format(currentMonth, 'MMMM yyyy')}</span>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded-lg hover:bg-neutral-100 active:scale-90 transition-all">
          <ChevronRight className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-neutral-400 uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const booking = bookingDates.get(key)
          const inMonth = isSameMonth(day, currentMonth)
          const isToday = isSameDay(day, new Date())

          return (
            <button
              key={key}
              onClick={() => booking && setSelectedBooking(booking)}
              className={`
                relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors
                ${inMonth ? 'text-neutral-700' : 'text-neutral-300'}
                ${isToday ? 'bg-green-50 font-bold' : ''}
                ${booking ? 'cursor-pointer hover:bg-green-50' : 'cursor-default'}
              `}
            >
              <span className="text-xs">{format(day, 'd')}</span>
              {booking && <span className="absolute bottom-0.5 w-1 h-1 bg-green-500 rounded-full" />}
            </button>
          )
        })}
      </div>

      {/* Popup */}
      {selectedBooking && (
        <div className="absolute inset-x-3 bottom-3 bg-white rounded-xl border border-green-200 shadow-lg p-3 z-10">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                {selectedBooking.group_name || 'Match'}
              </span>
              <p className="text-sm font-bold text-neutral-900 mt-1">
                {format(parseISO(selectedBooking.match_date), 'EEE, d MMM')} · {selectedBooking.match_time.slice(0, 5)}
              </p>
              <p className="text-xs text-neutral-500">{selectedBooking.field_name}</p>
            </div>
            <button onClick={() => setSelectedBooking(null)} className="p-0.5 rounded hover:bg-neutral-100">
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
          <button
            onClick={() => downloadIcs(selectedBooking)}
            className="w-full bg-green-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-green-700 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Add to Calendar
          </button>
        </div>
      )}
    </div>
  )
}
