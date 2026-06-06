/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Settings, CheckCircle, XCircle, Users, Clock, Calendar, MapPin, Plus, Shield, ChevronRight, X, Loader2, Copy, Trophy, UserMinus, ShieldCheck, LogOut, MessageCircle, Star } from 'lucide-react'
import ChatTab from './ChatTab'
import { Button } from '@/components/ui/button'
import { useChatUnread } from '@/components/providers/ChatUnreadProvider'
import { rsvpAction, addBookingAction, makeAdminAction, removeAdminAction, removeMemberAction, leaveGroupAction, deleteGroupAction } from './actions'

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
  champion?: string
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') as 'matches' | 'chat' | 'squad' | null

  // Tab state
  const [activeTab, setActiveTab] = useState<'matches' | 'chat' | 'squad'>(
    initialTab === 'chat' || initialTab === 'squad' ? initialTab : 'matches'
  )
  const { unreadCounts, markAsRead } = useChatUnread()
  const unreadCount = unreadCounts[group.id] || 0

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
  const [bookingError, setBookingError] = useState('')

  // Field autocomplete
  const [fieldSuggestions, setFieldSuggestions] = useState<any[]>([])
  const [showFieldDropdown, setShowFieldDropdown] = useState(false)
  const [fieldSearchTimeout, setFieldSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  // Member stats
  const [memberStats, setMemberStats] = useState<Record<string, { goals: number, assists: number, clean_sheets: number }>>({})
  const [statsLoading, setStatsLoading] = useState(true)

  // Admin action sheet
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isAdminActionOpen, setIsAdminActionOpen] = useState(false)
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false)
  const [isLeaveGroupModalOpen, setIsLeaveGroupModalOpen] = useState(false)
  const [isLeaveWarningOpen, setIsLeaveWarningOpen] = useState(false)
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false)
  const [adminActionLoading, setAdminActionLoading] = useState(false)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/stats/group/${group.id}`)
        const data = await res.json()
        const statsMap: Record<string, { goals: number, assists: number, clean_sheets: number }> = {}
        data.players?.forEach((p: any) => {
          statsMap[p.player_id] = {
            goals: p.goals || 0,
            assists: p.assists || 0,
            clean_sheets: p.clean_sheets || 0
          }
        })
        setMemberStats(statsMap)
      } catch (e) {
        console.error(e)
      } finally {
        setStatsLoading(false)
      }
    }
    fetchStats()
  }, [group.id])

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
    setBookingError('')
    
    if (!bookingForm.fieldName.trim()) {
      setBookingError('Please provide a field name to create the match.')
      return
    }

    if (bookingForm.matchDate && bookingForm.matchTime) {
      const matchDateTimeStr = `${bookingForm.matchDate}T${bookingForm.matchTime}`
      const matchTimeMs = new Date(matchDateTimeStr).getTime()
      const nowMs = Date.now()
      const diffHours = (matchTimeMs - nowMs) / (1000 * 60 * 60)
      
      if (diffHours < 3) {
        setBookingError('Matches must be scheduled at least 3 hours in advance.')
        return
      }
    }

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
      setBookingError('')
    } catch (e: any) {
      setBookingError(e.message || 'Failed to schedule match')
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

  let matchStatusLabel = 'Next Match'
  let isMatchStarted = false
  if (nextMatch) {
    const matchDateTimeStr = `${nextMatch.match_date}T${nextMatch.match_time || '00:00:00'}`
    const matchTimeMs = new Date(matchDateTimeStr).getTime()
    const nowMs = Date.now()
    if (nowMs >= matchTimeMs) {
      matchStatusLabel = 'Match Started'
      isMatchStarted = true
    } else if (new Date(matchDateTimeStr).toDateString() === new Date().toDateString()) {
      matchStatusLabel = 'Today\'s Match'
    }
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

      {/* TAB NAVIGATION */}
      <div className="flex bg-white rounded-2xl p-1 border border-neutral-100 shadow-sm">
        {[
          { key: 'matches' as const, label: 'Matches', icon: Calendar },
          { key: 'chat' as const, label: 'Chat', icon: MessageCircle, badge: unreadCount },
          { key: 'squad' as const, label: 'Squad', icon: Users },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                if (tab.key === 'chat') {
                  markAsRead(group.id)
                }
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {tab.badge ? (
                  <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] font-bold px-1.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full border-2 border-white">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <ChatTab groupId={group.id} userId={userId} />
      )}

      {/* MATCHES TAB */}
      {activeTab === 'matches' && (<>
      {/* 2. NEXT MATCH CARD */}
      {nextMatch ? (
        <div className="bg-white rounded-3xl p-5 shadow-lg shadow-neutral-200/50 border border-neutral-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

          <Link href={`/groups/${group.id}/match/${nextMatch.id}`} className="block relative z-10 active:opacity-70 transition-opacity">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isMatchStarted ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>{matchStatusLabel}</div>
                <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                  {format(parseISO(nextMatch.match_date), 'EEEE, MMMM d')}
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                </h3>
                <div className="flex items-center gap-3 mt-2 text-sm text-neutral-600 font-medium">
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-neutral-400" /> {nextMatch.match_time.slice(0, 5)}</span>
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

          {!isMatchStarted && (
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
          )}
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
                      <span className="truncate">{booking.match_time.slice(0, 5)}</span>
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
                  {/* Champion/Winner display */}
                  <div className="mt-2 bg-neutral-50 rounded p-1.5 flex justify-center items-center text-xs font-bold tracking-wide truncate">
                    {booking.status === 'cancelled' ? (
                      <span className="text-red-500 font-black tracking-wider text-[10px]">CANCELLED</span>
                    ) : booking.champion ? (
                      <span className="text-amber-700 flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="truncate max-w-[100px]">{booking.champion}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-500 italic text-[10px]">No Champion</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      </>)}

      {/* SQUAD TAB */}
      {activeTab === 'squad' && (
      <>
      {/* 3. MEMBERS TABLE */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-neutral-900 text-lg">Squad</h3>
          <span className="text-xs font-bold text-neutral-400">{members.length} Total</span>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_40px_40px_40px] gap-2 px-4 py-2.5 border-b border-neutral-100 bg-neutral-50">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Player</span>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-center" title="Goals">G</span>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-center" title="Assists">A</span>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-center" title="Clean Sheets">CS</span>
          </div>

          {/* Table Rows */}
          {members.map((member: Member) => {
            const stats = memberStats[member.id]
            return (
              <div
                key={member.id}
                onClick={() => {
                  if (role === 'admin' && member.id !== userId) {
                    setSelectedMember(member)
                    setIsAdminActionOpen(true)
                  }
                }}
                className={`grid grid-cols-[1fr_40px_40px_40px] gap-2 px-4 py-3 border-b border-neutral-50 last:border-b-0 items-center ${
                  role === 'admin' && member.id !== userId ? 'cursor-pointer active:bg-neutral-50 transition-colors' : ''
                }`}
              >
                {/* Player Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {member.avatar_url ? (
                      <div className="w-9 h-9 rounded-full border border-neutral-200 overflow-hidden relative">
                        <Image src={member.avatar_url} alt={member.full_name || "Player"} fill sizes="36px" className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-sm border border-green-200">
                        {member.full_name?.charAt(0) || 'P'}
                      </div>
                    )}
                    {member.role === 'admin' && (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-[1px] shadow-sm">
                        <Shield className="w-3 h-3 text-green-600 fill-green-50" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-neutral-800 truncate block">{member.full_name?.split(' ')[0] || 'Player'}</span>
                    <span className="text-[10px] font-semibold text-neutral-400">{member.preferred_position || 'N/A'}</span>
                  </div>
                </div>

                {/* Stats */}
                {statsLoading ? (
                  <>
                    <span className="text-center text-xs text-neutral-300">-</span>
                    <span className="text-center text-xs text-neutral-300">-</span>
                    <span className="text-center text-xs text-neutral-300">-</span>
                  </>
                ) : (
                  <>
                    <span className="text-center text-sm font-bold text-neutral-700">{stats?.goals ?? 0}</span>
                    <span className="text-center text-sm font-bold text-neutral-700">{stats?.assists ?? 0}</span>
                    <span className="text-center text-sm font-bold text-neutral-700">{stats?.clean_sheets ?? 0}</span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
      </>
      )}

      {/* LEAVE GROUP BUTTON */}
      <div className="mt-8 flex justify-center pb-8 border-t border-neutral-100 pt-8">
        <button
          onClick={() => setIsLeaveGroupModalOpen(true)}
          className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-600 active:scale-95 transition-all px-4 py-2 rounded-xl hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          Leave Group
        </button>
      </div>

      {/* FLOATING ACTION BUTTON */}
      <button
        onClick={() => setIsAddBookingOpen(true)}
        className="fixed bottom-20 right-4 h-14 bg-green-600 text-white rounded-full shadow-lg shadow-green-600/30 flex items-center hover:bg-green-700 active:scale-95 transition-all duration-300 z-40 group overflow-hidden"
      >
        <div className="flex items-center pl-4 pr-4 gap-0 group-hover:gap-2 transition-all duration-300">
          <Plus className="w-6 h-6 shrink-0" />
          <span className="font-bold text-sm max-w-0 overflow-hidden opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">
            Add booking
          </span>
        </div>
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

              {role === 'admin' && (
                <div className="mt-6 pt-6 border-t border-neutral-100">
                  <button
                    onClick={() => {
                      setIsManageModalOpen(false)
                      setIsDeleteGroupModalOpen(true)
                    }}
                    className="w-full flex items-center justify-center gap-2 text-sm font-bold text-red-500 hover:text-red-600 transition-colors py-2"
                  >
                    <UserMinus className="w-4 h-4" />
                    Delete Group Permanently
                  </button>
                </div>
              )}
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
                      onChange={e => setBookingForm({ ...bookingForm, matchDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-neutral-700">Time</label>
                    <input
                      type="time"
                      required
                      className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm bg-white"
                      value={bookingForm.matchTime}
                      onChange={e => setBookingForm({ ...bookingForm, matchTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-sm font-semibold text-neutral-700">Field Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wembley Arena"
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    value={bookingForm.fieldName}
                    onChange={e => {
                      const val = e.target.value
                      setBookingForm({ ...bookingForm, fieldName: val })
                      if (fieldSearchTimeout) clearTimeout(fieldSearchTimeout)
                      if (val.trim().length >= 2) {
                        const timeout = setTimeout(async () => {
                          try {
                            const res = await fetch(`/api/fields?q=${encodeURIComponent(val.trim())}`)
                            const data = await res.json()
                            if (Array.isArray(data)) {
                              setFieldSuggestions(data)
                              setShowFieldDropdown(data.length > 0)
                            }
                          } catch (err) { console.error(err) }
                        }, 300)
                        setFieldSearchTimeout(timeout)
                      } else {
                        setFieldSuggestions([])
                        setShowFieldDropdown(false)
                      }
                    }}
                    onFocus={() => fieldSuggestions.length > 0 && setShowFieldDropdown(true)}
                    autoComplete="off"
                  />
                  {/* Field autocomplete dropdown */}
                  {showFieldDropdown && fieldSuggestions.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {fieldSuggestions.map((field: any) => (
                        <button
                          key={field.id}
                          type="button"
                          onClick={() => {
                            setBookingForm({
                              ...bookingForm,
                              fieldName: field.name,
                              googleMapsUrl: field.google_maps_url || bookingForm.googleMapsUrl
                            })
                            setShowFieldDropdown(false)
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors border-b border-neutral-50 last:border-b-0 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-neutral-800 truncate">{field.name}</div>
                            {field.google_maps_url && (
                              <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" /> Map location available
                              </div>
                            )}
                          </div>
                          {field.avg_rating && (
                            <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 shrink-0 ml-2">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              <span className="text-xs font-bold text-amber-700">{field.avg_rating}</span>
                              <span className="text-[9px] text-amber-500">({field.rating_count})</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-neutral-700">Map Location Link <span className="text-neutral-400 font-normal">(Optional)</span></label>
                  <input
                    type="url"
                    placeholder="https://maps.app.goo.gl/..."
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    value={bookingForm.googleMapsUrl}
                    onChange={e => setBookingForm({ ...bookingForm, googleMapsUrl: e.target.value })}
                  />
                  <p className="text-[10px] text-neutral-500">Add a Google Maps link so players can easily find the field.</p>
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
                    onChange={e => setBookingForm({ ...bookingForm, maxPlayers: parseInt(e.target.value) || 21 })}
                  />
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-neutral-100 bg-white shrink-0 sm:rounded-b-3xl">
              {bookingError && (
                <div className="mb-3 p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium border border-red-100 flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {bookingError}
                </div>
              )}
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

      {/* Admin Action Sheet */}
      {isAdminActionOpen && selectedMember && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-neutral-900/50 p-4 pb-0 sm:pb-4" onClick={() => { setIsAdminActionOpen(false); setSelectedMember(null) }}>
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-neutral-900">{selectedMember.full_name}</h3>
                <p className="text-xs text-neutral-500">{selectedMember.preferred_position || 'Player'} · {selectedMember.role === 'admin' ? 'Admin' : 'Member'}</p>
              </div>
              <button onClick={() => { setIsAdminActionOpen(false); setSelectedMember(null) }} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {selectedMember.role !== 'admin' ? (
                <button
                  disabled={adminActionLoading}
                  onClick={async () => {
                    setAdminActionLoading(true)
                    try {
                      await makeAdminAction(group.id, selectedMember.id)
                      setIsAdminActionOpen(false)
                      setSelectedMember(null)
                      router.refresh()
                    } catch (e: any) {
                      alert(e.message || 'Failed to make admin')
                    } finally {
                      setAdminActionLoading(false)
                    }
                  }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100 text-green-800 font-semibold text-sm hover:bg-green-100 transition-colors active:scale-[0.98]"
                >
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  Make Admin
                </button>
              ) : (
                <button
                  disabled={adminActionLoading}
                  onClick={async () => {
                    setAdminActionLoading(true)
                    try {
                      await removeAdminAction(group.id, selectedMember.id)
                      setIsAdminActionOpen(false)
                      setSelectedMember(null)
                      router.refresh()
                    } catch (e: any) {
                      alert(e.message || 'Failed to remove admin')
                    } finally {
                      setAdminActionLoading(false)
                    }
                  }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 font-semibold text-sm hover:bg-amber-100 transition-colors active:scale-[0.98]"
                >
                  <Shield className="w-5 h-5 text-amber-600" />
                  Remove Admin
                </button>
              )}

              <button
                disabled={adminActionLoading}
                onClick={() => {
                  setIsAdminActionOpen(false)
                  setIsConfirmRemoveOpen(true)
                }}
                className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors active:scale-[0.98]"
              >
                <UserMinus className="w-5 h-5 text-red-500" />
                Remove from Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Remove Modal */}
      {isConfirmRemoveOpen && selectedMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 shadow-2xl">
            <h3 className="font-bold text-xl text-neutral-900 mb-2">Remove {selectedMember.full_name?.split(' ')[0]}?</h3>
            <p className="text-neutral-600 mb-6 text-sm">This will remove them from <strong>{group.name}</strong>. They will need to rejoin using the invite code.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => { setIsConfirmRemoveOpen(false); setSelectedMember(null) }}>Cancel</Button>
              <Button
                disabled={adminActionLoading}
                className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                onClick={async () => {
                  setAdminActionLoading(true)
                  try {
                    await removeMemberAction(group.id, selectedMember.id)
                    setIsConfirmRemoveOpen(false)
                    setSelectedMember(null)
                    router.refresh()
                  } catch (e: any) {
                    alert(e.message || 'Failed to remove member')
                  } finally {
                    setAdminActionLoading(false)
                  }
                }}
              >
                {adminActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Group Modal */}
      {isLeaveGroupModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 shadow-2xl">
            <h3 className="font-bold text-xl text-neutral-900 mb-2">Leave Group?</h3>
            <p className="text-neutral-600 mb-6 text-sm">Are you sure you want to leave <strong>{group.name}</strong>? You will lose access to all matches and stats for this group.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsLeaveGroupModalOpen(false)}>Cancel</Button>
              <Button
                disabled={adminActionLoading}
                className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                onClick={async () => {
                  setAdminActionLoading(true)
                  try {
                    await leaveGroupAction(group.id)
                    router.push('/dashboard')
                  } catch (e: any) {
                    if (e.message?.includes('make someone else an admin')) {
                      setIsLeaveGroupModalOpen(false)
                      setIsLeaveWarningOpen(true)
                    } else {
                      alert(e.message || 'Failed to leave group')
                    }
                  } finally {
                    setAdminActionLoading(false)
                  }
                }}
              >
                {adminActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Leave'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Leave Warning Modal */}
      {isLeaveWarningOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-xl text-neutral-900 mb-2">Admin Required</h3>
              <p className="text-neutral-600 mb-6 text-sm">You are the only admin. You must promote another member to admin before you can leave this group.</p>
              <Button 
                className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"
                onClick={() => setIsLeaveWarningOpen(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      {isDeleteGroupModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                <UserMinus className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-xl text-neutral-900 mb-2">Delete Group?</h3>
              <p className="text-neutral-600 mb-6 text-sm">This action cannot be undone. All matches, stats, and member data for <strong>{group.name}</strong> will be permanently deleted.</p>
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsDeleteGroupModalOpen(false)}>Cancel</Button>
                <Button
                  disabled={adminActionLoading}
                  className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
                  onClick={async () => {
                    setAdminActionLoading(true)
                    try {
                      await deleteGroupAction(group.id)
                      router.push('/dashboard')
                    } catch (e: any) {
                      alert(e.message || 'Failed to delete group')
                    } finally {
                      setAdminActionLoading(false)
                    }
                  }}
                >
                  {adminActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
