/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useRef, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { MapPin, Clock, Calendar, CheckCircle, XCircle, Users, Shield, Map as MapIcon, Plus, ChevronRight, X, Loader2, Trophy, Goal, Star, MinusCircle, Share2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rsvpAction } from '../../actions'
import { saveTeamsAction, generateScheduleAction, updateMatchScoreAction, adminAddRsvpAction, addGuestAction, updateMaxPlayersAction, updateTeamAction, deleteTeamAction, assignPlayerToTeamAction, rescheduleMatchesAction, adminRemoveRsvpAction, reorderMatchesAction, addManualMatchAction, updateRsvpPositionAction } from './actions'
import { calculateFplPoints } from '@/lib/fpl'
import { getGroupScoringSettings, calculateTournamentPlayerPoints, calculateMatchPlayerPitchTime, PlayerPointsBreakdown } from '@/lib/tournamentScoring'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/modals/ConfirmModal'
import MatchdayShareCard from '@/components/cards/MatchdayShareCard'
import TopPlayersShareCard from '@/components/cards/TopPlayersShareCard'
import { KnockoutBracketCard } from '@/components/cards/KnockoutBracketCard'
import { CustomSelect } from '@/components/ui/select'
import { TourGuide } from '@/components/ui/TourGuide'
import { toPng } from 'html-to-image'

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
  matchEvents = [],
  currentUser,
  groupId,
  userRole,
  groupMembers = [],
  initialHasRated = false,
  initialTab = 'players'
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
      position: p.selected_position || p.profiles?.preferred_position || p.guest_position || 'ATT',
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
    const posA = a.selected_position || a.profiles?.preferred_position || a.guest_position || 'ATT'
    const posB = b.selected_position || b.profiles?.preferred_position || b.guest_position || 'ATT'
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
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { } })

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
  const [sharingTeam, setSharingTeam] = useState<any>(null)
  const [isGeneratingTeamImage, setIsGeneratingTeamImage] = useState(false)
  const teamCardRef = useRef<HTMLDivElement>(null)

  // Schedule Share State
  const [sharingSchedule, setSharingSchedule] = useState(false)
  const [isGeneratingScheduleImage, setIsGeneratingScheduleImage] = useState(false)
  const scheduleCardRef = useRef<HTMLDivElement>(null)

  const [orderedSchedule, setOrderedSchedule] = useState<any[]>(matchSchedule)
  const [isReordering, setIsReordering] = useState(false)

  // Keep local state in sync with props
  useEffect(() => {
    setOrderedSchedule(matchSchedule)
  }, [matchSchedule])

  const handleMoveMatch = async (index: number, direction: 'up' | 'down') => {
    if (isReordering) return
    const newSchedule = [...orderedSchedule]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    // Swap items
    const temp = newSchedule[index]
    newSchedule[index] = newSchedule[targetIndex]
    newSchedule[targetIndex] = temp

    setOrderedSchedule(newSchedule)
    setIsReordering(true)
    try {
      const matchIds = newSchedule.map(m => m.id)
      await reorderMatchesAction(booking.id, groupId, matchIds)
    } catch (e) {
      console.error('Failed to reorder matches:', e)
      // Revert if error
      setOrderedSchedule(orderedSchedule)
    } finally {
      setIsReordering(false)
    }
  }

  const POSITION_ORDER: Record<string, number> = {
    'GK': 1,
    'DEF': 2,
    'MID': 3,
    'ATT': 4,
    'Field Player': 5
  }

  const getTeamPlayersList = (team: any) => {
    const list: any[] = []
    const addedIds = new Set<string>()
    const addedNames = new Set<string>()

    team.team_players?.forEach((tp: any) => {
      if (!tp.player_id || addedIds.has(tp.player_id)) return
      addedIds.add(tp.player_id)
      if (tp.profiles?.full_name) addedNames.add(tp.profiles.full_name.toLowerCase())
      const isCaptain = team.captain_id === tp.player_id
      const rsvp = rsvps.find((r: any) => r.player_id === tp.player_id)
      const pos = rsvp?.selected_position || rsvp?.profiles?.preferred_position || 'Field Player'
      list.push({
        id: tp.player_id,
        name: tp.profiles?.full_name || 'Player',
        position: pos,
        isCaptain,
        isGuest: false,
        avatarUrl: tp.profiles?.avatar_url || rsvp?.profiles?.avatar_url || null
      })
    })

    const rawGuestMembers: string[] = team.guest_members || []
    rawGuestMembers.forEach((gId: string) => {
      const cleanRsvpId = gId.replace(' (C)', '').replace('guest_', '').trim()
      const rsvp = rsvps.find((r: any) => r.id === cleanRsvpId || r.guest_name === cleanRsvpId)
      const name = rsvp?.guest_name || (cleanRsvpId && !cleanRsvpId.includes('-') ? cleanRsvpId : null)

      if (name && !addedNames.has(name.toLowerCase())) {
        addedNames.add(name.toLowerCase())
        const guestKey = `guest_${rsvp?.id || cleanRsvpId}`
        addedIds.add(guestKey)

        const isCaptain = team.captain_id === `guest_${rsvp?.id || cleanRsvpId}` || team.captain_id === rsvp?.id || gId.includes('(C)')
        const pos = rsvp?.guest_position || 'Field Player'
        list.push({
          id: guestKey,
          name,
          position: pos,
          isCaptain,
          isGuest: true,
          avatarUrl: null
        })
      }
    })

    return list.sort((a, b) => {
      const weightA = POSITION_ORDER[a.position] || 99
      const weightB = POSITION_ORDER[b.position] || 99
      if (weightA !== weightB) return weightA - weightB
      if (a.isCaptain !== b.isCaptain) return a.isCaptain ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  const getTeamGradient = (hexColor: string) => {
    let color = hexColor || '#16a34a'
    if (!color.startsWith('#')) color = '#' + color

    let r = parseInt(color.slice(1, 3), 16)
    let g = parseInt(color.slice(3, 5), 16)
    let b = parseInt(color.slice(5, 7), 16)

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      r = 22; g = 163; b = 74;
      color = '#16a34a'
    }

    const contrastColor = getContrastColor(color)
    const isLight = contrastColor === '#0f172a'

    let startColor = ''
    let endColor = color

    if (isLight) {
      // Light background: blend team color with white to make it soft
      const rLight = Math.round(r * 0.3 + 255 * 0.7)
      const gLight = Math.round(g * 0.3 + 255 * 0.7)
      const bLight = Math.round(b * 0.3 + 255 * 0.7)
      startColor = '#' + [rLight, gLight, bLight].map(x => x.toString(16).padStart(2, '0')).join('')

      if (color.toLowerCase() === '#ffffff') {
        startColor = '#f8fafc'
        endColor = '#e2e8f0'
      }
    } else {
      // Dark background: blend team color with black for a rich dark shade
      const rDark = Math.round(r * 0.15)
      const gDark = Math.round(g * 0.15)
      const bDark = Math.round(b * 0.15)
      startColor = '#' + [rDark, gDark, bDark].map(x => x.toString(16).padStart(2, '0')).join('')

      if (color.toLowerCase() === '#000000') {
        startColor = '#090d16'
        endColor = '#1e293b'
      }
    }

    return {
      gradient: `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`,
      glow: `rgba(${r}, ${g}, ${b}, 0.35)`,
      accent: color,
      text: contrastColor,
      isLight
    }
  }

  const getContrastColor = (hexColor: string) => {
    let color = hexColor || '#16a34a'
    if (!color.startsWith('#')) color = '#' + color
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff'
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
    return (yiq >= 128) ? '#0f172a' : '#ffffff'
  }

  const handleOpenShareTeam = (team: any) => {
    setSharingTeam(team)
  }

  const handleShareTeam = async () => {
    if (!teamCardRef.current || !sharingTeam) return
    setIsGeneratingTeamImage(true)
    try {
      const dataUrl = await toPng(teamCardRef.current, {
        quality: 1,
        pixelRatio: 3,
        cacheBust: true,
      })

      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], `khelahobe-team-${sharingTeam.name.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${sharingTeam.name} Squad — KhelaHobe`,
          text: `Check out our squad ${sharingTeam.name} on KhelaHobe! ⚽`,
          files: [file],
        })
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `khelahobe-team-${sharingTeam.name.replace(/\s+/g, '-').toLowerCase()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (e) {
      console.error('Share team failed:', e)
    } finally {
      setIsGeneratingTeamImage(false)
    }
  }

  const handleDownloadTeam = async () => {
    if (!teamCardRef.current || !sharingTeam) return
    setIsGeneratingTeamImage(true)
    try {
      const dataUrl = await toPng(teamCardRef.current, {
        quality: 1,
        pixelRatio: 3,
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `khelahobe-team-${sharingTeam.name.replace(/\s+/g, '-').toLowerCase()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      console.error('Download team failed:', e)
    } finally {
      setIsGeneratingTeamImage(false)
    }
  }

  const handleShareSchedule = async () => {
    if (!scheduleCardRef.current) return
    setIsGeneratingScheduleImage(true)
    try {
      const dataUrl = await toPng(scheduleCardRef.current, {
        quality: 1,
        pixelRatio: 3,
        cacheBust: true,
      })

      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], `khelahobe-schedule-${booking.id}.png`, { type: 'image/png' })

      const groupName = (booking.groups as any).name || 'Match'
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${groupName} Schedule — KhelaHobe`,
          text: `Check out the schedule & scores on KhelaHobe! ⚽`,
          files: [file],
        })
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `khelahobe-schedule-${booking.id}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (e) {
      console.error('Share schedule failed:', e)
    } finally {
      setIsGeneratingScheduleImage(false)
    }
  }

  const handleDownloadSchedule = async () => {
    if (!scheduleCardRef.current) return
    setIsGeneratingScheduleImage(true)
    try {
      const dataUrl = await toPng(scheduleCardRef.current, {
        quality: 1,
        pixelRatio: 3,
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `khelahobe-schedule-${booking.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      console.error('Download schedule failed:', e)
    } finally {
      setIsGeneratingScheduleImage(false)
    }
  }

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
  const [selectedMemberPositions, setSelectedMemberPositions] = useState<Record<string, string>>({})
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null)
  const [updatingPosRsvpId, setUpdatingPosRsvpId] = useState<string | null>(null)

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

  const handleUpdateRsvpPosition = async (rsvpId: string, newPos: string) => {
    setUpdatingPosRsvpId(rsvpId)
    try {
      await updateRsvpPositionAction(rsvpId, booking.id, groupId, newPos)
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setUpdatingPosRsvpId(null)
    }
  }

  const handleAdminAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedMembersToAdd.length === 0) return
    setIsAddingMember(true)
    try {
      await adminAddRsvpAction(booking.id, groupId, selectedMembersToAdd, booking.max_players, selectedMemberPositions)
      setIsAddMemberOpen(false)
      setSelectedMembersToAdd([])
      setSelectedMemberPositions({})
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

  // Score Entry & Fantasy State
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [scoreForms, setScoreForms] = useState<Record<string, { homeScore: number, awayScore: number }>>({})
  const [dnpForms, setDnpForms] = useState<Record<string, { playerIds: string[], guestNames: string[] }>>({})
  const [motmForms, setMotmForms] = useState<Record<string, { playerId: string, guestName: string }>>({})

  // Manual Match State
  const [isAddManualMatchOpen, setIsAddManualMatchOpen] = useState(false)
  const [manualHomeTeamId, setManualHomeTeamId] = useState('')
  const [manualAwayTeamId, setManualAwayTeamId] = useState('')
  const [manualStageName, setManualStageName] = useState('Match')
  const [manualLeg, setManualLeg] = useState(1)
  const [isManualMatchLoading, setIsManualMatchLoading] = useState(false)

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
  const [hasRated, setHasRated] = useState(initialHasRated || false)
  const [ratingHover, setRatingHover] = useState(0)

  // Matchday Report Tab State
  const [activeReportTab, setActiveReportTab] = useState<'points' | 'players'>('points')
  const [selectedPlayerForBreakdown, setSelectedPlayerForBreakdown] = useState<any | null>(null)

  // Main Matchday Page Tabs
  const validTab = (['players', 'teams', 'fixture', 'report'].includes(initialTab) ? initialTab : 'players') as 'players' | 'teams' | 'fixture' | 'report'
  const [matchdayTab, setMatchdayTab] = useState<'players' | 'teams' | 'fixture' | 'report'>(validTab)

  useEffect(() => {
    if (initialTab && ['players', 'teams', 'fixture', 'report'].includes(initialTab)) {
      setMatchdayTab(initialTab as any)
    }
  }, [initialTab])

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

  // Helper to identify knockout / playoff stage matches
  const isKnockoutMatch = (match: any) => {
    if (!match.stage_name) return false
    const stage = match.stage_name.toLowerCase()
    return (
      stage.includes('final') ||
      stage.includes('semi') ||
      stage.includes('quarter') ||
      stage.includes('qualifier') ||
      stage.includes('eliminator') ||
      stage.includes('playoff') ||
      stage.includes('3rd') ||
      stage.includes('knockout')
    )
  }

  const isKnockoutSchedule = matchSchedule.length > 0 && matchSchedule.every((m: any) => isKnockoutMatch(m))

  // Calculate stats from completed LEAGUE matches (excluding knockout/playoff matches)
  matchSchedule.forEach((match: any) => {
    if (match.status === 'completed' && !isKnockoutMatch(match)) {
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

  // 2. Top Players Table (FPL Points, Goals, Assists, Clean Sheets & MOTM)
  interface PlayerStats {
    id: string
    name: string
    position: string
    isGuest: boolean
    teamId: string
    avatarUrl?: string | null
    goals: number
    ownGoals: number
    assists: number
    cleanSheets: number
    appearances: number
    motmCount: number
    yellowCards: number
    redCards: number
    penaltySaves: number
    goalsConcededOnPitch?: number
    breakdown?: PlayerPointsBreakdown
    fplPoints: number
    teamPoints: number
  }

  const customScoringSettings = getGroupScoringSettings((booking.groups as any)?.custom_scoring_settings)
  const playerStatsMap: Record<string, PlayerStats> = {}

  // Initialize with all players that participated (registered + guests)
  allPlayersForTeam.forEach(p => {
    const rsvpObj = rsvps.find((r: any) => r.id === p.rsvpId || r.player_id === p.id)
    const teamId = rsvpObj ? getPlayerTeamId(rsvpObj) : ''
    const teamStats = sortedPointsTable.find(t => t.id === teamId)
    const pos = p.position || 'ATT'

    playerStatsMap[p.id] = {
      id: p.id,
      name: p.name,
      position: pos,
      isGuest: p.isGuest,
      teamId: teamId,
      avatarUrl: rsvpObj?.profiles?.avatar_url || null,
      goals: 0,
      ownGoals: 0,
      assists: 0,
      cleanSheets: 0,
      appearances: 0,
      motmCount: 0,
      yellowCards: 0,
      redCards: 0,
      penaltySaves: 0,
      goalsConcededOnPitch: 0,
      fplPoints: 0,
      teamPoints: teamStats ? teamStats.points : 0
    }
  })

  // Calculate goals, own goals, and assists
  goalEvents.forEach((g: any) => {
    if (!g.is_own_goal) {
      let scorerKey = null
      if (g.scorer_id) {
        scorerKey = g.scorer_id
      } else if (g.guest_scorer_name) {
        const found = allPlayersForTeam.find(p => p.isGuest && (p.name.toLowerCase() === g.guest_scorer_name.toLowerCase() || p.id.includes(g.guest_scorer_name)))
        if (found) scorerKey = found.id
      }
      if (scorerKey && playerStatsMap[scorerKey]) {
        playerStatsMap[scorerKey].goals += 1
      }
    } else {
      let ownScorerKey = null
      if (g.scorer_id) {
        ownScorerKey = g.scorer_id
      } else if (g.guest_scorer_name) {
        const found = allPlayersForTeam.find(p => p.isGuest && (p.name.toLowerCase() === g.guest_scorer_name.toLowerCase() || p.id.includes(g.guest_scorer_name)))
        if (found) ownScorerKey = found.id
      }
      if (ownScorerKey && playerStatsMap[ownScorerKey]) {
        playerStatsMap[ownScorerKey].ownGoals += 1
      }
    }

    let assistKey = null
    if (g.assist_id) {
      assistKey = g.assist_id
    } else if (g.guest_assist_name) {
      const found = allPlayersForTeam.find(p => p.isGuest && (p.name.toLowerCase() === g.guest_assist_name.toLowerCase() || p.id.includes(g.guest_assist_name)))
      if (found) assistKey = found.id
    }
    if (assistKey && playerStatsMap[assistKey]) {
      playerStatsMap[assistKey].assists += 1
    }
  })

  // Calculate cards and penalty saves from matchEvents
  ;(matchEvents || []).forEach((e: any) => {
    let pKey = e.player_id
    if (!pKey && e.details_json?.guest_player_id) {
      const guestIdStr = String(e.details_json.guest_player_id)
      const found = allPlayersForTeam.find(p => p.isGuest && (p.id === guestIdStr || p.id.includes(guestIdStr)))
      if (found) pKey = found.id
    }

    if (pKey && playerStatsMap[pKey]) {
      if (e.event_type === 'card') {
        const cardType = e.details_json?.card_type
        if (cardType === 'yellow') {
          playerStatsMap[pKey].yellowCards += 1
        } else if (cardType === 'red') {
          playerStatsMap[pKey].redCards += 1
        }
      } else if (e.event_type === 'penalty_save') {
        playerStatsMap[pKey].penaltySaves += 1
      }
    }
  })

  // Calculate appearances, clean sheets, goals conceded, and MOTM/MVP awards
  matchSchedule.forEach((match: any) => {
    if (match.status === 'completed') {
      const homeScore = match.home_score || 0
      const awayScore = match.away_score || 0
      const dnpPlayerIds: string[] = match.dnp_player_ids || []
      const dnpGuestNames: string[] = match.dnp_guest_names || []

      // Appearances & Clean Sheets for participants
      Object.values(playerStatsMap).forEach(p => {
        const isHome = p.teamId === match.home_team_id
        const isAway = p.teamId === match.away_team_id

        if (isHome || isAway) {
          const isDnp = p.isGuest ? dnpGuestNames.includes(p.name) : dnpPlayerIds.includes(p.id)
          if (!isDnp) {
            p.appearances += 1
          }

          if (!isDnp && isHome && awayScore === 0) {
            p.cleanSheets += 1
          }
          if (!isDnp && isAway && homeScore === 0) {
            p.cleanSheets += 1
          }
        }

        // MOTM / MVP bonus check
        const isMotmWinner = (match.motm_player_id && match.motm_player_id === p.id) || (match.mvp_player_id && match.mvp_player_id === p.id)
        if (isMotmWinner) {
          p.motmCount += 1
        } else if (match.motm_guest_name && p.isGuest && match.motm_guest_name === p.name) {
          p.motmCount += 1
        }
      })

      // Calculate goals conceded on pitch for this match
      const mEvents = (matchEvents || []).filter((e: any) => e.match_schedule_id === match.id)
      const homePids = Object.values(playerStatsMap).filter(p => p.teamId === match.home_team_id).map(p => p.id)
      const awayPids = Object.values(playerStatsMap).filter(p => p.teamId === match.away_team_id).map(p => p.id)
      const startingPids = match.starting_player_ids || [...homePids, ...awayPids]
      const duration = match.duration_minutes || 30

      const pitchResult = calculateMatchPlayerPitchTime(mEvents, duration, homePids, awayPids, startingPids)
      Object.entries(pitchResult.goalsConcededOnPitch).forEach(([pid, gc]) => {
        if (playerStatsMap[pid]) {
          playerStatsMap[pid].goalsConcededOnPitch = (playerStatsMap[pid].goalsConcededOnPitch || 0) + gc
        }
      })
    }
  })

  // Calculate final Group Custom Points & Breakdown for each player
  Object.values(playerStatsMap).forEach(p => {
    const { totalPoints, breakdown } = calculateTournamentPlayerPoints(
      p.position,
      {
        goals: p.goals,
        assists: p.assists,
        cleanSheets: p.cleanSheets,
        penaltySaves: p.penaltySaves,
        goalsConcededOnPitch: p.goalsConcededOnPitch || 0,
        ownGoals: p.ownGoals,
        yellowCards: p.yellowCards,
        redCards: p.redCards,
        motmCount: p.motmCount,
        appearances: p.appearances,
      },
      customScoringSettings
    )
    p.fplPoints = totalPoints
    p.breakdown = breakdown
  })

  const sortedTopPlayers = Object.values(playerStatsMap)
    .filter(p => p.fplPoints !== 0 || p.appearances > 0 || p.goals > 0 || p.assists > 0 || p.ownGoals > 0)
    .sort((a, b) => {
      if (b.fplPoints !== a.fplPoints) return b.fplPoints - a.fplPoints
      if (b.goals !== a.goals) return b.goals - a.goals
      if (b.assists !== a.assists) return b.assists - a.assists
      if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets
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

  const myProfile = groupMembers.find((m: any) => m.player_id === currentUser.id)?.profiles
  const [isPositionModalOpen, setIsPositionModalOpen] = useState(false)
  const [selectedPosInput, setSelectedPosInput] = useState<string>('')

  const handleRsvp = async (status: string) => {
    if (status === 'out' && myRsvp === 'in' && waitlistPlayers.length > 0) {
      setIsConfirmOutOpen(true)
      return
    }
    if (status === 'in') {
      const prefPos = myProfile?.preferred_position || 'Field Player'
      const secPos = myProfile?.secondary_position
      const isFieldPlayer = prefPos === 'Field Player' || !prefPos
      const hasSecondary = secPos && secPos !== prefPos

      if (isFieldPlayer || hasSecondary) {
        const defaultPos = myRsvpObj?.selected_position || (hasSecondary ? prefPos : 'MID')
        setSelectedPosInput(defaultPos)
        setIsPositionModalOpen(true)
        return
      }
    }
    await executeRsvp(status, myProfile?.preferred_position || 'MID')
  }

  const executeRsvp = async (status: string, positionOverride?: string) => {
    setIsRsvpLoading(true)
    setIsConfirmOutOpen(false)
    setIsPositionModalOpen(false)
    try {
      const posToSave = positionOverride || selectedPosInput || myProfile?.preferred_position || 'MID'
      await rsvpAction(booking.id, groupId, status, booking.max_players, posToSave)
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
      if (!dnpForms[match.id]) {
        setDnpForms({
          ...dnpForms,
          [match.id]: {
            playerIds: match.dnp_player_ids || [],
            guestNames: match.dnp_guest_names || []
          }
        })
      }
      if (!motmForms[match.id]) {
        setMotmForms({
          ...motmForms,
          [match.id]: {
            playerId: match.motm_player_id || '',
            guestName: match.motm_guest_name || ''
          }
        })
      }
    }
  }

  const handleSaveScore = async (matchId: string) => {
    setIsScoreLoading(true)
    try {
      const form = scoreForms[matchId] || { homeScore: 0, awayScore: 0 }
      const dnp = dnpForms[matchId] || { playerIds: [], guestNames: [] }
      const motm = motmForms[matchId] || { playerId: '', guestName: '' }

      await fetch(`/api/matches/${matchId}/score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          home_score: form.homeScore,
          away_score: form.awayScore,
          status: 'completed',
          dnp_player_ids: dnp.playerIds,
          dnp_guest_names: dnp.guestNames,
          motm_player_id: motm.playerId || null,
          motm_guest_name: motm.guestName || null
        })
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

  const handleAddManualMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualHomeTeamId || !manualAwayTeamId) return
    setIsManualMatchLoading(true)
    try {
      await addManualMatchAction(booking.id, groupId, manualHomeTeamId, manualAwayTeamId, manualLeg, manualStageName)
      setIsAddManualMatchOpen(false)
      setManualHomeTeamId('')
      setManualAwayTeamId('')
      setManualStageName('Match')
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsManualMatchLoading(false)
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
          <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${displayStatus === 'upcoming' ? 'bg-amber-100 text-amber-700' :
              displayStatus === 'ongoing' ? 'bg-blue-100 text-blue-700' :
                'bg-neutral-100 text-neutral-700'
            }`}>
            {displayStatus === 'history' ? 'Match History' : displayStatus}
          </div>
        </div>

        <div className="flex items-center gap-3 text-neutral-700 mb-2">
          <Clock className="w-5 h-5 text-neutral-400" />
          <span className="font-semibold text-lg">{booking.match_time.slice(0, 5)}</span>
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

      {/* MAIN MATCHDAY TABS */}
      <div className="flex bg-neutral-100 p-1.5 rounded-2xl overflow-x-auto gap-1 sticky top-0 z-20">
        {[
          { key: 'players' as const, label: '👥 Players', count: allConfirmedPlayers.length },
          { key: 'teams' as const, label: '🛡️ Teams', count: teams.length },
          { key: 'fixture' as const, label: '📋 Fixture', count: matchSchedule.length },
          { key: 'report' as const, label: '📊 Report' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMatchdayTab(tab.key)}
            className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-1 ${
              matchdayTab === tab.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                matchdayTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB: CONFIRMED PLAYERS */}
      {matchdayTab === 'players' && (
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
            const playerPos = rsvp.selected_position || rsvp.profiles?.preferred_position || rsvp.guest_position || 'Field Player'
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
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getPositionColor(playerPos)}`}>
                        {playerPos}
                      </span>
                      {(userRole === 'admin' || rsvp.player_id === currentUser.id) && (
                        <select
                          value={['GK', 'DEF', 'MID', 'ATT'].includes(playerPos) ? playerPos : 'MID'}
                          disabled={updatingPosRsvpId === rsvp.id}
                          onChange={(e) => handleUpdateRsvpPosition(rsvp.id, e.target.value)}
                          className="text-[10px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded px-1 py-0.5 text-neutral-700 outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
                        >
                          <option value="GK">GK</option>
                          <option value="DEF">DEF</option>
                          <option value="MID">MID</option>
                          <option value="ATT">ATT</option>
                        </select>
                      )}
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
      )}

      {/* TAB: TEAMS */}
      {matchdayTab === 'teams' && displayStatus !== 'cancelled' && (
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
                    <div key={team.id} className="border rounded-xl" style={{ borderColor: team.jersey_color === '#ffffff' || team.jersey_color?.toLowerCase() === '#fff' ? '#d4d4d4' : team.jersey_color }}>
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
                              {(() => {
                                const playersList = getTeamPlayersList(team)
                                const regCount = playersList.filter((p: any) => !p.isGuest).length
                                const guestCount = playersList.filter((p: any) => p.isGuest).length
                                return `${regCount} players${guestCount > 0 ? ` + ${guestCount} guest(s)` : ''}`
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenShareTeam(team)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors"
                            title="Share Team"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          {userRole === 'admin' && (
                            <>
                              <button onClick={() => handleStartEditTeam(team)} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => handleDeleteTeam(team.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {expandedTeamId === team.id && (
                        <div className="border-t px-3 py-2 bg-neutral-50/50 rounded-b-xl space-y-1.5 text-xs text-neutral-700">
                          {team.team_players?.length === 0 && (!team.guest_members || team.guest_members.length === 0) && (
                            <div className="text-neutral-400 italic py-1">No players assigned yet.</div>
                          )}
                          {[...(team.team_players || [])]
                            .sort((a: any, b: any) => {
                              const rA = rsvps.find((r: any) => r.player_id === a.player_id)
                              const rB = rsvps.find((r: any) => r.player_id === b.player_id)
                              const posA = rA?.selected_position || rA?.profiles?.preferred_position || 'ATT'
                              const posB = rB?.selected_position || rB?.profiles?.preferred_position || 'ATT'
                              return (POS_ORDER[posA] || 5) - (POS_ORDER[posB] || 5)
                            })
                            .map((tp: any) => {
                            const isCaptain = team.captain_id === tp.player_id
                            const rsvp = rsvps.find((r: any) => r.player_id === tp.player_id)
                            const pos = rsvp?.selected_position || rsvp?.profiles?.preferred_position || 'Field Player'
                            const avatarUrl = tp.profiles?.avatar_url || rsvp?.profiles?.avatar_url || null
                            const fullName = tp.profiles?.full_name || 'Player'
                            const initials = fullName.charAt(0).toUpperCase()
                            return (
                              <div key={tp.player_id} className="flex justify-between items-center py-1.5 border-b border-neutral-100/50 last:border-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  {avatarUrl ? (
                                    <img src={avatarUrl} className="w-6 h-6 rounded-full object-cover border border-neutral-200 shrink-0" alt={fullName} />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full font-bold flex items-center justify-center bg-neutral-200 text-neutral-600 text-[10px] shrink-0">
                                      {initials}
                                    </div>
                                  )}
                                  <span className="font-semibold flex items-center gap-1.5 truncate text-neutral-900">
                                    {fullName}
                                    {isCaptain && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1 py-0.2 rounded uppercase">C</span>}
                                  </span>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${getPositionColor(pos)}`}>
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
                            const guestName = rsvp.guest_name || 'Guest'
                            const initials = guestName.charAt(0).toUpperCase()
                            return (
                              <div key={gId} className="flex justify-between items-center py-1.5 border-b border-neutral-100/50 last:border-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full font-bold flex items-center justify-center bg-amber-100 text-amber-800 text-[10px] shrink-0 border border-amber-200">
                                    {initials}
                                  </div>
                                  <span className="font-semibold text-neutral-600 flex items-center gap-1.5 truncate">
                                    {guestName} <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded">Guest</span>
                                    {isCaptain && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1 py-0.2 rounded uppercase">C</span>}
                                  </span>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${getPositionColor(pos)}`}>
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

      {/* TAB: FIXTURE */}
      {matchdayTab === 'fixture' && teams.length > 0 && (
        <div data-tour="match-schedule" className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center rounded-t-2xl">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-neutral-500" />
              Schedule & Scores
            </h3>
            <div className="flex items-center gap-2">
              {matchSchedule.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSharingSchedule(true)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors"
                  title="Share Schedule & Scores"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}
              {matchSchedule.length > 0 && userRole === 'admin' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsAddManualMatchOpen(true)} className="h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Match
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReschedule} className="h-8 text-xs text-amber-700 border-amber-200 hover:bg-amber-50">
                    Reschedule
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="p-4">
            {matchSchedule.length === 0 ? (
              <div className="space-y-4">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-3">
                  <div className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Option 1: Fixture Templates</div>
                  <CustomSelect
                    value={scheduleType}
                    onChange={val => setScheduleType(val)}
                    placeholder="Select fixture template..."
                    buttonClassName="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                    options={[
                      { value: '1-Leg League', label: '1-Leg League' },
                      { value: '2-Leg League', label: '2-Leg League' },
                      { value: 'World Cup Knockout (1-Leg)', label: 'World Cup Knockout (1-Leg)' },
                      { value: 'UCL Knockout (2-Leg)', label: 'UCL Knockout (2-Leg)' }
                    ]}
                  />
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold" onClick={handleGenerateSchedule} disabled={isGeneratingSchedule}>
                    {isGeneratingSchedule ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
                    Generate Template Schedule
                  </Button>
                </div>

                {userRole === 'admin' && (
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex flex-col items-center gap-2">
                    <div className="text-xs font-bold text-emerald-900">Option 2: Create Custom Fixture</div>
                    <p className="text-[11px] text-emerald-700 text-center">Add matches one by one according to your custom tournament or casual format.</p>
                    <Button variant="outline" className="w-full border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-bold" onClick={() => setIsAddManualMatchOpen(true)}>
                      <Plus className="w-4 h-4 mr-1.5" /> Build Custom Fixture
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {orderedSchedule.map((match: any, index: number) => {
                  const isCompleted = match.status === 'completed'
                  const isExpanded = expandedMatchId === match.id
                  const matchGoals = goalEvents.filter((g: any) => g.match_schedule_id === match.id)

                  const homeTeam = teams.find((t: any) => t.id === match.home_team_id)
                  const awayTeam = teams.find((t: any) => t.id === match.away_team_id)
                  const homePlayersList = homeTeam ? getTeamPlayersList(homeTeam).map(p => ({ ...p, teamColor: homeTeam.jersey_color || '#16a34a', teamName: homeTeam.name })) : []
                  const awayPlayersList = awayTeam ? getTeamPlayersList(awayTeam).map(p => ({ ...p, teamColor: awayTeam.jersey_color || '#2563eb', teamName: awayTeam.name })) : []
                  const allMatchPlayers = [...homePlayersList, ...awayPlayersList]

                  return (
                    <div key={match.id} className="flex items-stretch gap-2">
                      {userRole === 'admin' && (
                        <div className="flex flex-col justify-center gap-1 flex-shrink-0 bg-neutral-50 rounded-xl px-1 border border-neutral-200 shadow-sm">
                          <button
                            type="button"
                            disabled={index === 0 || isReordering}
                            onClick={(e) => { e.stopPropagation(); handleMoveMatch(index, 'up') }}
                            className={`p-1.5 rounded-lg transition-colors ${index === 0 || isReordering ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-500 hover:bg-neutral-200 active:scale-90 hover:text-neutral-800'}`}
                            title="Move Up"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button
                            type="button"
                            disabled={index === orderedSchedule.length - 1 || isReordering}
                            onClick={(e) => { e.stopPropagation(); handleMoveMatch(index, 'down') }}
                            className={`p-1.5 rounded-lg transition-colors ${index === orderedSchedule.length - 1 || isReordering ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-500 hover:bg-neutral-200 active:scale-90 hover:text-neutral-800'}`}
                            title="Move Down"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </div>
                      )}
                      {(() => {
                        const isOngoing = match.status === 'ongoing'
                        const matchEvents = goalEvents.filter((g: any) => g.match_schedule_id === match.id)
                        const dynamicHomeScore = isOngoing ? matchEvents.filter((e: any) => {
                          const isOwn = e.details_json?.is_own_goal === true
                          if (e.team_id === match.home_team_id && !isOwn) return true
                          if (e.team_id === match.away_team_id && isOwn) return true
                          return false
                        }).length : 0
                        const dynamicAwayScore = isOngoing ? matchEvents.filter((e: any) => {
                          const isOwn = e.details_json?.is_own_goal === true
                          if (e.team_id === match.away_team_id && !isOwn) return true
                          if (e.team_id === match.home_team_id && isOwn) return true
                          return false
                        }).length : 0

                        return (
                          <div
                            className={`flex-1 rounded-xl border transition-colors overflow-hidden ${
                              isCompleted ? 'bg-neutral-50 border-neutral-200' :
                              isOngoing ? 'bg-white border-blue-200 shadow-sm' :
                              'bg-white border-green-100 hover:border-green-300 shadow-sm'
                            }`}
                          >
                            <div
                              onClick={() => handleExpandMatch(match)}
                              className="p-3 flex justify-between items-center cursor-pointer"
                            >
                              <div className="flex-1 flex justify-end items-center gap-2">
                                <span className="font-bold text-sm text-neutral-800">{getTeamName(match.home_team_id)}</span>
                                {(isCompleted || isOngoing) && (
                                  <span className="text-lg font-black text-neutral-900">
                                    {isOngoing ? (match.home_score ?? dynamicHomeScore) : match.home_score}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col items-center mx-2">
                                {match.stage_name && (
                                  <span className="text-[8px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 mb-0.5">
                                    {match.stage_name}
                                  </span>
                                )}
                                {isOngoing ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="px-2.5 py-0.5 bg-neutral-100 text-[10px] font-bold text-neutral-500 rounded">
                                      VS
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                      <span className="text-[9px] font-black text-red-600 uppercase tracking-wider">Live</span>
                                    </div>
                                  </div>
                                ) : isCompleted ? (
                                  <div className="px-2 py-0.5 bg-neutral-800 text-[9px] font-black text-white rounded uppercase tracking-wider">
                                    Full Time
                                  </div>
                                ) : (
                                  <div className="px-2.5 py-0.5 bg-neutral-100 text-[10px] font-bold text-neutral-500 rounded">
                                    VS
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 flex justify-start items-center gap-2">
                                {(isCompleted || isOngoing) && (
                                  <span className="text-lg font-black text-neutral-900">
                                    {isOngoing ? (match.away_score ?? dynamicAwayScore) : match.away_score}
                                  </span>
                                )}
                                <span className="font-bold text-sm text-neutral-800">{getTeamName(match.away_team_id)}</span>
                              </div>

                              <Link
                                href={`/groups/${groupId}/match/${booking.id}/game/${match.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="ml-3 shrink-0"
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-7 text-[9px] font-bold rounded-lg ${
                                    isOngoing
                                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  }`}
                                >
                                  Match Details ➔
                                </Button>
                              </Link>
                            </div>

                            {isExpanded && (
                              <div className="p-4 border-t border-neutral-100 bg-white space-y-3">
                                {(() => {
                                  const rawMatchGoals = goalEvents.filter((g: any) => g.match_schedule_id === match.id)
                                  const matchGoals: any[] = []
                                  const seenKeys = new Set<string>()

                                  rawMatchGoals.forEach((g: any) => {
                                    const sId = g.scorer_id || g.details_json?.guest_player_id || g.guest_scorer_name || 'unknown'
                                    const isOwn = g.is_own_goal || g.details_json?.is_own_goal === true
                                    const min = g.minute || 0
                                    const key = `${sId}_${isOwn}_${min}`
                                    if (!seenKeys.has(key)) {
                                      seenKeys.add(key)
                                      matchGoals.push(g)
                                    }
                                  })

                                  const homeTeamPlayerIds = new Set((homeTeam?.team_players || []).map((tp: any) => tp.player_id))
                                  const awayTeamPlayerIds = new Set((awayTeam?.team_players || []).map((tp: any) => tp.player_id))

                                  const getScorerLastName = (g: any) => {
                                    const fullName = g.profiles?.full_name || g.guest_scorer_name
                                    if (fullName) {
                                      const parts = fullName.trim().split(/\s+/)
                                      return parts.length > 1 ? parts[parts.length - 1] : parts[0]
                                    }
                                    return 'Player'
                                  }

                                  const getAssistLastName = (g: any) => {
                                    const fullName = g.assist?.full_name || g.guest_assist_name
                                    if (fullName) {
                                      const parts = fullName.trim().split(/\s+/)
                                      return parts.length > 1 ? parts[parts.length - 1] : parts[0]
                                    }
                                    return null
                                  }

                                  const homeScorers = matchGoals.filter((g: any) => {
                                    const isOwn = g.is_own_goal || g.details_json?.is_own_goal
                                    const belongsToHome = g.team_id ? g.team_id === match.home_team_id : (g.scorer_id && homeTeamPlayerIds.has(g.scorer_id))
                                    return isOwn ? !belongsToHome : belongsToHome
                                  })

                                  const awayScorers = matchGoals.filter((g: any) => {
                                    const isOwn = g.is_own_goal || g.details_json?.is_own_goal
                                    const belongsToAway = g.team_id ? g.team_id === match.away_team_id : (g.scorer_id && awayTeamPlayerIds.has(g.scorer_id))
                                    return isOwn ? !belongsToAway : belongsToAway
                                  })

                                  const mvpName = (() => {
                                    const mvpId = match.mvp_player_id || match.motm_player_id
                                    if (!mvpId) return null
                                    const cleanId = mvpId.replace('guest_', '').trim()
                                    const foundRsvp = rsvps.find((r: any) => r.player_id === mvpId || r.id === cleanId || r.guest_name === mvpId)
                                    if (foundRsvp) return foundRsvp.profiles?.full_name || foundRsvp.guest_name || null
                                    const foundPlayer = allPlayersForTeam.find((p: any) => p.id === mvpId || p.rsvpId === cleanId || p.name === mvpId)
                                    if (foundPlayer) return foundPlayer.name
                                    return null
                                  })()

                                  return (
                                    <>
                                      <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">
                                        Goal Scorers
                                      </div>

                                      {homeScorers.length === 0 && awayScorers.length === 0 ? (
                                        <p className="text-xs text-neutral-400 italic text-center py-1">No goals recorded yet</p>
                                      ) : (
                                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-xs">
                                          {/* Home Team Scorers */}
                                          <div className="space-y-1 text-left font-semibold text-neutral-800">
                                            {homeScorers.map((g: any, idx: number) => {
                                              const isOwn = g.is_own_goal || g.details_json?.is_own_goal
                                              const sName = getScorerLastName(g)
                                              const aName = getAssistLastName(g)
                                              return (
                                                <div key={g.id || idx} className="truncate">
                                                  <span>{sName} {g.minute ? `${g.minute}'` : ''}</span>
                                                  {isOwn && <span className="text-amber-500 font-bold text-[9px] ml-1">(OG)</span>}
                                                  {aName && !isOwn && <span className="text-neutral-400 font-normal text-[10px]"> (ast: {aName})</span>}
                                                </div>
                                              )
                                            })}
                                          </div>

                                          {/* Ball Divider */}
                                          <div className="text-neutral-400 text-xs self-center">⚽</div>

                                          {/* Away Team Scorers */}
                                          <div className="space-y-1 text-right font-semibold text-neutral-800">
                                            {awayScorers.map((g: any, idx: number) => {
                                              const isOwn = g.is_own_goal || g.details_json?.is_own_goal
                                              const sName = getScorerLastName(g)
                                              const aName = getAssistLastName(g)
                                              return (
                                                <div key={g.id || idx} className="truncate">
                                                  <span>{sName} {g.minute ? `${g.minute}'` : ''}</span>
                                                  {isOwn && <span className="text-amber-500 font-bold text-[9px] ml-1">(OG)</span>}
                                                  {aName && !isOwn && <span className="text-neutral-400 font-normal text-[10px]"> (ast: {aName})</span>}
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* MVP Badge */}
                                      {mvpName && (
                                        <div className="pt-2 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50/60 py-1.5 rounded-xl border border-amber-200/60">
                                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                          <span>Match MVP: {mvpName}</span>
                                        </div>
                                      )}

                                      {/* Match Details Link */}
                                      <div className="pt-1 text-center">
                                        <Link href={`/groups/${groupId}/match/${booking.id}/game/${match.id}`}>
                                          <Button size="sm" variant="ghost" className="w-full text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-xl">
                                            View Match Details & Log Events ➔
                                          </Button>
                                        </Link>
                                      </div>
                                    </>
                                  )
                                })()}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: MATCHDAY REPORT */}
      {matchdayTab === 'report' && teams.length > 0 && (() => {
        const isKnockoutSchedule = matchSchedule.some((m: any) => m.stage_name && (m.stage_name.includes('Semi') || m.stage_name.includes('Final') || m.stage_name.includes('Quarter') || m.stage_name.includes('Round')))

        return (
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

                    {/* KNOCKOUT STAGE BRACKET / PLAYOFF TREE GRAPH */}
                    {matchSchedule.some((m: any) => isKnockoutMatch(m)) && (
                      <div className="mt-5 pt-4 border-t border-neutral-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 inline-flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                            Knockout Stage & Playoff Tree
                          </h4>
                        </div>
                        <KnockoutBracketCard matches={matchSchedule.filter(isKnockoutMatch)} teams={teams} />
                      </div>
                    )}
                  </div>
                ) : (
                <div className="overflow-x-auto">
                  {sortedTopPlayers.length > 0 ? (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-100 text-neutral-400 font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-2">Player</th>
                          <th className="py-2.5 px-2">Team</th>
                          <th className="py-2.5 px-2 text-center">PTS</th>
                          <th className="py-2.5 px-2 text-center w-10">⚽ G</th>
                          <th className="py-2.5 px-2 text-center w-10">👟 A</th>
                          <th className="py-2.5 px-2 text-center w-10">🛡️ CS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {sortedTopPlayers.map((player) => (
                          <tr
                            key={player.id}
                            onClick={() => setSelectedPlayerForBreakdown(player)}
                            className="hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                            title="Click to view points breakdown"
                          >
                            <td className="py-3 px-2 font-bold text-neutral-800">
                              <div className="flex items-center gap-2">
                                {player.avatarUrl ? (
                                  <img src={player.avatarUrl} className="w-7 h-7 rounded-full object-cover border border-neutral-200 shrink-0" alt={player.name} />
                                ) : (
                                  <div className={`w-7 h-7 rounded-full font-bold flex items-center justify-center border text-xs shrink-0 ${player.isGuest ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                    {player.name.charAt(0)}
                                  </div>
                                )}
                                <div className="flex flex-col truncate">
                                  <span className="flex items-center gap-1 truncate font-bold text-neutral-900 group-hover:text-emerald-700 transition-colors">
                                    {player.name}
                                    {player.isGuest && (
                                      <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1 py-0.2 rounded uppercase tracking-wider">
                                        Guest
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[9px] font-semibold text-neutral-400 uppercase">{player.position}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-neutral-500 truncate max-w-[90px]">
                              {getTeamName(player.teamId)}
                            </td>
                            <td className={`py-3 px-2 text-center font-black rounded-lg transition-colors ${
                              player.fplPoints < 0
                                ? 'text-red-700 bg-red-50/80 group-hover:bg-red-100'
                                : 'text-emerald-700 bg-emerald-50/80 group-hover:bg-emerald-100'
                            }`}>
                              <div className="flex items-center justify-center gap-0.5">
                                <span>{player.fplPoints}</span>
                                <span className={`text-[9px] opacity-60 group-hover:opacity-100 transition-opacity ${player.fplPoints < 0 ? 'text-red-600' : 'text-emerald-600'}`}>ℹ️</span>
                              </div>
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

              {/* POINTS BREAKDOWN MODAL */}
              {selectedPlayerForBreakdown && (() => {
                const p = selectedPlayerForBreakdown
                const bd = p.breakdown
                const teamName = getTeamName(p.teamId)

                const items = bd ? [
                  { key: 'goals', ...bd.goalPts, icon: '⚽' },
                  { key: 'assists', ...bd.assistPts, icon: '👟' },
                  { key: 'cleanSheets', ...bd.cleanSheetPts, icon: '🛡️' },
                  { key: 'penaltySaves', ...bd.penaltySavePts, icon: '🧤' },
                  { key: 'conceded', ...bd.concededPts, icon: '🛑' },
                  { key: 'ownGoals', ...bd.ownGoalPts, icon: '🚨' },
                  { key: 'yellowCards', ...bd.yellowPts, icon: '🟨' },
                  { key: 'redCards', ...bd.redPts, icon: '🟥' },
                  { key: 'motm', ...bd.mvpPts, icon: '⭐' },
                  { key: 'appearances', ...bd.appearancePts, icon: '🏃' },
                ] : []

                return (
                  <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[90] animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 relative overflow-hidden">
                      {/* Modal Header */}
                      <div className="flex justify-between items-start pb-3 border-b border-neutral-100">
                        <div className="flex items-center gap-3">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm shrink-0" alt={p.name} />
                          ) : (
                            <div className={`w-12 h-12 rounded-full font-black flex items-center justify-center text-base border-2 shadow-sm shrink-0 ${p.isGuest ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
                              {p.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h3 className="font-black text-base text-neutral-900 leading-tight">{p.name}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                                {p.position}
                              </span>
                              {teamName && (
                                <span className="text-xs text-neutral-500 font-bold truncate max-w-[120px]">
                                  • {teamName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedPlayerForBreakdown(null)}
                          className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-full hover:bg-neutral-100 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Total Points Banner */}
                      <div className={`rounded-2xl p-3.5 flex justify-between items-center shadow-md ${
                        p.fplPoints < 0
                          ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white'
                      }`}>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-white/90">Group Points Earned</div>
                          <div className="text-xs text-white/80 font-medium mt-0.5">Custom Scoring Rules</div>
                        </div>
                        <div className="text-2xl font-black bg-white/10 px-3 py-1 rounded-xl border border-white/20">
                          {p.fplPoints} pts
                        </div>
                      </div>

                      {/* Itemized Points Breakdown List */}
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400 px-1">
                          Scoring Formula Breakdown
                        </div>
                        {items.map((item) => {
                          const isNonZero = item.count !== 0 && item.total !== 0
                          return (
                            <div
                              key={item.key}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                isNonZero
                                  ? 'bg-neutral-50 border-neutral-200 font-semibold'
                                  : 'bg-neutral-50/40 border-neutral-100 text-neutral-400 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{item.icon}</span>
                                <div>
                                  <span className="font-bold text-neutral-800">{item.label}</span>
                                  <span className="text-[10px] text-neutral-400 block font-normal">
                                    {item.count} × {item.weight > 0 ? `+${item.weight}` : item.weight} pts
                                  </span>
                                </div>
                              </div>
                              <div className={`font-black ${item.total > 0 ? 'text-emerald-600' : item.total < 0 ? 'text-red-600' : 'text-neutral-400'}`}>
                                {item.total > 0 ? `+${item.total}` : item.total} pts
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <Button
                        onClick={() => setSelectedPlayerForBreakdown(null)}
                        className="w-full bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold py-2.5"
                      >
                        Close Breakdown
                      </Button>
                    </div>
                  </div>
                )
              })()}

              {activeReportTab === 'points' ? (
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
              ) : (
                (() => {
                  const topScorerPlayer = [...sortedTopPlayers].filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals || b.fplPoints - a.fplPoints)[0] || null
                  const topMidfielderPlayer = [...sortedTopPlayers].filter(p => p.position === 'MID').sort((a, b) => b.assists - a.assists || b.fplPoints - a.fplPoints)[0] || null
                  const topDefenderGkPlayer = [...sortedTopPlayers].filter(p => p.position === 'DEF' || p.position === 'GK').sort((a, b) => b.cleanSheets - a.cleanSheets || b.fplPoints - a.fplPoints)[0] || null

                  return (
                    <TopPlayersShareCard
                      groupName={(booking.groups as any).name}
                      matchDate={format(parseISO(booking.match_date), 'MMM d, yyyy')}
                      fieldName={booking.field_name}
                      topPlayers={sortedTopPlayers.map(p => ({
                        id: p.id,
                        name: p.name,
                        position: p.position,
                        points: p.fplPoints,
                        goals: p.goals,
                        assists: p.assists,
                        cleanSheets: p.cleanSheets,
                        teamName: getTeamName(p.teamId),
                        avatarUrl: (p as any).avatarUrl || undefined,
                        motmCount: p.motmCount
                      }))}
                      topScorer={topScorerPlayer ? { name: topScorerPlayer.name, goals: topScorerPlayer.goals } : null}
                      topMidfielder={topMidfielderPlayer ? { name: topMidfielderPlayer.name, assists: topMidfielderPlayer.assists, points: topMidfielderPlayer.fplPoints } : null}
                      topDefenderGk={topDefenderGkPlayer ? { name: topDefenderGkPlayer.name, position: topDefenderGkPlayer.position, cleanSheets: topDefenderGkPlayer.cleanSheets, points: topDefenderGkPlayer.fplPoints } : null}
                    />
                  )
                })()
              )}
            </div>
          </div>
        )
      })()}

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
                    className={`w-10 h-10 transition-colors ${star <= (ratingHover || fieldRating)
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
              <h3 className="font-bold text-lg flex items-center gap-2"><Goal className="w-5 h-5" /> Add Goal</h3>
              <button onClick={() => setIsAddGoalOpen(false)}><X className="w-5 h-5 text-neutral-500" /></button>
            </div>

            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Team</label>
                <CustomSelect
                  value={goalForm.teamId}
                  onChange={val => setGoalForm({ ...goalForm, teamId: val, scorerId: '', assistId: '' })}
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
                  onChange={val => setGoalForm({ ...goalForm, scorerId: val })}
                  placeholder="Select Player..."
                  buttonClassName="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  disabled={!goalForm.teamId}
                  options={[
                    { value: '', label: 'Select Player...' },
                    ...(() => {
                      const selectedTeam = teams.find((t: any) => t.id === goalForm.teamId)
                      if (!selectedTeam) return []
                      const players: { value: string, label: string }[] = []
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
                  onChange={val => setGoalForm({ ...goalForm, assistId: val })}
                  placeholder="None"
                  buttonClassName="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  disabled={!goalForm.teamId}
                  options={[
                    { value: '', label: 'None' },
                    ...(() => {
                      const selectedTeam = teams.find((t: any) => t.id === goalForm.teamId)
                      if (!selectedTeam) return []
                      const players: { value: string, label: string }[] = []
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
                    onChange={e => setGoalForm({ ...goalForm, minute: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                      checked={goalForm.isOwnGoal}
                      onChange={e => setGoalForm({ ...goalForm, isOwnGoal: e.target.checked })}
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
      {isConfirmOutOpen && (() => {
        const myAssignedTeam = teams.find((t: any) => t.team_players?.some((tp: any) => tp.player_id === currentUser.id))
        const isBlocked = myAssignedTeam && userRole !== 'admin'
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/60 p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="font-bold text-xl text-neutral-900 mb-2">
                {isBlocked ? `Assigned to ${myAssignedTeam.name}` : 'Are you sure?'}
              </h3>
              <p className="text-neutral-600 mb-6 text-sm leading-relaxed">
                {isBlocked
                  ? `You are already assigned to ${myAssignedTeam.name} for this match. You cannot opt out directly. Please contact a Group Admin to opt out.`
                  : myAssignedTeam
                  ? `You are assigned to ${myAssignedTeam.name}. As an admin, opting out will remove you from the team.`
                  : waitlistPlayers.length > 0
                  ? 'Your spot will automatically be given to the next person on the waitlist. You will lose your guaranteed spot.'
                  : 'Are you sure you want to change your status to I\'m Out?'}
              </p>
              <div className="flex gap-3">
                {isBlocked ? (
                  <Button className="w-full h-12 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold" onClick={() => setIsConfirmOutOpen(false)}>
                    Got it
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsConfirmOutOpen(false)}>Cancel</Button>
                    <Button className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold" onClick={() => executeRsvp('out')}>
                      {isRsvpLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Yes, I\'m Out'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

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
                <h3 className="font-bold text-lg flex items-center gap-2"><Users className="w-5 h-5" /> Add Players</h3>
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
                      const prof = (m.profiles as any) || {}
                      const hasSecondary = prof.secondary_position && prof.secondary_position !== prof.preferred_position
                      const chosenPos = selectedMemberPositions[m.player_id] || prof.preferred_position || 'MID'

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
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-green-50 border-green-200 text-green-800' : 'bg-neutral-50 border-neutral-100 hover:bg-neutral-100/50 text-neutral-800'}`}
                        >
                          <div onClick={handleToggle} className="flex items-center justify-between">
                            <span className="font-semibold text-sm">{prof.full_name || 'Player'}</span>
                            {isSelected && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                          </div>
                          {isSelected && hasSecondary && (
                            <div className="flex gap-1.5 mt-2 pt-2 border-t border-green-200/60" onClick={e => e.stopPropagation()}>
                              <span className="text-[10px] font-bold text-green-700 self-center mr-1">Position:</span>
                              <button
                                type="button"
                                onClick={() => setSelectedMemberPositions(prev => ({ ...prev, [m.player_id]: prof.preferred_position || 'MID' }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                  chosenPos === (prof.preferred_position || 'MID')
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                                }`}
                              >
                                Primary ({prof.preferred_position || 'MID'})
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedMemberPositions(prev => ({ ...prev, [m.player_id]: prof.secondary_position }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                  chosenPos === prof.secondary_position
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                                }`}
                              >
                                Secondary ({prof.secondary_position})
                              </button>
                            </div>
                          )}
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
              <h3 className="font-bold text-lg flex items-center gap-2"><Users className="w-5 h-5 text-amber-500" /> Add Guest</h3>
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

      {/* Team Share Modal */}
      {sharingTeam && (() => {
        const teamTheme = getTeamGradient(sharingTeam.jersey_color)
        const teamPlayers = getTeamPlayersList(sharingTeam)
        const captainRsvp = rsvps.find((r: any) =>
          r.player_id === sharingTeam.captain_id || `guest_${r.id}` === sharingTeam.captain_id
        )
        const captainName = captainRsvp
          ? (captainRsvp.profiles?.full_name || captainRsvp.guest_name)
          : 'Not Assigned'

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const displayDomain = appUrl.replace(/https?:\/\//, '').replace(/\/$/, '')

        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
            <div className="bg-neutral-900 w-full max-w-sm max-h-[88vh] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col my-auto">
              <div className="flex justify-between items-center px-5 py-4 shrink-0 border-b border-neutral-800">
                <h3 className="font-bold text-white text-lg">Share Squad</h3>
                <button onClick={() => setSharingTeam(null)} className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Card Container to Capture */}
              <div className="p-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0 bg-neutral-900">
                <div
                  ref={teamCardRef}
                  className="w-[320px] mx-auto rounded-2xl relative shadow-lg"
                  style={{
                    background: teamTheme.gradient,
                    padding: '24px 20px',
                  }}
                >
                  {/* Decorative Background Orbs */}
                  <div
                    className="absolute -top-10 -right-10 w-36 h-36 rounded-full blur-[60px] pointer-events-none"
                    style={{ background: teamTheme.glow }}
                  />
                  <div
                    className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full blur-[40px] pointer-events-none"
                    style={{ background: `${teamTheme.accent}20` }}
                  />

                  {/* Grid Lines Overlay */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                    backgroundImage: `linear-gradient(${teamTheme.accent}40 1px, transparent 1px), linear-gradient(90deg, ${teamTheme.accent}40 1px, transparent 1px)`,
                    backgroundSize: '20px 20px'
                  }} />

                  {/* Card Content */}
                  <div
                    className="relative z-10 flex flex-col h-full"
                    style={{ color: teamTheme.text }}
                  >
                    {/* Header Branding */}
                    <div className="flex justify-between items-center mb-6">
                      <span
                        className="text-[9px] font-black uppercase tracking-[0.2em]"
                        style={{ color: teamTheme.isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)' }}
                      >
                        KhelaHobe
                      </span>
                      <span
                        className="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: teamTheme.isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.15)',
                          color: teamTheme.text
                        }}
                      >
                        Match Squad
                      </span>
                    </div>

                    {/* Team Name Title */}
                    <div className="text-center mb-5">
                      <h2
                        className="text-2xl font-black tracking-tight uppercase leading-none drop-shadow-sm mb-1"
                        style={{ color: teamTheme.text }}
                      >
                        {sharingTeam.name}
                      </h2>
                      <div
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold mt-1.5"
                        style={{
                          backgroundColor: teamTheme.isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                          color: teamTheme.text
                        }}
                      >
                        <Shield className="w-3 h-3" />
                        <span>Captain: {captainName}</span>
                      </div>
                    </div>

                    {/* Players List */}
                    <div
                      className="backdrop-blur-md rounded-xl p-3 space-y-2 border"
                      style={{
                        backgroundColor: teamTheme.isLight ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.25)',
                        borderColor: teamTheme.isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      {teamPlayers.length === 0 ? (
                        <p
                          className="text-xs italic text-center py-4"
                          style={{ color: teamTheme.isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)' }}
                        >
                          No squad members assigned yet.
                        </p>
                      ) : (
                        teamPlayers.map((player: any) => {
                          const avatarUrl = player.avatarUrl || null
                          const initials = (player.name || 'P').charAt(0).toUpperCase()
                          return (
                            <div
                              key={player.id}
                              className="flex justify-between items-center py-1.5 border-b last:border-none gap-2"
                              style={{ borderColor: teamTheme.isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)' }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {avatarUrl ? (
                                  <img src={avatarUrl} className="w-5 h-5 rounded-full object-cover border border-white/40 shrink-0" alt={player.name} />
                                ) : (
                                  <div
                                    className="w-5 h-5 rounded-full font-bold flex items-center justify-center text-[9px] shrink-0"
                                    style={{
                                      backgroundColor: teamTheme.isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.2)',
                                      color: teamTheme.text
                                    }}
                                  >
                                    {initials}
                                  </div>
                                )}
                                <span
                                  className="text-xs font-bold flex items-center gap-1 truncate"
                                  style={{ color: teamTheme.text }}
                                >
                                  {player.name}
                                  {player.isCaptain && <span className="text-[8px] font-black bg-amber-400 text-neutral-900 px-1 py-0.2 rounded uppercase">C</span>}
                                  {player.isGuest && (
                                    <span
                                      className="text-[8px] font-medium px-1 rounded shrink-0"
                                      style={{
                                        backgroundColor: teamTheme.isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.1)',
                                        color: teamTheme.isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.6)'
                                      }}
                                    >
                                      Guest
                                    </span>
                                  )}
                                </span>
                              </div>
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider"
                              style={{
                                backgroundColor: teamTheme.isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.05)',
                                borderColor: teamTheme.isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                                color: teamTheme.isLight ? '#0f172a' : 'rgba(255, 255, 255, 0.8)'
                              }}
                            >
                              {player.position}
                            </span>
                          </div>
                        )
                      })
                    )}
                    </div>

                    {/* Footer Url */}
                    <div className="text-center mt-6">
                      <span
                        className="text-[8px] font-bold uppercase tracking-[0.15em]"
                        style={{ color: teamTheme.isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)' }}
                      >
                        {displayDomain}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-5 pb-5 pt-2 flex gap-3 shrink-0 border-t border-neutral-800 bg-neutral-900">
                <Button
                  onClick={handleDownloadTeam}
                  disabled={isGeneratingTeamImage}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
                >
                  {isGeneratingTeamImage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  Save
                </Button>
                <Button
                  onClick={handleShareTeam}
                  disabled={isGeneratingTeamImage}
                  className="flex-1 h-12 rounded-xl text-white font-bold"
                  style={{ backgroundColor: teamTheme.accent, color: teamTheme.text }}
                >
                  {isGeneratingTeamImage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                  Share
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Schedule Share Modal */}
      {sharingSchedule && (() => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const displayDomain = appUrl.replace(/https?:\/\//, '').replace(/\/$/, '')
        const groupName = (booking.groups as any).name || 'Match'

        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
            <div className="bg-neutral-900 w-full max-w-sm max-h-[88vh] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col my-auto">
              <div className="flex justify-between items-center px-5 py-4 shrink-0 border-b border-neutral-800">
                <h3 className="font-bold text-white text-lg">Share Schedule</h3>
                <button onClick={() => setSharingSchedule(false)} className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Card Container to Capture */}
              <div className="p-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0 bg-neutral-900">
                <div
                  ref={scheduleCardRef}
                  className="w-[320px] mx-auto rounded-2xl relative shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #0b1528 0%, #030712 100%)',
                    padding: '24px 20px',
                  }}
                >
                  {/* Decorative Background Glows */}
                  <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full blur-[60px] pointer-events-none bg-green-500/10" />
                  <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full blur-[40px] pointer-events-none bg-blue-500/10" />

                  {/* Grid Lines Overlay */}
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
                    backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)`,
                    backgroundSize: '20px 20px'
                  }} />

                  {/* Card Content */}
                  <div className="relative z-10 flex flex-col h-full text-white">
                    {/* Header Branding */}
                    <div className="flex justify-between items-center mb-5">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">KhelaHobe</span>
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-green-500/10 text-green-400">
                        Fixtures & Scores
                      </span>
                    </div>

                    {/* Match & Venue Details */}
                    <div className="text-center mb-5">
                      <h2 className="text-xl font-black tracking-tight uppercase leading-none drop-shadow-sm mb-1 text-white text-center">
                        {groupName}
                      </h2>
                      <div className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-1.5 flex items-center justify-center gap-1.5">
                        <span>{format(parseISO(booking.match_date), 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span>{booking.field_name}</span>
                      </div>
                    </div>

                    {/* Fixtures List */}
                    <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/5 space-y-2.5">
                      {matchSchedule.map((match: any) => {
                        const isCompleted = match.status === 'completed'
                        const homeTeam = teams.find((t: any) => t.id === match.home_team_id)
                        const awayTeam = teams.find((t: any) => t.id === match.away_team_id)
                        const homeName = homeTeam?.name || 'Home'
                        const awayName = awayTeam?.name || 'Away'

                        return (
                          <div key={match.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-none">
                            {/* Home Team */}
                            <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                              <span className="text-[11px] font-bold text-white/95 truncate text-right">{homeName}</span>
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10" style={{ backgroundColor: homeTeam?.jersey_color || '#ffffff' }} />
                            </div>

                            {/* Score/VS Badge */}
                            <div className="px-2.5 py-0.5 rounded bg-white/5 border border-white/5 mx-2 flex-shrink-0 flex items-center justify-center min-w-[55px]">
                              {isCompleted ? (
                                <span className="text-[11px] font-black tracking-wider text-green-400">
                                  {match.home_score} - {match.away_score}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-white/40 tracking-wider">
                                  - : -
                                </span>
                              )}
                            </div>

                            {/* Away Team */}
                            <div className="flex-1 flex items-center justify-start gap-1.5 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10" style={{ backgroundColor: awayTeam?.jersey_color || '#ffffff' }} />
                              <span className="text-[11px] font-bold text-white/95 truncate text-left">{awayName}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Footer Url */}
                    <div className="text-center mt-6">
                      <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-white/30">
                        {displayDomain}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-5 pb-5 pt-2 flex gap-3 shrink-0 border-t border-neutral-800 bg-neutral-900">
                <Button
                  onClick={handleDownloadSchedule}
                  disabled={isGeneratingScheduleImage}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
                >
                  {isGeneratingScheduleImage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  Save
                </Button>
                <Button
                  onClick={handleShareSchedule}
                  disabled={isGeneratingScheduleImage}
                  className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                  {isGeneratingScheduleImage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                  Share
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MANUAL MATCH MODAL */}
      {isAddManualMatchOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-neutral-900">Add Custom Match</h3>
              <button onClick={() => setIsAddManualMatchOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualMatch} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-600 block mb-1">Stage / Match Label</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="e.g. Final, Semi-Final, Match 5"
                  value={manualStageName}
                  onChange={e => setManualStageName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 block mb-1">Home Team</label>
                <CustomSelect
                  value={manualHomeTeamId}
                  onChange={val => setManualHomeTeamId(val)}
                  placeholder="Select Home Team..."
                  buttonClassName="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                  options={[
                    { value: '', label: 'Select Home Team...' },
                    ...teams.map((t: any) => ({ value: t.id, label: t.name || 'Team' }))
                  ]}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 block mb-1">Away Team</label>
                <CustomSelect
                  value={manualAwayTeamId}
                  onChange={val => setManualAwayTeamId(val)}
                  placeholder="Select Away Team..."
                  buttonClassName="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                  options={[
                    { value: '', label: 'Select Away Team...' },
                    ...teams.map((t: any) => ({ value: t.id, label: t.name || 'Team' }))
                  ]}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddManualMatchOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={isManualMatchLoading}>
                  {isManualMatchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Match'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POSITION CHOICE MODAL */}
      {isPositionModalOpen && myProfile && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-neutral-100">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-1">Confirm Match Position</h3>
            <p className="text-xs text-neutral-500 mb-5">
              You have a secondary position registered in your profile. Select which position you will play in for this match.
            </p>

            {myProfile?.secondary_position && myProfile?.secondary_position !== myProfile?.preferred_position && myProfile?.preferred_position !== 'Field Player' ? (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setSelectedPosInput(myProfile.preferred_position || 'MID')}
                  className={`p-4 rounded-2xl border-2 transition-all text-center ${
                    selectedPosInput === (myProfile.preferred_position || 'MID')
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/30'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Primary</div>
                  <div className="text-xl font-black">{myProfile.preferred_position || 'MID'}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPosInput(myProfile.secondary_position!)}
                  className={`p-4 rounded-2xl border-2 transition-all text-center ${
                    selectedPosInput === myProfile.secondary_position
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/30'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">Secondary</div>
                  <div className="text-xl font-black">{myProfile.secondary_position}</div>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {[
                  { pos: 'GK', name: 'Goalkeeper', color: 'bg-emerald-50 text-emerald-900 border-emerald-600' },
                  { pos: 'DEF', name: 'Defender', color: 'bg-blue-50 text-blue-900 border-blue-600' },
                  { pos: 'MID', name: 'Midfielder', color: 'bg-amber-50 text-amber-900 border-amber-600' },
                  { pos: 'ATT', name: 'Attacker', color: 'bg-rose-50 text-rose-900 border-rose-600' }
                ].map(item => (
                  <button
                    key={item.pos}
                    type="button"
                    onClick={() => setSelectedPosInput(item.pos)}
                    className={`p-3 rounded-2xl border-2 font-bold text-center transition-all ${
                      selectedPosInput === item.pos
                        ? `${item.color} ring-2 ring-emerald-600/30`
                        : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <div className="text-xs uppercase opacity-75">{item.name}</div>
                    <div className="text-lg font-black">{item.pos}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsPositionModalOpen(false)}
                className="flex-1 h-12 rounded-xl text-neutral-600 font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={() => executeRsvp('in', selectedPosInput)}
                disabled={isRsvpLoading}
                className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md"
              >
                {isRsvpLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
