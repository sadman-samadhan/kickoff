/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { MapPin, Clock, Calendar, CheckCircle, XCircle, Users, Shield, Map as MapIcon, Plus, ChevronRight, X, Loader2, Trophy, Goal, Star, MinusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rsvpAction } from '../../actions'
import { saveTeamsAction, generateScheduleAction, updateMatchScoreAction, adminAddRsvpAction, addGuestAction, updateMaxPlayersAction, updateTeamAction, deleteTeamAction, assignPlayerToTeamAction, rescheduleMatchesAction, adminRemoveRsvpAction } from './actions'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/modals/ConfirmModal'
import MatchdayShareCard from '@/components/cards/MatchdayShareCard'
import { CustomSelect } from '@/components/ui/select'
import { TourGuide } from '@/components/ui/TourGuide'

const PRESET_COLORS = [
  { label: 'Red', value: '#ef4444' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#ffffff' },
]

export default function MatchClient({
  booking,
  rsvps,
  teams,
  matchSchedule,
  goalEvents,
  currentUser,
  groupId,
  userRole,
  groupMembers = []
}: any) {
  const router = useRouter()
  
  // Players parsing
  const inPlayers = rsvps.filter((r: any) => r.status === 'in' && r.player_id !== null)
  const guestPlayers = rsvps.filter((r: any) => r.status === 'in' && r.player_id === null)
  const waitlistPlayers = rsvps.filter((r: any) => r.status === 'waitlist').sort((a: any, b: any) => (a.waitlist_position || 0) - (b.waitlist_position || 0))
  
  const allConfirmedPlayers = rsvps.filter((r: any) => r.status === 'in')
  const POS_ORDER: Record<string, number> = { 'GK': 1, 'DEF': 2, 'MID': 3, 'ATT': 4 }
  const allPlayersForTeam = [...allConfirmedPlayers]
    .map((p: any) => ({
      id: p.player_id ?? `guest_${p.id}`,
      name: p.profiles?.full_name || p.guest_name || 'Guest',
      position: p.profiles?.preferred_position || p.guest_position || 'ATT',
      isGuest: !p.player_id,
      rsvpId: p.id
    }))
    .sort((a: any, b: any) => {
      const ps = (POS_ORDER[a.position] || 5) - (POS_ORDER[b.position] || 5)
      return ps !== 0 ? ps : a.name.localeCompare(b.name)
    })
  const guestNamesMap: Record<string, string> = {}
  allPlayersForTeam.filter((p: any) => p.isGuest).forEach((p: any) => { guestNamesMap[p.rsvpId] = p.name })
  const sortOrder: Record<string, number> = { 'GK': 1, 'DEF': 2, 'MID': 3, 'ATT': 4 }
  const sortedInPlayers = [...allConfirmedPlayers].sort((a: any, b: any) => {
    const posA = a.profiles?.preferred_position || a.guest_position || 'ATT'
    const posB = b.profiles?.preferred_position || b.guest_position || 'ATT'
    return (sortOrder[posA] || 5) - (sortOrder[posB] || 5)
  })

  // RSVP state
  const myRsvpObj = rsvps.find((r: any) => r.player_id === currentUser.id)
  const myRsvp = myRsvpObj?.status || 'none'
  const [isConfirmOutOpen, setIsConfirmOutOpen] = useState(false)
  const [isRsvpLoading, setIsRsvpLoading] = useState(false)

  // Teams Form State
  const [isAddingTeams, setIsAddingTeams] = useState(false)
  const [teamForm, setTeamForm] = useState<Array<{ name: string, jerseyColor: string, captainId: string, playerIds: string[] }>>([{ name: '', jerseyColor: '#ffffff', captainId: '', playerIds: [] }, { name: '', jerseyColor: '#000000', captainId: '', playerIds: [] }])
  const [isTeamsLoading, setIsTeamsLoading] = useState(false)

  // Edit Team State
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editTeamForm, setEditTeamForm] = useState<{ name: string, jerseyColor: string, captainId: string, playerIds: string[] } | null>(null)
  const [isEditTeamLoading, setIsEditTeamLoading] = useState(false)

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  const handleStartEditTeam = (team: any) => {
    setEditingTeamId(team.id)
    setEditTeamForm({
      name: team.name,
      jerseyColor: team.jersey_color,
      captainId: team.captain_id || '',
      playerIds: team.team_players?.map((p: any) => p.player_id) || []
    })
  }

  const handleSaveEditTeam = async () => {
    if (!editingTeamId || !editTeamForm) return
    setIsEditTeamLoading(true)
    try {
      await updateTeamAction(editingTeamId, booking.id, groupId, { ...editTeamForm, guestNames: guestNamesMap })
      setEditingTeamId(null)
      setEditTeamForm(null)
      router.refresh()
    } catch (e) { console.error(e) }
    finally { setIsEditTeamLoading(false) }
  }

  const handleDeleteTeam = (teamId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Team',
      message: 'Are you sure you want to delete this team?',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteTeamAction(teamId, booking.id, groupId)
          router.refresh()
        } catch (e) { console.error(e) }
      }
    })
  }

  // Assign Player to Team State
  const [assigningPlayerId, setAssigningPlayerId] = useState<string | null>(null)
  
  const handleAssignPlayer = async (rsvp: any, newTeamId: string) => {
    setAssigningPlayerId(rsvp.id)
    try {
      await assignPlayerToTeamAction(booking.id, groupId, rsvp.player_id, rsvp.guest_name, rsvp.id, newTeamId || null)
    } catch (e) {
      console.error(e)
    } finally {
      setAssigningPlayerId(null)
    }
  }

  const getPlayerTeamId = (rsvp: any) => {
    if (rsvp.player_id) {
      const team = teams.find((t: any) => t.team_players?.some((tp: any) => tp.player_id === rsvp.player_id))
      return team?.id || ''
    } else {
      const team = teams.find((t: any) => t.guest_members?.includes(rsvp.id))
      return team?.id || ''
    }
  }

  const getPlayerTeam = (rsvp: any) => {
    if (rsvp.player_id) {
      return teams.find((t: any) => t.team_players?.some((tp: any) => tp.player_id === rsvp.player_id))
    } else {
      return teams.find((t: any) => t.guest_members?.includes(rsvp.id))
    }
  }

  const hexToRgba = (hex: string, opacity: number) => {
    let c = hex.replace('#', '')
    if (c.length === 3) {
      c = c.split('').map(x => x + x).join('')
    }
    const r = parseInt(c.substring(0, 2), 16) || 0
    const g = parseInt(c.substring(2, 4), 16) || 0
    const b = parseInt(c.substring(4, 6), 16) || 0
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)

  const getPositionColor = (pos: string) => {
    if (pos === 'GK') return 'bg-orange-100 text-orange-700 border-orange-200'
    if (pos === 'DEF') return 'bg-blue-100 text-blue-700 border-blue-200'
    if (pos === 'MID') return 'bg-green-100 text-green-700 border-green-200'
    if (pos === 'ATT') return 'bg-red-100 text-red-700 border-red-200'
    return 'bg-neutral-100 text-neutral-700 border-neutral-200'
  }

  // Add Member State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [selectedMembersToAdd, setSelectedMembersToAdd] = useState<string[]>([])
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null)

  const handleRemovePlayer = async (rsvpId: string) => {
    setRemovingPlayerId(rsvpId)
    try {
      await adminRemoveRsvpAction(booking.id, groupId, rsvpId)
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setRemovingPlayerId(null)
    }
  }

  const handleAdminAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedMembersToAdd.length === 0) return
    setIsAddingMember(true)
    try {
      await adminAddRsvpAction(booking.id, groupId, selectedMembersToAdd, booking.max_players)
      setIsAddMemberOpen(false)
      setSelectedMembersToAdd([])
      setMemberSearchQuery('')
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsAddingMember(false)
    }
  }

  // Guest State
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false)
  const [guestForm, setGuestForm] = useState({ name: '', position: 'Field Player' })
  const [isAddingGuest, setIsAddingGuest] = useState(false)

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestForm.name.trim()) return
    setIsAddingGuest(true)
    try {
      await addGuestAction(booking.id, groupId, guestForm.name.trim(), guestForm.position)
      setIsAddGuestOpen(false)
      setGuestForm({ name: '', position: 'Field Player' })
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsAddingGuest(false)
    }
  }

  // Max Players State
  const [isEditingMaxPlayers, setIsEditingMaxPlayers] = useState(false)
  const [maxPlayersInput, setMaxPlayersInput] = useState(booking.max_players)
  const [isSavingMaxPlayers, setIsSavingMaxPlayers] = useState(false)

  const handleSaveMaxPlayers = async () => {
    setIsSavingMaxPlayers(true)
    try {
      await updateMaxPlayersAction(booking.id, groupId, maxPlayersInput)
      setIsEditingMaxPlayers(false)
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSavingMaxPlayers(false)
    }
  }

  // Schedule Form State
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false)
  const [scheduleType, setScheduleType] = useState('1-Leg League')
  
  // Score Entry & Goal State
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [scoreForms, setScoreForms] = useState<Record<string, { homeScore: number, awayScore: number }>>({})
  
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false)
  const [goalForm, setGoalForm] = useState({ teamId: '', scorerId: '', assistId: '', minute: '', isOwnGoal: false })
  const [isGoalLoading, setIsGoalLoading] = useState(false)
  const [isScoreLoading, setIsScoreLoading] = useState(false)

  // Cancel Match State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('Field flooded')
  const [cancelReasonOther, setCancelReasonOther] = useState('')
  
  // Field Rating State
  const [fieldRating, setFieldRating] = useState(0)
  const [fieldReview, setFieldReview] = useState('')
  const [isRatingLoading, setIsRatingLoading] = useState(false)
  const [hasRated, setHasRated] = useState(false)
  const [ratingHover, setRatingHover] = useState(0)

  // Matchday Report Tab State
  const [activeReportTab, setActiveReportTab] = useState<'points' | 'players'>('points')
  
  const canCancel = userRole === 'admin' || currentUser.id === booking.created_by
  const matchDateTimeStr = `${booking.match_date}T${booking.match_time || '00:00:00'}`
  const matchStartTime = new Date(matchDateTimeStr).getTime()
  const isMatchStarted = Date.now() >= matchStartTime
  const isMatchHistory = Date.now() >= matchStartTime + (5 * 60 * 60 * 1000)

  const displayStatus = booking.status === 'cancelled' ? 'cancelled' :
                        (booking.status === 'completed' || isMatchHistory) ? 'history' :
                        (isMatchStarted || booking.status === 'ongoing') ? 'ongoing' :
                        'upcoming'

  // Matchday Report Calculations
  // 1. Points Table
  interface TeamStats {
    id: string
    name: string
    jerseyColor: string
    played: number
    won: number
    drawn: number
    lost: number
    goalsFor: number
    goalsAgainst: number
    goalDifference: number
    points: number
  }

  const pointsTable: Record<string, TeamStats> = {}
  
  // Initialize with all teams
  teams.forEach((t: any) => {
    pointsTable[t.id] = {
      id: t.id,
      name: t.name || 'Team',
      jerseyColor: t.jersey_color || '#ffffff',
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0
    }
  })

  // Calculate stats from completed matches
  matchSchedule.forEach((match: any) => {
    if (match.status === 'completed') {
      const homeStats = pointsTable[match.home_team_id]
      const awayStats = pointsTable[match.away_team_id]
      
      if (homeStats && awayStats) {
        const homeScore = match.home_score || 0
        const awayScore = match.away_score || 0
        
        homeStats.played += 1
        awayStats.played += 1
        
        homeStats.goalsFor += homeScore
        homeStats.goalsAgainst += awayScore
        
        awayStats.goalsFor += awayScore
        awayStats.goalsAgainst += homeScore
        
        if (homeScore > awayScore) {
          homeStats.won += 1
          homeStats.points += 3
          awayStats.lost += 1
        } else if (awayScore > homeScore) {
          awayStats.won += 1
          awayStats.points += 3
          homeStats.lost += 1
        } else {
          homeStats.drawn += 1
          homeStats.points += 1
          awayStats.drawn += 1
          awayStats.points += 1
        }
      }
    }
  })

  // Update Goal Difference and sort
  const sortedPointsTable = Object.values(pointsTable).map(t => ({
    ...t,
    goalDifference: t.goalsFor - t.goalsAgainst
  })).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return a.name.localeCompare(b.name)
  })

  // 2. Top Players Table (Goals, Assists & Cleansheets)
  interface PlayerStats {
    id: string
    name: string
    isGuest: boolean
    teamId: string
    goals: number
    assists: number
    cleanSheets: number
    teamPoints: number
  }

  const playerStatsMap: Record<string, PlayerStats> = {}

  // Initialize with all players that participated (registered + guests)
  allPlayersForTeam.forEach(p => {
    const rsvpObj = rsvps.find((r: any) => r.id === p.rsvpId)
    const teamId = rsvpObj ? getPlayerTeamId(rsvpObj) : ''
    const teamStats = sortedPointsTable.find(t => t.id === teamId)
    playerStatsMap[p.id] = {
      id: p.id,
      name: p.name,
      isGuest: p.isGuest,
      teamId: teamId,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      teamPoints: teamStats ? teamStats.points : 0
    }
  })

  // Calculate goals and assists
  goalEvents.forEach((g: any) => {
    // Goals
    if (!g.is_own_goal) {
      let scorerKey = null
      if (g.scorer_id) {
        scorerKey = g.scorer_id
      } else if (g.guest_scorer_name) {
        const found = allPlayersForTeam.find(p => p.isGuest && p.name === g.guest_scorer_name)
        if (found) scorerKey = found.id
      }
      if (scorerKey && playerStatsMap[scorerKey]) {
        playerStatsMap[scorerKey].goals += 1
      }
    }

    // Assists
    let assistKey = null
    if (g.assist_id) {
      assistKey = g.assist_id
    } else if (g.guest_assist_name) {
      const found = allPlayersForTeam.find(p => p.isGuest && p.name === g.guest_assist_name)
      if (found) assistKey = found.id
    }
    if (assistKey && playerStatsMap[assistKey]) {
      playerStatsMap[assistKey].assists += 1
    }
  })

  // Calculate clean sheets
  matchSchedule.forEach((match: any) => {
    if (match.status === 'completed') {
      const homeScore = match.home_score || 0
      const awayScore = match.away_score || 0

      if (awayScore === 0) {
        // Home team clean sheet
        Object.values(playerStatsMap).forEach(p => {
          if (p.teamId === match.home_team_id) {
            p.cleanSheets += 1
          }
        })
      }

      if (homeScore === 0) {
        // Away team clean sheet
        Object.values(playerStatsMap).forEach(p => {
          if (p.teamId === match.away_team_id) {
            p.cleanSheets += 1
          }
        })
      }
    }
  })

  const sortedTopPlayers = Object.values(playerStatsMap)
    .filter(p => p.goals > 0 || p.assists > 0 || p.cleanSheets > 0)
    .sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals
      if (b.assists !== a.assists) return b.assists - a.assists
      if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets
      if (b.teamPoints !== a.teamPoints) return b.teamPoints - a.teamPoints
      return a.name.localeCompare(b.name)
    })

  // 3. Share Card Stats
  const hasCompletedMatches = matchSchedule.some((m: any) => m.status === 'completed')
  const championName = hasCompletedMatches && sortedPointsTable.length > 0 ? sortedPointsTable[0].name : 'TBD'
  const runnersUpName = hasCompletedMatches && sortedPointsTable.length > 1 ? sortedPointsTable[1].name : 'TBD'
  const championColor = hasCompletedMatches && sortedPointsTable.length > 0 ? sortedPointsTable[0].jerseyColor : undefined
  const championStats = hasCompletedMatches && sortedPointsTable.length > 0
    ? { points: sortedPointsTable[0].points, gd: sortedPointsTable[0].goalDifference }
    : undefined
  const runnersUpStats = hasCompletedMatches && sortedPointsTable.length > 1
    ? { points: sortedPointsTable[1].points, gd: sortedPointsTable[1].goalDifference }
    : undefined

  // Top Scorer Name (absolute top player by tie-breakers)
  let topScorerText = 'TBD'
  const playersWithGoals = sortedTopPlayers.filter(p => p.goals > 0)
  if (playersWithGoals.length > 0) {
    const topPlayer = playersWithGoals[0]
    topScorerText = `${topPlayer.name} (${topPlayer.goals} Goal${topPlayer.goals > 1 ? 's' : ''})`
  }

  const handleRsvp = async (status: string) => {
    if (status === 'out' && myRsvp === 'in' && waitlistPlayers.length > 0) {
      setIsConfirmOutOpen(true)
      return
    }
    await executeRsvp(status)
  }

  const executeRsvp = async (status: string) => {
    setIsRsvpLoading(true)
    setIsConfirmOutOpen(false)
    try {
      await rsvpAction(booking.id, groupId, status, booking.max_players)
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsRsvpLoading(false)
    }
  }

  const handleSaveTeams = async () => {
    setIsTeamsLoading(true)
    try {
      await saveTeamsAction(booking.id, groupId, teamForm.map(t => ({ ...t, guestNames: guestNamesMap })))
      setIsAddingTeams(false)
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsTeamsLoading(false)
    }
  }

  const handleGenerateSchedule = async () => {
    setIsGeneratingSchedule(true)
    try {
      await generateScheduleAction(booking.id, groupId, teams, scheduleType)
    } catch (e) {
      console.error(e)
    } finally {
      setIsGeneratingSchedule(false)
    }
  }

  const handleReschedule = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reschedule Matches',
      message: 'Are you sure you want to delete the current schedule and create a new one? All scores and goal events will be lost.',
      confirmText: 'Reschedule',
      onConfirm: async () => {
        try {
          await rescheduleMatchesAction(booking.id, groupId)
        } catch (e) {
          console.error(e)
        }
      }
    })
  }

  const handleExpandMatch = (match: any) => {
    if (expandedMatchId === match.id) {
      setExpandedMatchId(null)
    } else {
      setExpandedMatchId(match.id)
      setScoreForms({
        ...scoreForms,
        [match.id]: { homeScore: match.home_score || 0, awayScore: match.away_score || 0 }
      })
    }
  }

  const handleSaveScore = async (matchId: string) => {
    setIsScoreLoading(true)
    try {
      const form = scoreForms[matchId] || { homeScore: 0, awayScore: 0 }
      
      await fetch(`/api/matches/${matchId}/score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_score: form.homeScore, away_score: form.awayScore, status: 'completed' })
      })

      await fetch(`/api/matches/${matchId}/complete`, {
        method: 'POST'
      })

      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsScoreLoading(false)
    }
  }

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expandedMatchId) return
    setIsGoalLoading(true)
    try {
      let guestScorerName = null
      if (goalForm.scorerId.startsWith('guest_')) {
        const rsvpId = goalForm.scorerId.replace('guest_', '')
        const rsvp = rsvps.find((r: any) => r.id === rsvpId)
        guestScorerName = rsvp ? rsvp.guest_name : 'Guest'
      }

      let guestAssistName = null
      if (goalForm.assistId && goalForm.assistId.startsWith('guest_')) {
        const rsvpId = goalForm.assistId.replace('guest_', '')
        const rsvp = rsvps.find((r: any) => r.id === rsvpId)
        guestAssistName = rsvp ? rsvp.guest_name : 'Guest'
      }

      await fetch(`/api/matches/${expandedMatchId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: goalForm.teamId,
          scorer_id: goalForm.scorerId,
          guest_scorer_name: guestScorerName,
          assist_id: goalForm.assistId || null,
          guest_assist_name: guestAssistName,
          minute: parseInt(goalForm.minute) || null,
          is_own_goal: goalForm.isOwnGoal
        })
      })
      setIsAddGoalOpen(false)
      setGoalForm({ teamId: '', scorerId: '', assistId: '', minute: '', isOwnGoal: false })
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsGoalLoading(false)
    }
  }

  const handleDeleteGoal = (goalId: string, matchId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Goal',
      message: 'Are you sure you want to delete this goal?',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await fetch(`/api/matches/${matchId}/goals/${goalId}`, { method: 'DELETE' })
          router.refresh()
        } catch (e) {
          console.error(e)
        }
      }
    })
  }

  const handleCancelMatch = async () => {
    setIsCancelling(true)
    const finalReason = cancelReason === 'Other' 
      ? (cancelReasonOther.trim() ? `Other: ${cancelReasonOther.trim()}` : 'Other')
      : cancelReason;

    try {
      await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, reason: finalReason })
      })
      router.push(`/groups/${groupId}`)
    } catch (e) {
      console.error(e)
    } finally {
      setIsCancelling(false)
    }
  }

  const getTeamName = (teamId: string) => teams.find((t: any) => t.id === teamId)?.name || 'Team'

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 max-w-xl mx-auto min-h-screen pb-24">
      <TourGuide page="match" />
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-2">
        <Link href={`/groups/${groupId}`} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-neutral-200 text-neutral-500">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </Link>
        <h1 className="text-xl font-bold text-neutral-900 truncate">{(booking.groups as any).name} Match</h1>
      </div>

      {/* 1. MATCH INFO CARD */}
      <div data-tour="match-info" className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2.5 py-1 rounded-md">
            <Calendar className="w-4 h-4" />
            {format(parseISO(booking.match_date), 'MMM d, yyyy')}
          </div>
          <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
            displayStatus === 'upcoming' ? 'bg-amber-100 text-amber-700' :
            displayStatus === 'ongoing' ? 'bg-blue-100 text-blue-700' :
            'bg-neutral-100 text-neutral-700'
          }`}>
            {displayStatus === 'history' ? 'Match History' : displayStatus}
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-neutral-700 mb-2">
          <Clock className="w-5 h-5 text-neutral-400" />
          <span className="font-semibold text-lg">{booking.match_time.slice(0,5)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 text-neutral-700">
            <MapPin className="w-5 h-5 text-neutral-400" />
            <span className="font-medium">{booking.field_name}</span>
          </div>
          {booking.google_maps_url && (
            <a href={booking.google_maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-2 rounded-xl transition-colors text-xs font-semibold">
              <MapIcon className="w-4 h-4" />
              <span>Open in Maps</span>
            </a>
          )}
        </div>
        
        {displayStatus === 'cancelled' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl">
            <h4 className="text-red-700 font-bold text-sm mb-1 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Match Cancelled
            </h4>
            {booking.cancellation_reason && (
              <p className="text-red-600 text-sm"><strong>Reason:</strong> {booking.cancellation_reason}</p>
            )}
          </div>
        )}
        
        {canCancel && displayStatus === 'upcoming' && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <Button 
              variant="outline" 
              onClick={() => setIsCancelModalOpen(true)}
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
            >
              Cancel Match
            </Button>
          </div>
        )}
      </div>

      {/* 3. RSVP WIDGET */}
      {displayStatus === 'upcoming' && (
        <div data-tour="match-rsvp" className="grid grid-cols-2 gap-3">
          <Button 
            onClick={() => handleRsvp('in')}
            disabled={isRsvpLoading}
            className={`h-14 rounded-2xl text-base shadow-sm transition-all ${myRsvp === 'in' ? 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-600 ring-offset-2' : 'bg-white text-green-700 border-2 border-green-100 hover:bg-green-50'}`}
          >
            <CheckCircle className={`w-5 h-5 mr-2 ${myRsvp === 'in' ? 'text-white' : 'text-green-600'}`} />
            I&apos;m In
          </Button>
          <Button 
            onClick={() => handleRsvp('out')}
            disabled={isRsvpLoading}
            className={`h-14 rounded-2xl text-base shadow-sm transition-all ${myRsvp === 'out' ? 'bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-500 ring-offset-2' : 'bg-white text-red-600 border-2 border-red-100 hover:bg-red-50'}`}
          >
            <XCircle className={`w-5 h-5 mr-2 ${myRsvp === 'out' ? 'text-white' : 'text-red-500'}`} />
            I&apos;m Out
          </Button>
        </div>
      )}

      {/* 2. PLAYER LIST CARD */}
      <div data-tour="match-players" className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
        <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50 rounded-t-2xl">
          <h3 className="font-bold text-neutral-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-neutral-500" />
            Confirmed Players
          </h3>
          <div className="flex items-center gap-2">
            {userRole === 'admin' && (
              isEditingMaxPlayers ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number" min="1" max="50"
                    className="w-14 px-2 py-1 text-sm border rounded-lg text-center"
                    value={maxPlayersInput}
                    onChange={e => setMaxPlayersInput(parseInt(e.target.value) || 1)}
                  />
                  <button onClick={handleSaveMaxPlayers} disabled={isSavingMaxPlayers} className="text-green-600 hover:text-green-700 p-1">
                    {isSavingMaxPlayers ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setIsEditingMaxPlayers(false)} className="text-neutral-400 hover:text-neutral-600 p-1"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={() => { setMaxPlayersInput(booking.max_players); setIsEditingMaxPlayers(true) }} className="text-sm font-bold text-neutral-500 bg-white px-2 py-1 rounded-md border border-neutral-200 shadow-sm hover:border-neutral-400 transition-colors">
                  <span className={allConfirmedPlayers.length >= booking.max_players ? 'text-green-600' : 'text-neutral-900'}>{allConfirmedPlayers.length}</span> / {booking.max_players}
                </button>
              )
            )}
            {userRole !== 'admin' && (
              <span className="text-sm font-bold text-neutral-500 bg-white px-2 py-1 rounded-md border border-neutral-200 shadow-sm">
                <span className={allConfirmedPlayers.length >= booking.max_players ? 'text-green-600' : 'text-neutral-900'}>{allConfirmedPlayers.length}</span> / {booking.max_players}
              </span>
            )}
          </div>
        </div>
        
        <div className="divide-y divide-neutral-50">
          {sortedInPlayers.map((rsvp: any) => {
            const playerTeam = getPlayerTeam(rsvp)
            const playerPos = rsvp.profiles?.preferred_position || rsvp.guest_position || 'Field Player'
            const rowStyle = playerTeam?.jersey_color
              ? { backgroundColor: hexToRgba(playerTeam.jersey_color, 0.25) }
              : undefined
            return (
              <div key={rsvp.id} style={rowStyle} className="p-3.5 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {rsvp.profiles?.avatar_url ? (
                    <img src={(rsvp.profiles as any).avatar_url} className="w-11 h-11 rounded-full object-cover border border-neutral-100 shadow-sm flex-shrink-0" alt={(rsvp.profiles as any)?.full_name || 'Player'} />
                  ) : (
                    <div className={`w-11 h-11 rounded-full font-bold flex items-center justify-center border text-lg flex-shrink-0 ${rsvp.guest_name ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                      {(rsvp.profiles?.full_name || rsvp.guest_name || 'P').charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-neutral-900 leading-tight flex items-center gap-1.5 truncate">
                      {rsvp.profiles?.full_name || rsvp.guest_name || 'Anonymous Player'}
                      {rsvp.guest_name && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">Guest</span>}
                    </span>
                    <div className="mt-0.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getPositionColor(playerPos)}`}>
                        {playerPos}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {userRole === 'admin' ? (
                    assigningPlayerId === rsvp.id || removingPlayerId === rsvp.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-neutral-400 mx-2" />
                    ) : (
                      <div className="flex items-center gap-2">
                        {teams.length > 0 && (
                          <CustomSelect
                            value={getPlayerTeamId(rsvp)}
                            onChange={(val) => handleAssignPlayer(rsvp, val)}
                            placeholder="No Team"
                            buttonClassName="text-xs border border-neutral-200 rounded bg-white shadow-sm py-1 px-2 focus:ring-1 focus:ring-green-600 focus:border-green-600 outline-none w-[100px] h-[28px]"
                            dropdownClassName="w-[120px] right-0"
                            options={[
                              { value: '', label: 'No Team' },
                              ...teams.map((t: any) => ({ value: t.id, label: t.name }))
                            ]}
                          />
                        )}
                        {!getPlayerTeamId(rsvp) && (
                          <button
                            type="button"
                            onClick={() => handleRemovePlayer(rsvp.id)}
                            className="p-1 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove player"
                          >
                            <MinusCircle className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                      <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">In</span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {sortedInPlayers.length === 0 && (
            <div className="p-8 text-center text-neutral-400 text-sm italic">No players confirmed yet.</div>
          )}
        </div>

        {userRole === 'admin' && displayStatus === 'upcoming' && (
          <div className={`p-3 border-t border-neutral-100 bg-neutral-50 flex gap-2 ${waitlistPlayers.length === 0 ? 'rounded-b-2xl' : ''}`}>
            <Button variant="outline" className="flex-1 h-10 border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-100" onClick={() => setIsAddMemberOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Member
            </Button>
            {allConfirmedPlayers.length < booking.max_players && (
              <Button variant="outline" className="flex-1 h-10 border-dashed border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => setIsAddGuestOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Guest
              </Button>
            )}
          </div>
        )}

        {waitlistPlayers.length > 0 && (
          <>
            <div className="p-3 border-y border-neutral-100 bg-purple-50 flex justify-between items-center">
              <h4 className="font-bold text-purple-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" /> Waitlist
              </h4>
              <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">{waitlistPlayers.length} waiting</span>
            </div>
            <div className="divide-y divide-neutral-50 bg-purple-50/30 rounded-b-2xl">
              {waitlistPlayers.map((rsvp: any, index: number) => (
                <div key={rsvp.id} className="p-3 flex items-center gap-3 opacity-80 last:rounded-b-2xl">
                  <span className="text-xs font-bold text-neutral-400 w-4">{index + 1}.</span>
                  {(rsvp.profiles as any).avatar_url ? (
                    <img src={(rsvp.profiles as any).avatar_url} className="w-8 h-8 rounded-full object-cover grayscale" alt={(rsvp.profiles as any).full_name || 'Waitlist player'} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-500 font-bold flex items-center justify-center text-xs">
                      {(rsvp.profiles as any).full_name?.charAt(0)}
                    </div>
                  )}
                  <span className="font-medium text-neutral-700 text-sm">{(rsvp.profiles as any).full_name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 4. TEAMS SECTION */}
      {displayStatus !== 'cancelled' && (
        <div data-tour="match-teams" className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center rounded-t-2xl">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-neutral-500" />
              Teams
            </h3>
          </div>
          
          <div className="p-4">
            {teams.length === 0 ? (
              isAddingTeams ? (
                <div className="space-y-4">
                  {teamForm.map((t, idx) => (
                    <div key={idx} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                      <h4 className="font-bold text-sm text-neutral-700">Team {idx + 1}</h4>
                      <input 
                        type="text" 
                        placeholder="Team Name (e.g. Red Team)" 
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={t.name}
                        onChange={e => {
                          const newForm = [...teamForm]
                          newForm[idx].name = e.target.value
                          setTeamForm(newForm)
                        }}
                      />
                      <div className="flex gap-3 items-center flex-wrap">
                        <label className="text-xs text-neutral-500 font-semibold w-full">Color:</label>
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => {
                              const newForm = [...teamForm]
                              newForm[idx].jerseyColor = c.value
                              setTeamForm(newForm)
                            }}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${t.jerseyColor === c.value ? 'ring-2 ring-offset-2 ring-neutral-900 scale-110' : 'border-neutral-200 hover:scale-105'}`}
                            style={{ backgroundColor: c.value }}
                            title={c.label}
                          />
                        ))}
                        <div className="relative flex items-center justify-center">
                          <input 
                            type="color" 
                            className={`w-8 h-8 rounded-full cursor-pointer opacity-0 absolute inset-0 z-10`}
                            value={PRESET_COLORS.some(c => c.value === t.jerseyColor) ? '#cccccc' : t.jerseyColor}
                            onChange={e => {
                              const newForm = [...teamForm]
                              newForm[idx].jerseyColor = e.target.value
                              setTeamForm(newForm)
                            }}
                            title="Other"
                          />
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 transition-all ${!PRESET_COLORS.some(c => c.value === t.jerseyColor) ? 'ring-2 ring-offset-2 ring-neutral-900 scale-110' : 'border-neutral-200 hover:scale-105'}`} />
                        </div>
                      </div>
                      <CustomSelect
                        value={t.captainId}
                        onChange={val => {
                          const newForm = [...teamForm]
                          const prevCaptain = newForm[idx].captainId
                          newForm[idx].captainId = val
                          newForm[idx].playerIds = newForm[idx].playerIds.filter((id: string) => id !== prevCaptain)
                          if (val) newForm[idx].playerIds = Array.from(new Set([...newForm[idx].playerIds, val]))
                          setTeamForm(newForm)
                        }}
                        placeholder="Select Captain..."
                        buttonClassName="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                        options={[
                          { value: '', label: 'Select Captain...' },
                          ...allPlayersForTeam.map((p: any) => ({
                            value: p.id,
                            label: `${p.name}${p.isGuest ? ' (Guest)' : ''}`
                          }))
                        ]}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setTeamForm([...teamForm, { name: '', jerseyColor: '#cccccc', captainId: '', playerIds: [] }])}>
                      <Plus className="w-4 h-4 mr-1" /> Add Team
                    </Button>
                    <Button className="flex-1 bg-neutral-900 text-white" onClick={handleSaveTeams} disabled={isTeamsLoading}>
                      {isTeamsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Teams'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-neutral-500 mb-3">No teams have been created for this match yet.</p>
                  <Button onClick={() => setIsAddingTeams(true)} className="bg-neutral-900 text-white rounded-xl">
                    <Plus className="w-4 h-4 mr-2" /> Add Teams
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-3">
                {userRole === 'admin' && !editingTeamId && (
                  <Button variant="outline" className="w-full border-dashed text-neutral-600" onClick={() => {
                    setIsAddingTeams(true)
                    setTeamForm([{ name: '', jerseyColor: '#cccccc', captainId: '', playerIds: [] }])
                  }}>
                    <Plus className="w-4 h-4 mr-1" /> Add Another Team
                  </Button>
                )}
                {isAddingTeams && (
                  <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                    <h4 className="font-bold text-sm text-neutral-700">New Team</h4>
                    <input type="text" placeholder="Team Name" className="w-full px-3 py-2 text-sm border rounded-lg"
                      value={teamForm[0]?.name || ''}
                      onChange={e => setTeamForm([{ ...teamForm[0], name: e.target.value }])} />
                    <div className="flex gap-3 items-center flex-wrap">
                      <label className="text-xs text-neutral-500 font-semibold w-full">Color:</label>
                      {PRESET_COLORS.map(c => (
                        <button key={c.value} type="button" onClick={() => setTeamForm([{ ...teamForm[0], jerseyColor: c.value }])}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${teamForm[0]?.jerseyColor === c.value ? 'ring-2 ring-offset-2 ring-neutral-900 scale-110' : 'border-neutral-200 hover:scale-105'}`}
                          style={{ backgroundColor: c.value }} title={c.label} />
                      ))}
                    </div>
                      <CustomSelect
                        value={teamForm[0]?.captainId || ''}
                        onChange={val => {
                          const prev = teamForm[0]?.captainId || ''
                          const ids = (teamForm[0]?.playerIds || []).filter((id: string) => id !== prev)
                          const next = val ? Array.from(new Set([...ids, val])) : ids
                          setTeamForm([{ ...teamForm[0], captainId: val, playerIds: next }])
                        }}
                        placeholder="Select Captain..."
                        buttonClassName="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                        options={[
                          { value: '', label: 'Select Captain...' },
                          ...allPlayersForTeam.map((p: any) => ({
                            value: p.id,
                            label: `${p.name}${p.isGuest ? ' (Guest)' : ''}`
                          }))
                        ]}
                      />
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setIsAddingTeams(false)}>Cancel</Button>
                      <Button className="flex-1 bg-neutral-900 text-white" onClick={handleSaveTeams} disabled={isTeamsLoading}>
                        {isTeamsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Team'}
                      </Button>
                    </div>
                  </div>
                )}
                {teams.map((team: any) => (
                  editingTeamId === team.id && editTeamForm ? (
                    <div key={team.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                      <h4 className="font-bold text-sm text-neutral-700">Edit {team.name}</h4>
                      <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg" value={editTeamForm.name}
                        onChange={e => setEditTeamForm({ ...editTeamForm, name: e.target.value })} />
                      <div className="flex gap-3 items-center flex-wrap">
                        <label className="text-xs text-neutral-500 font-semibold w-full">Color:</label>
                        {PRESET_COLORS.map(c => (
                          <button key={c.value} type="button" onClick={() => setEditTeamForm({ ...editTeamForm, jerseyColor: c.value })}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${editTeamForm.jerseyColor === c.value ? 'ring-2 ring-offset-2 ring-neutral-900 scale-110' : 'border-neutral-200 hover:scale-105'}`}
                            style={{ backgroundColor: c.value }} title={c.label} />
                        ))}
                        <div className="relative flex items-center justify-center">
                          <input type="color" className="w-8 h-8 rounded-full cursor-pointer opacity-0 absolute inset-0 z-10"
                            value={PRESET_COLORS.some(c => c.value === editTeamForm.jerseyColor) ? '#cccccc' : editTeamForm.jerseyColor}
                            onChange={e => setEditTeamForm({ ...editTeamForm, jerseyColor: e.target.value })} />
                          <div className={`w-8 h-8 rounded-full border-2 bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 transition-all ${!PRESET_COLORS.some(c => c.value === editTeamForm.jerseyColor) ? 'ring-2 ring-offset-2 ring-neutral-900 scale-110' : 'border-neutral-200'}`} />
                        </div>
                      </div>
                      <CustomSelect
                        value={editTeamForm.captainId}
                        onChange={val => {
                          const prev = editTeamForm.captainId
                          const ids = editTeamForm.playerIds.filter(id => id !== prev)
                          const next = val ? Array.from(new Set([...ids, val])) : ids
                          setEditTeamForm({ ...editTeamForm, captainId: val, playerIds: next })
                        }}
                        placeholder="Select Captain..."
                        buttonClassName="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                        options={[
                          { value: '', label: 'Select Captain...' },
                          ...allPlayersForTeam.map((p: any) => ({
                            value: p.id,
                            label: `${p.name}${p.isGuest ? ' (Guest)' : ''}`
                          }))
                        ]}
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => { setEditingTeamId(null); setEditTeamForm(null) }}>Cancel</Button>
                        <Button className="flex-1 bg-neutral-900 text-white" onClick={handleSaveEditTeam} disabled={isEditTeamLoading}>
                          {isEditTeamLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div key={team.id} className="border rounded-xl" style={{ borderColor: team.jersey_color }}>
                      <div 
                        onClick={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-neutral-50/50 transition-colors rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.jersey_color }} />
                          <div>
                            <h4 className="font-bold text-sm flex items-center gap-1.5">
                              {team.name}
                              {expandedTeamId === team.id ? (
                                <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                              ) : (
                                <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              )}
                            </h4>
                            <div className="text-[10px] text-neutral-400">
                              {team.team_players?.length || 0} players{team.guest_members?.length > 0 ? ` + ${team.guest_members.length} guest(s)` : ''}
                            </div>
                          </div>
                        </div>
                        {userRole === 'admin' && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleStartEditTeam(team)} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => handleDeleteTeam(team.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {expandedTeamId === team.id && (
                        <div className="border-t px-3 py-2 bg-neutral-50/50 rounded-b-xl space-y-1.5 text-xs text-neutral-700">
                          {team.team_players?.length === 0 && (!team.guest_members || team.guest_members.length === 0) && (
                            <div className="text-neutral-400 italic py-1">No players assigned yet.</div>
                          )}
                          {team.team_players?.map((tp: any) => {
                            const isCaptain = team.captain_id === tp.player_id
                            const rsvp = rsvps.find((r: any) => r.player_id === tp.player_id)
                            const pos = rsvp?.profiles?.preferred_position || 'Field Player'
                            return (
                              <div key={tp.player_id} className="flex justify-between items-center py-1 border-b border-neutral-100/50 last:border-0">
                                <span className="font-semibold flex items-center gap-1">
                                  {tp.profiles?.full_name || 'Player'}
                                  {isCaptain && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1 py-0.2 rounded uppercase">C</span>}
                                </span>
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded border uppercase tracking-wider ${getPositionColor(pos)}`}>
                                  {pos}
                                </span>
                              </div>
                            )
                          })}
                          {team.guest_members?.map((gId: string) => {
                            const rsvp = rsvps.find((r: any) => r.id === gId)
                            if (!rsvp) return null
                            const isCaptain = team.captain_id === `guest_${rsvp.id}`
                            const pos = rsvp.guest_position || 'Field Player'
                            return (
                              <div key={gId} className="flex justify-between items-center py-1 border-b border-neutral-100/50 last:border-0">
                                <span className="font-semibold text-neutral-600 flex items-center gap-1">
                                  {rsvp.guest_name} <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded">Guest</span>
                                  {isCaptain && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1 py-0.2 rounded uppercase">C</span>}
                                </span>
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded border uppercase tracking-wider ${getPositionColor(pos)}`}>
                                  {pos}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MATCH SCHEDULE */}
      {teams.length > 0 && (
        <div data-tour="match-schedule" className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-neutral-500" />
              Schedule & Scores
            </h3>
            {matchSchedule.length > 0 && userRole === 'admin' && (
              <Button variant="outline" size="sm" onClick={handleReschedule} className="h-8 text-xs text-amber-700 border-amber-200 hover:bg-amber-50">
                Reschedule
              </Button>
            )}
          </div>
          
          <div className="p-4">
            {matchSchedule.length === 0 ? (
              <div className="space-y-3">
                <CustomSelect
                  value={scheduleType}
                  onChange={val => setScheduleType(val)}
                  placeholder="Select schedule type..."
                  buttonClassName="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  options={[
                    { value: '1-Leg League', label: '1-Leg League' },
                    { value: '2-Leg League', label: '2-Leg League' }
                  ]}
                />
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl" onClick={handleGenerateSchedule} disabled={isGeneratingSchedule}>
                  {isGeneratingSchedule ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
                  Generate Schedule
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {matchSchedule.map((match: any) => {
                  const isCompleted = match.status === 'completed'
                  const isExpanded = expandedMatchId === match.id
                  const matchGoals = goalEvents.filter((g: any) => g.match_schedule_id === match.id)
                  
                  return (
                    <div key={match.id} className={`rounded-xl border transition-colors overflow-hidden ${isCompleted ? 'bg-neutral-50 border-neutral-200' : 'bg-white border-green-100 hover:border-green-300 shadow-sm'}`}>
                      <div 
                        onClick={() => handleExpandMatch(match)}
                        className="p-3 flex justify-between items-center cursor-pointer"
                      >
                        <div className="flex-1 flex justify-end items-center gap-2">
                          <span className="font-bold text-sm text-neutral-800">{getTeamName(match.home_team_id)}</span>
                          {isCompleted && <span className="text-lg font-black">{match.home_score}</span>}
                        </div>
                        
                        <div className="px-3 py-1 bg-neutral-100 text-[10px] font-bold text-neutral-500 rounded mx-2">
                          VS
                        </div>
                        
                        <div className="flex-1 flex justify-start items-center gap-2">
                          {isCompleted && <span className="text-lg font-black">{match.away_score}</span>}
                          <span className="font-bold text-sm text-neutral-800">{getTeamName(match.away_team_id)}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 border-t border-neutral-100 bg-white">
                          <div className="flex justify-between items-center gap-4 mb-6">
                            <div className="flex-1 text-center">
                              <div className="text-xs font-bold text-neutral-500 mb-2 uppercase truncate">{getTeamName(match.home_team_id)}</div>
                              <input 
                                type="number" min="0"
                                className="w-16 h-16 text-center text-3xl font-black bg-neutral-100 rounded-2xl border-none focus:ring-2 focus:ring-green-500"
                                value={scoreForms[match.id]?.homeScore ?? (match.home_score || 0)}
                                onChange={e => setScoreForms({...scoreForms, [match.id]: {...scoreForms[match.id], homeScore: parseInt(e.target.value) || 0}})}
                              />
                            </div>
                            <span className="text-xl font-black text-neutral-300">-</span>
                            <div className="flex-1 text-center">
                              <div className="text-xs font-bold text-neutral-500 mb-2 uppercase truncate">{getTeamName(match.away_team_id)}</div>
                              <input 
                                type="number" min="0"
                                className="w-16 h-16 text-center text-3xl font-black bg-neutral-100 rounded-2xl border-none focus:ring-2 focus:ring-green-500"
                                value={scoreForms[match.id]?.awayScore ?? (match.away_score || 0)}
                                onChange={e => setScoreForms({...scoreForms, [match.id]: {...scoreForms[match.id], awayScore: parseInt(e.target.value) || 0}})}
                              />
                            </div>
                          </div>
                          <Button className="w-full h-12 bg-neutral-900 hover:bg-black text-white rounded-xl text-sm font-bold mb-6" onClick={() => handleSaveScore(match.id)} disabled={isScoreLoading}>
                            {isScoreLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Score & Complete'}
                          </Button>

                          <div className="border-t border-neutral-100 pt-4">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5"><Goal className="w-3.5 h-3.5 text-neutral-500"/> Goals</h4>
                              <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 rounded-lg" onClick={() => setIsAddGoalOpen(true)}>
                                <Plus className="w-3 h-3 mr-1" /> Add
                              </Button>
                            </div>

                            <div className="space-y-2">
                              {matchGoals.map((g: any) => (
                                <div key={g.id} className="flex justify-between items-center bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                                  <div className="flex items-center gap-2">
                                    {g.profiles?.avatar_url ? (
                                      <img src={(g.profiles as any).avatar_url} className="w-6 h-6 rounded-full" alt={(g.profiles as any)?.full_name || 'Scorer'} />
                                    ) : (
                                      <div className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-[10px] ${g.guest_scorer_name ? 'bg-amber-100 text-amber-700' : 'bg-neutral-200 text-neutral-600'}`}>
                                        {(g.profiles?.full_name || g.scorer?.full_name || g.guest_scorer_name || 'G').charAt(0)}
                                      </div>
                                    )}
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-neutral-800 leading-none">
                                        {g.profiles?.full_name || g.scorer?.full_name || g.guest_scorer_name || 'Guest Player'} {g.is_own_goal && <span className="text-red-500 text-[9px] ml-1">(OG)</span>}
                                      </span>
                                      {(g.assist || g.guest_assist_name) && <span className="text-[9px] text-neutral-500 mt-0.5">Assist: {g.assist?.full_name || g.guest_assist_name}</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {g.minute && <span className="text-[10px] font-bold text-neutral-400">{g.minute}&apos;</span>}
                                    <button className="text-neutral-400 hover:text-red-500 p-1" onClick={() => handleDeleteGoal(g.id, match.id)}>
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {matchGoals.length === 0 && (
                                <p className="text-[10px] text-neutral-400 text-center py-2">No goals added yet.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MATCHDAY REPORT SECTION */}
      {teams.length > 0 && (
        <div data-tour="match-report" className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-neutral-500" />
              Matchday Report
            </h3>
          </div>
          <div className="p-4">
            <div className="flex bg-neutral-100 p-1 rounded-xl mb-4">
              <button 
                type="button"
                onClick={() => setActiveReportTab('points')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeReportTab === 'points' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                📊 Points Table
              </button>
              <button 
                type="button"
                onClick={() => setActiveReportTab('players')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeReportTab === 'players' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                ⚽ Top Players
              </button>
            </div>

            {activeReportTab === 'points' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-400 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-1 text-center w-8">#</th>
                      <th className="py-2.5 px-2">Team</th>
                      <th className="py-2.5 px-2 text-center w-8">P</th>
                      <th className="py-2.5 px-2 text-center w-8">W</th>
                      <th className="py-2.5 px-2 text-center w-8">D</th>
                      <th className="py-2.5 px-2 text-center w-8">L</th>
                      <th className="py-2.5 px-2 text-center w-8">GD</th>
                      <th className="py-2.5 px-2 text-center w-8 font-black text-neutral-900">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {sortedPointsTable.map((team, idx) => (
                      <tr key={team.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="py-3 px-1 text-center font-bold text-neutral-500">{idx + 1}</td>
                        <td className="py-3 px-2 font-bold text-neutral-800">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-neutral-200" style={{ backgroundColor: team.jerseyColor }} />
                            <span className="truncate">{team.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center text-neutral-600">{team.played}</td>
                        <td className="py-3 px-2 text-center text-neutral-600">{team.won}</td>
                        <td className="py-3 px-2 text-center text-neutral-600">{team.drawn}</td>
                        <td className="py-3 px-2 text-center text-neutral-600">{team.lost}</td>
                        <td className="py-3 px-2 text-center text-neutral-600 font-medium">
                          {team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                        </td>
                        <td className="py-3 px-2 text-center font-black text-neutral-900">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {sortedTopPlayers.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-100 text-neutral-400 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-2">Player</th>
                        <th className="py-2.5 px-2">Team</th>
                        <th className="py-2.5 px-2 text-center w-12">⚽ G</th>
                        <th className="py-2.5 px-2 text-center w-12">👟 A</th>
                        <th className="py-2.5 px-2 text-center w-12">🛡️ CS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {sortedTopPlayers.map((player) => (
                        <tr key={player.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="py-3 px-2 font-bold text-neutral-800">
                            <div className="flex flex-col">
                              <span className="flex items-center gap-1">
                                {player.name}
                                {player.isGuest && (
                                  <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1 py-0.2 rounded uppercase tracking-wider">
                                    Guest
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-neutral-500 truncate max-w-[100px]">
                            {getTeamName(player.teamId)}
                          </td>
                          <td className="py-3 px-2 text-center font-black text-neutral-900">{player.goals}</td>
                          <td className="py-3 px-2 text-center font-bold text-neutral-600">{player.assists}</td>
                          <td className="py-3 px-2 text-center font-bold text-neutral-600">{player.cleanSheets}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-6 text-neutral-400 text-xs italic">
                    No goals, assists or clean sheets recorded yet.
                  </div>
                )}
              </div>
            )}

            <MatchdayShareCard
              groupName={(booking.groups as any).name}
              matchDate={format(parseISO(booking.match_date), 'MMM d, yyyy')}
              fieldName={booking.field_name}
              champion={championName}
              runnersUp={runnersUpName}
              topScorer={topScorerText}
              winningColor={championColor}
              championStats={championStats}
              runnersUpStats={runnersUpStats}
            />
          </div>
        </div>
      )}

      {/* 6. FIELD RATING (post-match) */}
      {(displayStatus === 'history' || displayStatus === 'ongoing') && !hasRated && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-100 bg-amber-50/50">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Rate the Field
            </h3>
            <p className="text-xs text-neutral-500 mt-1">How was <strong>{booking.field_name}</strong>? Your rating helps others!</p>
          </div>
          <div className="p-5">
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setRatingHover(star)}
                  onMouseLeave={() => setRatingHover(0)}
                  onClick={() => setFieldRating(star)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (ratingHover || fieldRating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-neutral-200'
                    }`}
                  />
                </button>
              ))}
            </div>
            {fieldRating > 0 && (
              <p className="text-center text-sm font-bold text-amber-700 mb-4">
                {fieldRating === 1 && '😞 Poor'}
                {fieldRating === 2 && '😐 Below Average'}
                {fieldRating === 3 && '🙂 Average'}
                {fieldRating === 4 && '😊 Good'}
                {fieldRating === 5 && '🤩 Excellent!'}
              </p>
            )}
            <textarea
              placeholder="Any comments about the field? (optional)"
              className="w-full px-4 py-3 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm resize-none min-h-[80px] mb-4"
              value={fieldReview}
              onChange={e => setFieldReview(e.target.value)}
              maxLength={500}
            />
            <Button
              disabled={fieldRating === 0 || isRatingLoading}
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold"
              onClick={async () => {
                if (fieldRating === 0) return
                setIsRatingLoading(true)
                try {
                  // First ensure field exists
                  const fieldRes = await fetch('/api/fields', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: booking.field_name,
                      google_maps_url: booking.google_maps_url
                    })
                  })
                  const fieldData = await fieldRes.json()
                  const fieldId = fieldData.id

                  if (fieldId) {
                    await fetch(`/api/fields/${fieldId}/rate`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        booking_id: booking.id,
                        rating: fieldRating,
                        review: fieldReview.trim() || null
                      })
                    })
                    setHasRated(true)
                  }
                } catch (e) {
                  console.error(e)
                } finally {
                  setIsRatingLoading(false)
                }
              }}
            >
              {isRatingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Rating'}
            </Button>
          </div>
        </div>
      )}
      {hasRated && (
        <div className="bg-green-50 rounded-2xl p-5 border border-green-100 text-center">
          <Star className="w-8 h-8 text-green-600 fill-green-600 mx-auto mb-2" />
          <p className="font-bold text-green-800">Thanks for rating!</p>
          <p className="text-xs text-green-600 mt-1">Your feedback helps the community.</p>
        </div>
      )}

      {/* ADD GOAL MODAL */}
      {isAddGoalOpen && expandedMatchId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2"><Goal className="w-5 h-5"/> Add Goal</h3>
              <button onClick={() => setIsAddGoalOpen(false)}><X className="w-5 h-5 text-neutral-500" /></button>
            </div>
            
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Team</label>
                <CustomSelect
                  value={goalForm.teamId}
                  onChange={val => setGoalForm({...goalForm, teamId: val, scorerId: '', assistId: ''})}
                  placeholder="Select Team..."
                  buttonClassName="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  options={[
                    { value: '', label: 'Select Team...' },
                    ...(matchSchedule.find((m: { id: string }) => m.id === expandedMatchId) ? [
                      { 
                        value: matchSchedule.find((m: { id: string }) => m.id === expandedMatchId)?.home_team_id || '', 
                        label: getTeamName(matchSchedule.find((m: { id: string }) => m.id === expandedMatchId)?.home_team_id) || ''
                      },
                      { 
                        value: matchSchedule.find((m: { id: string }) => m.id === expandedMatchId)?.away_team_id || '', 
                        label: getTeamName(matchSchedule.find((m: { id: string }) => m.id === expandedMatchId)?.away_team_id) || ''
                      }
                    ] : [])
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Scorer</label>
                <CustomSelect
                  value={goalForm.scorerId}
                  onChange={val => setGoalForm({...goalForm, scorerId: val})}
                  placeholder="Select Player..."
                  buttonClassName="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  disabled={!goalForm.teamId}
                  options={[
                    { value: '', label: 'Select Player...' },
                    ...(() => {
                      const selectedTeam = teams.find((t: any) => t.id === goalForm.teamId)
                      if (!selectedTeam) return []
                      const players: {value: string, label: string}[] = []
                      selectedTeam.team_players?.forEach((tp: any) => {
                        players.push({ value: tp.player_id, label: tp.profiles?.full_name || 'Player' })
                      })
                      selectedTeam.guest_members?.forEach((gId: string) => {
                        const rsvp = rsvps.find((r: any) => r.id === gId)
                        if (rsvp) players.push({ value: `guest_${rsvp.id}`, label: rsvp.guest_name + ' (Guest)' })
                      })
                      return players
                    })()
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Assist (Optional)</label>
                <CustomSelect
                  value={goalForm.assistId}
                  onChange={val => setGoalForm({...goalForm, assistId: val})}
                  placeholder="None"
                  buttonClassName="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  disabled={!goalForm.teamId}
                  options={[
                    { value: '', label: 'None' },
                    ...(() => {
                      const selectedTeam = teams.find((t: any) => t.id === goalForm.teamId)
                      if (!selectedTeam) return []
                      const players: {value: string, label: string}[] = []
                      selectedTeam.team_players?.forEach((tp: any) => {
                        if (tp.player_id !== goalForm.scorerId) {
                          players.push({ value: tp.player_id, label: tp.profiles?.full_name || 'Player' })
                        }
                      })
                      selectedTeam.guest_members?.forEach((gId: string) => {
                        const rsvp = rsvps.find((r: any) => r.id === gId)
                        const gidStr = `guest_${rsvp?.id}`
                        if (rsvp && gidStr !== goalForm.scorerId) {
                          players.push({ value: gidStr, label: rsvp.guest_name + ' (Guest)' })
                        }
                      })
                      return players
                    })()
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Minute (Optional)</label>
                  <input 
                    type="number" min="1" max="120"
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                    value={goalForm.minute}
                    onChange={e => setGoalForm({...goalForm, minute: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                      checked={goalForm.isOwnGoal}
                      onChange={e => setGoalForm({...goalForm, isOwnGoal: e.target.checked})}
                    />
                    <span className="text-sm font-bold text-neutral-700">Own Goal</span>
                  </label>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl mt-2" disabled={isGoalLoading}>
                {isGoalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add Goal'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Out Modal */}
      {isConfirmOutOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-xl text-neutral-900 mb-2">Are you sure?</h3>
            <p className="text-neutral-600 mb-6 text-sm leading-relaxed">Your spot will be given to the next person on the waitlist. You will lose your guaranteed spot.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsConfirmOutOpen(false)}>Cancel</Button>
              <Button className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white" onClick={() => executeRsvp('out')}>
                Yes, I&apos;m Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Match Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8" />
              </div>
            </div>
            <h3 className="font-bold text-xl text-center text-neutral-900 mb-2">Cancel Match?</h3>
            <p className="text-neutral-600 text-center mb-6 text-sm leading-relaxed">
              This will notify all players that the match has been cancelled. This action cannot be undone.
            </p>
            <div className="mb-6 space-y-2">
              <label className="text-sm font-bold text-neutral-700">Cancellation Reason</label>
              <CustomSelect
                value={cancelReason}
                onChange={val => setCancelReason(val)}
                placeholder="Select a reason..."
                buttonClassName="w-full px-3 py-3 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                options={[
                  { value: 'Field flooded', label: 'Field flooded' },
                  { value: 'Not enough players', label: 'Not enough players' },
                  { value: 'Transportation issue', label: 'Transportation issue' },
                  { value: 'Other', label: 'Other' }
                ]}
              />
              {cancelReason === 'Other' && (
                <textarea 
                  className="w-full mt-2 px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm min-h-[80px]"
                  placeholder="More info (optional)..."
                  value={cancelReasonOther}
                  onChange={e => setCancelReasonOther(e.target.value)}
                />
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsCancelModalOpen(false)}>Back</Button>
              <Button 
                className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white" 
                onClick={handleCancelMatch}
                disabled={isCancelling}
              >
                {isCancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Add Member Modal */}
      {isAddMemberOpen && (() => {
        const filteredMembers = groupMembers
          .filter((m: any) => !inPlayers.some((ip: any) => ip.player_id === m.player_id))
          .filter((m: any) => {
            const name = ((m.profiles as any)?.full_name || '').toLowerCase()
            const search = memberSearchQuery.toLowerCase()
            return name.includes(search)
          })

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/60 p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Users className="w-5 h-5"/> Add Players</h3>
                <button onClick={() => { setIsAddMemberOpen(false); setSelectedMembersToAdd([]); setMemberSearchQuery('') }}><X className="w-5 h-5 text-neutral-500" /></button>
              </div>

              <input 
                type="text" 
                placeholder="Search group members..." 
                className="w-full px-3 py-2 border rounded-xl text-sm mb-3 focus:ring-2 focus:ring-green-500 outline-none" 
                value={memberSearchQuery}
                onChange={e => setMemberSearchQuery(e.target.value)}
              />
              
              <form onSubmit={handleAdminAddMember} className="space-y-4">
                <div className="space-y-1.5">
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {filteredMembers.map((m: any) => {
                      const isSelected = selectedMembersToAdd.includes(m.player_id)
                      const handleToggle = () => {
                        if (isSelected) {
                          setSelectedMembersToAdd(prev => prev.filter(id => id !== m.player_id))
                        } else {
                          setSelectedMembersToAdd(prev => [...prev, m.player_id])
                        }
                      }
                      return (
                        <div 
                          key={m.player_id}
                          onClick={handleToggle}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'bg-green-50 border-green-200 text-green-800' : 'bg-neutral-50 border-neutral-100 hover:bg-neutral-100/50 text-neutral-800'}`}
                        >
                          <span className="font-semibold text-sm">{(m.profiles as any).full_name || 'Player'}</span>
                          {isSelected && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                        </div>
                      )
                    })}
                    {filteredMembers.length === 0 && (
                      <p className="text-center text-xs text-neutral-400 italic py-4">No members found.</p>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 bg-neutral-900 hover:bg-black text-white rounded-xl mt-2 flex items-center justify-center gap-1.5" disabled={isAddingMember || selectedMembersToAdd.length === 0}>
                  {isAddingMember ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Add {selectedMembersToAdd.length > 0 ? `${selectedMembersToAdd.length} ` : ''}to Confirmed List</>
                  )}
                </Button>
              </form>
            </div>
          </div>
        )
      })()}

      {/* Add Guest Modal */}
      {isAddGuestOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2"><Users className="w-5 h-5 text-amber-500"/> Add Guest</h3>
              <button onClick={() => setIsAddGuestOpen(false)}><X className="w-5 h-5 text-neutral-500" /></button>
            </div>
            <form onSubmit={handleAddGuest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Guest Name</label>
                <input
                  required
                  type="text"
                  placeholder="Enter guest's name"
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  value={guestForm.name}
                  onChange={e => setGuestForm({ ...guestForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Position</label>
                <CustomSelect
                  value={guestForm.position}
                  onChange={val => setGuestForm({ ...guestForm, position: val })}
                  placeholder="Select position..."
                  buttonClassName="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  options={[
                    { value: 'GK', label: 'GK' },
                    { value: 'DEF', label: 'DEF' },
                    { value: 'MID', label: 'MID' },
                    { value: 'ATT', label: 'ATT' },
                    { value: 'Field Player', label: 'Field Player' }
                  ]}
                />
              </div>
              <Button type="submit" className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-xl mt-2" disabled={isAddingGuest}>
                {isAddingGuest ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add Guest'}
              </Button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
