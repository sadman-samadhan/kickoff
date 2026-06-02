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

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const isPastBooking = selectedBooking ? selectedBooking.match_date < todayStr : false

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
          const isPast = key < todayStr

          let buttonClass = 'relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors '
          if (booking) {
            buttonClass += 'cursor-pointer '
            if (isPast) {
              buttonClass += 'bg-neutral-100 border border-neutral-200/60 hover:bg-neutral-200 text-neutral-600 font-medium '
            } else {
              buttonClass += 'bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 font-semibold '
            }
          } else {
            buttonClass += 'cursor-default '
            if (isToday) {
              buttonClass += 'bg-green-50 text-green-700 font-bold border border-green-200/50 '
            } else {
              buttonClass += inMonth ? 'text-neutral-700 hover:bg-neutral-50 ' : 'text-neutral-300 '
            }
          }

          return (
            <button
              key={key}
              onClick={() => booking && setSelectedBooking(booking)}
              className={buttonClass}
            >
              <span className="text-xs">{format(day, 'd')}</span>
              {booking && (
                <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isPast ? 'bg-neutral-400' : 'bg-amber-500'}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Popup */}
      {selectedBooking && (
        <div className={`absolute inset-x-3 bottom-3 bg-white rounded-xl shadow-lg p-3 z-10 border ${isPastBooking ? 'border-neutral-200' : 'border-amber-200'}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPastBooking ? 'text-neutral-600 bg-neutral-100' : 'text-amber-700 bg-amber-50'}`}>
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
            className={`w-full text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all ${isPastBooking ? 'bg-neutral-600 hover:bg-neutral-700' : 'bg-amber-600 hover:bg-amber-700'}`}
          >
            <Download className="w-3.5 h-3.5" /> Add to Calendar
          </button>
        </div>
      )}
    </div>
  )
}
