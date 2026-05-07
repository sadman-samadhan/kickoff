/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy, CheckCircle, XCircle, Plus, Calendar as CalendarIcon, MapPin, ChevronLeft, ChevronRight, Download, Users, X, Clock } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek } from 'date-fns'
import { Button } from '@/components/ui/button'

interface Profile {
  full_name?: string
  avatar_url?: string
  preferred_position?: string
  username?: string
  email_notifications?: boolean
}

interface Booking {
  id: string
  group_id: string
  match_date: string
  match_time: string
  field_name: string
  google_maps_url?: string
  status: string
  groups?: { name: string }
  rsvps: any[]
  myRsvpStatus?: string
}

interface Group {
  id: string
  name: string
  memberCount: number
  nextMatch: string | null
}

interface DashboardClientProps {
  user: { id: string, email?: string }
  profile: Profile | null
  goals: number
  assists: number
  pendingBookings: Booking[]
  upcomingBookings: Booking[]
  allBookings: Booking[]
  groups: Group[]
}

export default function DashboardClient({
  user,
  profile,
  goals,
  assists,
  pendingBookings,
  upcomingBookings,
  allBookings,
  groups
}: DashboardClientProps) {
  const supabase = createClient()
  const [localPending, setLocalPending] = useState<Booking[]>(pendingBookings)
  const [currentPendingIndex] = useState(0)

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const handleRsvp = async (bookingId: string, status: string) => {
    // Optimistic update
    setLocalPending((prev: Booking[]) => prev.filter((b: Booking) => b.id !== bookingId))

    // Save to DB
    // First try to update
    const { data: existing } = await supabase
      .from('rsvps')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('player_id', user.id)
      .single()

    if (existing) {
      await supabase
        .from('rsvps')
        .update({ status, responded_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('rsvps')
        .insert({
          booking_id: bookingId,
          player_id: user.id,
          status,
          responded_at: new Date().toISOString()
        })
    }
  }

  const generateICS = (booking: Booking) => {
    const start = new Date(`${booking.match_date}T${booking.match_time}`)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // Assumes 1 hour

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kickoff App//EN
BEGIN:VEVENT
UID:${booking.id}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
SUMMARY:Match - ${booking.groups?.name || 'Football Group'}
LOCATION:${booking.field_name}
DESCRIPTION:Kickoff match at ${booking.field_name}
END:VEVENT
END:VCALENDAR`

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `match-${booking.id}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calendar Logic
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const dateFormat = "d"
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const getBookingsForDate = (day: Date) => {
    return allBookings.filter((b: Booking) => isSameDay(parseISO(b.match_date), day))
  }

  const selectedDateBookings = selectedDate ? getBookingsForDate(selectedDate) : []

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 max-w-xl mx-auto">

      {/* 1. HEADER CARD */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 flex flex-col items-center">
        <div className="relative mb-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-green-50 shadow-sm" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-green-100 border-4 border-green-50 shadow-sm flex items-center justify-center text-green-700 font-bold text-2xl">
              {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'P'}
            </div>
          )}
          <div className="absolute -bottom-2 -right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-white shadow-sm">
            {profile?.preferred_position || 'N/A'}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-1">
          <h2 className="text-xl font-bold text-neutral-900">{profile?.full_name || 'Player'}</h2>
          <Trophy className="w-4 h-4 text-green-500" />
        </div>

        <div className="flex gap-4 mt-3 pt-3 border-t border-neutral-100 w-full justify-center">
          <div className="flex flex-col items-center">
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Goals</span>
            <span className="text-lg font-bold text-neutral-800">{goals}</span>
          </div>
          <div className="w-px bg-neutral-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Assists</span>
            <span className="text-lg font-bold text-neutral-800">{assists}</span>
          </div>
          <div className="w-px bg-neutral-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">CS</span>
            <span className="text-lg font-bold text-neutral-800">0</span>
          </div>
        </div>
      </div>

      {/* 2. PENDING RSVP ALERT */}
      {localPending.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.2)] animate-pulse-slow relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-200/30 rounded-full -mr-12 -mt-12 blur-xl"></div>

          <div className="flex justify-between items-start mb-2">
            <div className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Action Required
            </div>
            {localPending.length > 1 && (
              <span className="text-xs font-semibold text-amber-700/70 bg-amber-100/50 px-2 py-0.5 rounded-full">
                {currentPendingIndex + 1} of {localPending.length}
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-amber-900 leading-snug mb-4 relative z-10">
            🏟️ <strong>{localPending[currentPendingIndex].groups?.name}</strong> has a match coming up! <br />
            <span className="text-amber-800/80">
              {format(parseISO(localPending[currentPendingIndex].match_date), 'EEEE, d MMM')} · {localPending[currentPendingIndex].match_time.slice(0, 5)} · {localPending[currentPendingIndex].field_name}
            </span>
            <br /><span className="mt-1 block font-bold">Are you in?</span>
          </p>

          <div className="flex gap-3 relative z-10">
            <Button
              onClick={() => handleRsvp(localPending[currentPendingIndex].id, 'in')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm border-0 h-11"
            >
              <CheckCircle className="w-5 h-5 mr-1.5" /> I&apos;m In
            </Button>
            <Button
              onClick={() => handleRsvp(localPending[currentPendingIndex].id, 'out')}
              variant="outline"
              className="flex-1 bg-white hover:bg-red-50 text-red-600 border-red-200 rounded-xl shadow-sm h-11"
            >
              <XCircle className="w-5 h-5 mr-1.5" /> Can&apos;t Make It
            </Button>
          </div>
        </div>
      )}

      {/* 3. MY GROUPS */}
      <div className="-mx-4">
        <div className="px-4 mb-3 flex justify-between items-center">
          <h3 className="font-bold text-neutral-800 text-lg">My Squads</h3>
        </div>
        <div className="flex overflow-x-auto gap-4 px-4 pb-4 snap-x hide-scrollbar">
          {groups.map((group: Group) => (
            <Link href={`/groups/${group.id}`} key={group.id} className="snap-start shrink-0">
              <div className="bg-white rounded-2xl p-4 w-60 border border-neutral-100 shadow-sm active:scale-95 transition-transform flex flex-col h-full">
                <h4 className="font-bold text-neutral-900 truncate mb-1">{group.name}</h4>
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-4">
                  <Users className="w-3.5 h-3.5" />
                  <span>{group.memberCount} Members</span>
                </div>
                <div className="mt-auto bg-neutral-50 rounded-lg p-2.5 border border-neutral-100">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mb-0.5">Next Match</div>
                  <div className="text-xs font-medium text-neutral-800">
                    {group.nextMatch ? format(parseISO(group.nextMatch), 'MMM d, yyyy') : 'No match scheduled'}
                  </div>
                </div>
              </div>
            </Link>
          ))}

          <Link href="/groups" className="snap-start shrink-0">
            <div className="bg-green-50/50 border-2 border-dashed border-green-200 rounded-2xl p-4 w-32 h-full flex flex-col items-center justify-center text-green-700 active:scale-95 transition-transform hover:bg-green-50">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-center">Add / Join<br />Group</span>
            </div>
          </Link>
        </div>
      </div>

      {/* 4. UPCOMING MATCHES */}
      <div>
        <h3 className="font-bold text-neutral-800 text-lg mb-3">Upcoming Matches</h3>
        <div className="flex flex-col gap-3">
          {upcomingBookings.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border border-neutral-100 shadow-sm">
              <p className="text-sm text-neutral-500">No upcoming matches scheduled.</p>
            </div>
          ) : (
            upcomingBookings.map((booking: Booking) => (
              <Link href={`/groups/${booking.group_id}/match/${booking.id}`} key={booking.id}>
                <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
                  <div className="flex flex-col items-center justify-center bg-green-50 text-green-800 rounded-xl w-14 h-14 shrink-0 border border-green-100">
                    <span className="text-xs font-bold uppercase">{format(parseISO(booking.match_date), 'MMM')}</span>
                    <span className="text-lg font-black leading-none">{format(parseISO(booking.match_date), 'dd')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-neutral-900 truncate">{booking.groups?.name}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-1 truncate">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="truncate">{booking.match_time.slice(0, 5)}</span>
                      <span className="mx-0.5">•</span>
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{booking.field_name}</span>
                    </div>
                  </div>
                  <div>
                    {booking.myRsvpStatus === 'in' && <div className="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-200">IN</div>}
                    {booking.myRsvpStatus === 'out' && <div className="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-200">OUT</div>}
                    {(booking.myRsvpStatus === 'pending' || booking.myRsvpStatus === 'none') && <div className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-200">PENDING</div>}
                    {booking.myRsvpStatus === 'waitlist' && <div className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-purple-200">WAITLIST</div>}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* 5. CALENDAR */}
      <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-neutral-800 text-lg flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-green-600" />
            Calendar
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold w-24 text-center select-none text-neutral-800">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
            <div key={day} className="text-center text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            const hasBooking = getBookingsForDate(day).length > 0
            const isSelected = selectedDate && isSameDay(day, selectedDate)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isTodayDate = isToday(day)

            return (
              <div
                key={i}
                onClick={() => hasBooking && setSelectedDate(isSelected ? null : day)}
                className={`
                  aspect-square flex flex-col justify-center items-center rounded-xl text-sm relative cursor-pointer
                  ${!isCurrentMonth ? 'text-neutral-300' : 'text-neutral-700 font-medium'}
                  ${isSelected ? 'bg-green-600 text-white font-bold shadow-md' : ''}
                  ${isTodayDate && !isSelected ? 'bg-neutral-100 text-green-600 font-bold' : ''}
                  ${!isSelected && hasBooking ? 'hover:bg-green-50' : ''}
                `}
              >
                <span>{format(day, dateFormat)}</span>
                {hasBooking && (
                  <div className={`w-1.5 h-1.5 rounded-full absolute bottom-1.5 ${isSelected ? 'bg-white' : 'bg-green-500'}`}></div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Calendar Popup/Dialog */}
      {selectedDate && selectedDateBookings.length > 0 && (
        <div className="fixed inset-0 bg-neutral-900/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-neutral-50 px-5 py-4 border-b border-neutral-100 flex justify-between items-center">
              <h3 className="font-bold text-neutral-800">
                {format(selectedDate, 'EEEE, MMMM d')}
              </h3>
              <button onClick={() => setSelectedDate(null)} className="p-1 rounded-full hover:bg-neutral-200 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
              {selectedDateBookings.map((booking: Booking) => (
                <div key={booking.id} className="border border-neutral-100 rounded-xl p-4 bg-white shadow-sm relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                  <h4 className="font-bold text-neutral-900 mb-1">{booking.groups?.name}</h4>
                  <div className="space-y-1 mb-4">
                    <div className="flex items-center text-sm text-neutral-600">
                      <Clock className="w-4 h-4 mr-2 text-neutral-400" />
                      {booking.match_time.slice(0, 5)}
                    </div>
                    <div className="flex items-center text-sm text-neutral-600">
                      <MapPin className="w-4 h-4 mr-2 text-neutral-400" />
                      {booking.field_name}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 text-xs h-9 border-neutral-200" onClick={() => generateICS(booking)}>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Add to Calendar
                    </Button>
                    <Link href={`/groups/${booking.group_id}/match/${booking.id}`} className="flex-1">
                      <Button className="w-full text-xs h-9 bg-green-600 hover:bg-green-700 text-white shadow-sm">
                        View Match
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spacer for bottom nav */}
      <div className="h-4"></div>
    </div>
  )
}
