"use client"

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Settings, CheckCircle, XCircle, Users, Clock, Calendar, MapPin, Plus, Shield, ChevronRight, X, Loader2, Copy, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rsvpAction, addBookingAction } from './actions'

interface Member {
  id: string
  full_name?: string
  avatar_url?: string
  preferred_position?: string
  role: 'admin' | 'member'
}

interface Booking {
  id: string
  match_date: string
  match_time: string
  field_name: string
  max_players: number
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
  rsvps?: { player_id: string; status: string; waitlist_position?: number }[]
}

interface GroupClientProps {
  group: {
    id: string
    name: string
    invite_code: string
  }
  members: Member[]
  role: 'admin' | 'member'
  nextMatch: Booking | null
  futureBookings: Booking[]
  pastBookings: Booking[]
  userId: string
}

export default function GroupClient({
  group,
  members,
  role,
  nextMatch,
  futureBookings,
  pastBookings,
  userId
}: GroupClientProps) {
  // Modals state
  const [isManageModalOpen, setIsManageModalOpen] = useState(false)
  const [isAddBookingOpen, setIsAddBookingOpen] = useState(false)
  const [isConfirmOutOpen, setIsConfirmOutOpen] = useState(false)
  const [isWaitlistAlertOpen, setIsWaitlistAlertOpen] = useState(false)
  const [waitlistPos, setWaitlistPos] = useState<number | null>(null)
  
  const [isRsvpLoading, setIsRsvpLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Booking Form State
  const [bookingForm, setBookingForm] = useState({
    matchDate: '',
    matchTime: '',
    fieldName: '',
    googleMapsUrl: '',
    maxPlayers: 21
  })
  const [isBookingLoading, setIsBookingLoading] = useState(false)

  // Next Match logic
  const myRsvpObj = nextMatch?.rsvps?.find((r: { player_id: string }) => r.player_id === userId)
  const myRsvp = myRsvpObj?.status || 'none'
  const inCount = nextMatch?.rsvps?.filter((r: { status: string }) => r.status === 'in').length || 0
  const waitlistCount = nextMatch?.rsvps?.filter((r: { status: string }) => r.status === 'waitlist').length || 0
  const maxPlayers = nextMatch?.max_players || 21
  const progressPercent = Math.min(100, (inCount / maxPlayers) * 100)
  
  const handleRsvp = async (status: string) => {
    if (status === 'out' && myRsvp === 'in' && waitlistCount > 0) {
      setIsConfirmOutOpen(true)
      return
    }
    await executeRsvp(status)
  }

  const executeRsvp = async (status: string) => {
    if (!nextMatch) return
    setIsRsvpLoading(true)
    setIsConfirmOutOpen(false)
    try {
      const res = await rsvpAction(nextMatch.id, group.id, status, maxPlayers)
      if (res.status === 'waitlist') {
        setWaitlistPos(res.waitlistPosition)
        setIsWaitlistAlertOpen(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsRsvpLoading(false)
    }
  }

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsBookingLoading(true)
    try {
      await addBookingAction(group.id, bookingForm)
      setIsAddBookingOpen(false)
      setBookingForm({
        matchDate: '',
        matchTime: '',
        fieldName: '',
        googleMapsUrl: '',
        maxPlayers: 21
      })
    } catch (e) {
      console.error(e)
    } finally {
      setIsBookingLoading(false)
    }
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(group.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 max-w-xl mx-auto min-h-screen pb-24">
      {/* 1. HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight leading-none mb-2">{group.name}</h1>
          <div className="flex items-center gap-3 text-sm font-medium">
            <span className="flex items-center gap-1.5 text-neutral-600 bg-neutral-100 px-2 py-1 rounded-full">
              <Users className="w-4 h-4" /> {members.length} members
            </span>
            <span className="bg-neutral-100 text-neutral-600 px-2 py-1 rounded-full font-mono font-bold tracking-widest text-xs border border-neutral-200" onClick={copyInviteCode}>
              {copied ? 'COPIED!' : group.invite_code}
            </span>
          </div>
          </div>
        <div className="flex flex-col gap-2">
          {role === 'admin' && (
            <Button variant="outline" size="sm" onClick={() => setIsManageModalOpen(true)} className="rounded-full shadow-sm w-full justify-start">
              <Settings className="w-4 h-4 mr-1.5" /> Manage
            </Button>
          )}
          <Link href={`/groups/${group.id}/leaderboard`}>
            <Button variant="outline" size="sm" className="rounded-full shadow-sm w-full justify-start border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800">
              <Trophy className="w-4 h-4 mr-1.5" /> Leaderboard
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. NEXT MATCH CARD */}
      {nextMatch ? (
        <div className="bg-white rounded-3xl p-5 shadow-lg shadow-neutral-200/50 border border-neutral-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          
          <Link href={`/groups/${group.id}/match/${nextMatch.id}`} className="block relative z-10 active:opacity-70 transition-opacity">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Next Match</div>
                <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                  {format(parseISO(nextMatch.match_date), 'EEEE, MMMM d')}
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                </h3>
                <div className="flex items-center gap-3 mt-2 text-sm text-neutral-600 font-medium">
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-neutral-400" /> {nextMatch.match_time.slice(0,5)}</span>
                  <span className="flex items-center gap-1.5 truncate"><MapPin className="w-4 h-4 text-neutral-400" /> {nextMatch.field_name}</span>
                </div>
              </div>
            </div>
          </Link>

          <div className="mt-5 relative z-10">
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-neutral-700">{inCount} confirmed</span>
              <span className="text-neutral-400">Max {maxPlayers}</span>
            </div>
            <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden w-full">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${inCount >= maxPlayers ? 'bg-amber-500' : 'bg-green-500'}`} 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            {inCount >= maxPlayers && (
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mt-2 text-right">Match is full ({waitlistCount} on waitlist)</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6 relative z-10">
            <Button 
              onClick={() => handleRsvp('in')}
              disabled={isRsvpLoading}
              className={`h-12 rounded-xl text-base shadow-sm transition-all ${myRsvp === 'in' ? 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-600 ring-offset-2' : 'bg-white text-green-700 border-2 border-green-200 hover:bg-green-50'}`}
            >
              <CheckCircle className={`w-5 h-5 mr-2 ${myRsvp === 'in' ? 'text-white' : 'text-green-600'}`} />
              I&apos;m In
            </Button>
            <Button 
              onClick={() => handleRsvp('out')}
              disabled={isRsvpLoading}
              className={`h-12 rounded-xl text-base shadow-sm transition-all ${myRsvp === 'out' ? 'bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-500 ring-offset-2' : 'bg-white text-red-600 border-2 border-red-100 hover:bg-red-50'}`}
            >
              <XCircle className={`w-5 h-5 mr-2 ${myRsvp === 'out' ? 'text-white' : 'text-red-500'}`} />
              I&apos;m Out
            </Button>
          </div>
          {myRsvp === 'waitlist' && (
            <div className="mt-4 p-3 bg-purple-50 text-purple-700 rounded-xl text-sm font-semibold text-center border border-purple-100 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" /> On Waitlist (Pos: {myRsvpObj?.waitlist_position})
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-neutral-100">
          <Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-neutral-900">No Upcoming Matches</h3>
          <p className="text-neutral-500 text-sm mt-1">Ready to play?</p>
          <Button 
            onClick={() => setIsAddBookingOpen(true)}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white rounded-full px-6 shadow-md shadow-green-600/20"
          >
            Add a new booking
          </Button>
        </div>
      )}

      {/* 3. MEMBERS ROW */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-neutral-900 text-lg">Squad</h3>
          <span className="text-xs font-bold text-neutral-400">{members.length} Total</span>
        </div>
        <div className="flex overflow-x-auto gap-4 pb-2 hide-scrollbar snap-x">
          {members.map((member: Member) => (
            <div key={member.id} className="flex flex-col items-center shrink-0 w-16 snap-start">
              <div className="relative">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt={member.full_name} className="w-14 h-14 rounded-full object-cover border border-neutral-200 bg-neutral-100" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-xl border border-green-200">
                    {member.full_name?.charAt(0) || 'P'}
                  </div>
                )}
                {member.role === 'admin' && (
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-neutral-200">
                    <Shield className="w-3.5 h-3.5 text-green-600 fill-green-50" />
                  </div>
                )}
              </div>
              <span className="text-xs font-bold text-neutral-800 mt-2 truncate w-full text-center">{member.full_name?.split(' ')[0]}</span>
              <span className="text-[9px] font-bold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-sm mt-0.5">{member.preferred_position || 'N/A'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4 & 5. FUTURE BOOKINGS */}
      {futureBookings.length > 0 && (
        <div>
          <h3 className="font-bold text-neutral-900 text-lg mb-3">Upcoming</h3>
          <div className="flex flex-col gap-3">
            {futureBookings.map((booking: Booking) => (
              <Link href={`/groups/${group.id}/match/${booking.id}`} key={booking.id}>
                <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
                  <div className="flex flex-col items-center justify-center bg-neutral-50 text-neutral-800 rounded-xl w-14 h-14 shrink-0">
                    <span className="text-xs font-bold uppercase">{format(parseISO(booking.match_date), 'MMM')}</span>
                    <span className="text-lg font-black leading-none">{format(parseISO(booking.match_date), 'dd')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-neutral-900 truncate">{format(parseISO(booking.match_date), 'EEEE')}</h4>
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                        {booking.rsvps?.filter((r: { status: string }) => r.status === 'in').length || 0} IN
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 truncate">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="truncate">{booking.match_time.slice(0,5)}</span>
                      <span className="mx-0.5">•</span>
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{booking.field_name}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* MATCH HISTORY */}
      {pastBookings.length > 0 && (
        <div>
          <h3 className="font-bold text-neutral-900 text-lg mb-3">History</h3>
          <div className="flex overflow-x-auto gap-3 pb-2 hide-scrollbar snap-x">
            {pastBookings.map((booking: Booking) => (
              <Link href={`/groups/${group.id}/match/${booking.id}`} key={booking.id} className="snap-start shrink-0">
                <div className="bg-white rounded-xl p-3 w-40 border border-neutral-100 shadow-sm">
                  <div className="text-[10px] font-bold text-neutral-400 uppercase mb-1">
                    {format(parseISO(booking.match_date), 'MMM d, yyyy')}
                  </div>
                  <div className="font-bold text-neutral-800 text-sm truncate">
                    {booking.field_name}
                  </div>
                  {/* Score stub */}
                  <div className="mt-2 bg-neutral-50 rounded p-1.5 flex justify-center items-center text-xs font-black text-neutral-700 tracking-wider">
                    - : -
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* FLOATING ACTION BUTTON */}
      <button 
        onClick={() => setIsAddBookingOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-green-600 text-white rounded-full shadow-lg shadow-green-600/30 flex items-center justify-center hover:bg-green-700 active:scale-95 transition-all z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* MODALS */}
      
      {/* Manage Group Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/40 p-4 pb-0 sm:pb-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-200">
            <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900">Manage Group</h3>
              <button onClick={() => setIsManageModalOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-4">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Invite Code</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border border-neutral-200 rounded-lg py-2.5 px-3 text-lg font-mono font-bold tracking-widest text-center text-neutral-800">
                    {group.invite_code}
                  </div>
                  <Button onClick={copyInviteCode} variant="outline" className="h-[46px] w-[46px] p-0 shrink-0 border-neutral-200 bg-white">
                    {copied ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-neutral-600" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Booking Modal */}
      {isAddBookingOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/50 p-0 sm:p-4">
          <div className="bg-white w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-200">
            <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-neutral-900">Schedule Match</h3>
              <button onClick={() => setIsAddBookingOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              <form id="booking-form" onSubmit={handleAddBooking} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-neutral-700">Date</label>
                    <input
                      type="date"
                      required
                      className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm bg-white"
                      value={bookingForm.matchDate}
                      onChange={e => setBookingForm({...bookingForm, matchDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-neutral-700">Time</label>
                    <input
                      type="time"
                      required
                      className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm bg-white"
                      value={bookingForm.matchTime}
                      onChange={e => setBookingForm({...bookingForm, matchTime: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-neutral-700">Field Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wembley Arena"
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    value={bookingForm.fieldName}
                    onChange={e => setBookingForm({...bookingForm, fieldName: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-neutral-700">Google Maps URL <span className="text-neutral-400 font-normal">(Optional)</span></label>
                  <input
                    type="url"
                    placeholder="https://maps.google.com/..."
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    value={bookingForm.googleMapsUrl}
                    onChange={e => setBookingForm({...bookingForm, googleMapsUrl: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-neutral-700">Max Players</label>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    required
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    value={bookingForm.maxPlayers}
                    onChange={e => setBookingForm({...bookingForm, maxPlayers: parseInt(e.target.value) || 21})}
                  />
                </div>
              </form>
            </div>
            
            <div className="p-5 border-t border-neutral-100 bg-white shrink-0 sm:rounded-b-3xl">
              <Button form="booking-form" type="submit" disabled={isBookingLoading} className="w-full bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl text-base shadow-sm">
                {isBookingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Schedule Match'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Out Modal */}
      {isConfirmOutOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white rounded-3xl w-full max-sm p-6 animate-in zoom-in-95 duration-200 shadow-2xl">
            <h3 className="font-bold text-xl text-neutral-900 mb-2">Are you sure?</h3>
            <p className="text-neutral-600 mb-6">Your spot will automatically be given to the next person on the waitlist. You will lose your guaranteed spot.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsConfirmOutOpen(false)}>Cancel</Button>
              <Button className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white" onClick={() => executeRsvp('out')}>
                {isRsvpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Yes, I&apos;m Out"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Waitlist Alert */}
      {isWaitlistAlertOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-bold text-xl text-neutral-900 mb-2">Added to Waitlist!</h3>
            <p className="text-neutral-600 mb-6">The match is currently full. You are position <strong>#{waitlistPos}</strong> on the waitlist. You&apos;ll be notified if a spot opens up.</p>
            <Button className="w-full h-12 rounded-xl bg-neutral-900 text-white" onClick={() => setIsWaitlistAlertOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
