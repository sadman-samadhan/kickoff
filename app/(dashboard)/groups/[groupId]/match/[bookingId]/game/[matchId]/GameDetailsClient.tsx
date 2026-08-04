/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { toPng } from 'html-to-image'
import {
  ChevronLeft,
  Clock,
  Trash2,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  Crown,
  Share2,
  X,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  logMatchEventAction,
  deleteMatchEventAction,
  updateMatchDurationAction,
  updateMatchStatusAction,
  updateStartingLineupAction,
  updateMatchMvpAction
} from './gameActions'
import { calculateMatchPlayerPitchTime } from '@/lib/tournamentScoring'

interface GameDetailsClientProps {
  groupId: string
  bookingId: string
  matchId: string
  match: any
  homeTeam: any
  awayTeam: any
  homePlayers: any[]
  awayPlayers: any[]
  events: any[]
  isAdmin: boolean
}

interface OptionItem<T extends string = string> {
  value: T
  label: string
  sublabel?: string
  color?: string
  avatarUrl?: string
}

function getLastName(fullName: string) {
  if (!fullName) return 'Player'
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : parts[0]
}

function OptionSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: OptionItem<T>[]
  value: T
  onChange: (val: T) => void
  placeholder?: string
}) {
  if (options.length === 0) {
    return <p className="text-xs text-neutral-400 italic py-1">No options available</p>
  }

  return (
    <div className="flex flex-wrap gap-2 py-1 max-h-48 overflow-y-auto pr-1">
      {options.map((opt) => {
        const isSelected = value === opt.value
        const lastName = getLastName(opt.label)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm active:scale-95 ${
              isSelected
                ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-600 ring-offset-1'
                : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200'
            }`}
          >
            {opt.avatarUrl ? (
              <img src={opt.avatarUrl} className="w-5 h-5 rounded-full object-cover border border-white/40 shrink-0" alt={lastName} />
            ) : opt.color ? (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                style={{ backgroundColor: opt.color }}
              />
            ) : null}
            <span>{lastName}</span>
            {opt.sublabel && (
              <span className={`text-[10px] opacity-80 font-normal ${isSelected ? 'text-emerald-100' : 'text-neutral-400'}`}>
                ({opt.sublabel})
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function GameDetailsClient({
  groupId,
  bookingId,
  matchId,
  match,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  events,
  isAdmin,
}: GameDetailsClientProps) {
  const [activeTab, setActiveTab] = useState<'events' | 'lineup' | 'pitchTime'>('events')
  const allPlayers = [...homePlayers, ...awayPlayers]

  // Live Timer & Match Setup States
  const [matchStructure, setMatchStructure] = useState<'halves' | 'continuous'>('halves')
  const [halfDuration, setHalfDuration] = useState<number>(15)
  const [breakDuration, setBreakDuration] = useState<number>(5)

  const initialPeriod = match.status === 'completed'
    ? 'completed'
    : match.status === 'ongoing'
    ? (match.period || '1st_half')
    : 'scheduled'

  const [period, setPeriod] = useState<'scheduled' | '1st_half' | 'half_time' | '2nd_half' | 'completed'>(initialPeriod)
  const [timerState, setTimerState] = useState<'stopped' | 'running' | 'paused'>(
    match.status === 'ongoing' ? 'running' : 'stopped'
  )
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [isStartSetupOpen, setIsStartSetupOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isGeneratingShareImage, setIsGeneratingShareImage] = useState(false)
  const [selectedMvpId, setSelectedMvpId] = useState<string | null>(match.mvp_player_id || null)
  const [isUpdatingMvp, setIsUpdatingMvp] = useState(false)

  const shareCardRef = useRef<HTMLDivElement>(null)

  // Sync elapsed seconds from localStorage or server started_at timestamp
  useEffect(() => {
    try {
      const storedTimer = localStorage.getItem(`khelahobe_live_timer_${matchId}`)
      if (storedTimer) {
        const parsed = JSON.parse(storedTimer)
        if (parsed.status === 'ongoing' && parsed.startedAtMs) {
          const elapsed = Math.max(0, Math.floor((Date.now() - parsed.startedAtMs) / 1000))
          setElapsedSeconds(elapsed)
          if (parsed.period) setPeriod(parsed.period)
          setTimerState('running')
        }
      } else if (match.status === 'ongoing' && match.started_at) {
        const startMs = new Date(match.started_at).getTime()
        if (!isNaN(startMs)) {
          setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
        }
      }
    } catch (e) {
      console.error('Failed to sync live timer:', e)
    }
  }, [matchId, match.status, match.started_at])

  // Real-time Timer Ticker Effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (timerState === 'running') {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timerState])

  // Auto-stop clock & mark match complete at (duration + 2) minutes if not stopped manually
  useEffect(() => {
    if (timerState !== 'running') return

    const maxAllowedSeconds = (Math.max(1, halfDuration) + 2) * 60
    if (elapsedSeconds >= maxAllowedSeconds) {
      handleNextPeriod()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds, timerState, halfDuration])

  const getCurrentMatchMinute = () => {
    const elapsedMins = Math.floor(elapsedSeconds / 60)
    if (period === '2nd_half' && matchStructure === 'halves') {
      return halfDuration + elapsedMins + 1
    }
    return elapsedMins + 1
  }

  const formatTimerDisplay = () => {
    const mins = Math.floor(elapsedSeconds / 60)
    const secs = elapsedSeconds % 60
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
    return `${pad(mins)}:${pad(secs)}`
  }

  // Load saved matchday timing defaults for this booking if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`khelahobe_match_timing_${bookingId}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.matchStructure) setMatchStructure(parsed.matchStructure)
        if (parsed.halfDuration) setHalfDuration(parsed.halfDuration)
        if (parsed.breakDuration !== undefined) setBreakDuration(parsed.breakDuration)
      }
    } catch (e) {
      console.error('Failed to load match timing defaults:', e)
    }
  }, [bookingId])

  // Handle Match Controls
  const handleStartMatchConfirm = async () => {
    setIsStartSetupOpen(false)
    setPeriod('1st_half')
    setTimerState('running')
    setElapsedSeconds(0)

    const nowMs = Date.now()
    const nowIso = new Date(nowMs).toISOString()

    try {
      localStorage.setItem(
        `khelahobe_live_timer_${matchId}`,
        JSON.stringify({ startedAtMs: nowMs, period: '1st_half', status: 'ongoing' })
      )
      localStorage.setItem(
        `khelahobe_match_timing_${bookingId}`,
        JSON.stringify({ matchStructure, halfDuration, breakDuration })
      )
    } catch (e) {
      console.error(e)
    }

    try {
      const totalDur = matchStructure === 'halves' ? halfDuration * 2 : halfDuration
      await updateMatchDurationAction(matchId, bookingId, groupId, totalDur)
      await updateMatchStatusAction(matchId, bookingId, groupId, 'ongoing', nowIso, '1st_half')
    } catch (e: any) {
      console.error('Failed to start match:', e)
    }
  }

  const handleResetClock = async () => {
    setPeriod('scheduled')
    setTimerState('stopped')
    setElapsedSeconds(0)
    try {
      localStorage.removeItem(`khelahobe_live_timer_${matchId}`)
    } catch (e) {
      console.error(e)
    }
    try {
      await updateMatchStatusAction(matchId, bookingId, groupId, 'scheduled', null, 'scheduled')
    } catch (e: any) {
      console.error('Failed to reset clock:', e)
    }
  }

  const handleNextPeriod = async () => {
    const nowMs = Date.now()
    const nowIso = new Date(nowMs).toISOString()

    if (period === '1st_half' && matchStructure === 'halves') {
      setPeriod('half_time')
      setTimerState('stopped')
      setElapsedSeconds(0)
      try {
        localStorage.setItem(
          `khelahobe_live_timer_${matchId}`,
          JSON.stringify({ startedAtMs: null, period: 'half_time', status: 'ongoing' })
        )
      } catch (e) {
        console.error(e)
      }
      try {
        await updateMatchStatusAction(matchId, bookingId, groupId, 'ongoing', null, 'half_time')
      } catch (e: any) {
        console.error(e)
      }
    } else if (period === 'half_time') {
      setPeriod('2nd_half')
      setTimerState('running')
      setElapsedSeconds(0)
      try {
        localStorage.setItem(
          `khelahobe_live_timer_${matchId}`,
          JSON.stringify({ startedAtMs: nowMs, period: '2nd_half', status: 'ongoing' })
        )
      } catch (e) {
        console.error(e)
      }
      try {
        await updateMatchStatusAction(matchId, bookingId, groupId, 'ongoing', nowIso, '2nd_half')
      } catch (e: any) {
        console.error(e)
      }
    } else if (period === '2nd_half' || (period === '1st_half' && matchStructure === 'continuous')) {
      setPeriod('completed')
      setTimerState('stopped')
      try {
        localStorage.removeItem(`khelahobe_live_timer_${matchId}`)
      } catch (e) {
        console.error(e)
      }
      try {
        await updateMatchStatusAction(matchId, bookingId, groupId, 'completed', null, 'completed')
      } catch (e: any) {
        console.error(e)
      }
    }
  }

  // Dynamic Score Calculation from Events (Instant client update + Own Goal handling)
  const dynamicHomeScore = events.filter((e) => e.event_type === 'goal').reduce((acc, g) => {
    const isOwn = g.details_json?.is_own_goal === true
    if (g.team_id === homeTeam?.id && !isOwn) return acc + 1
    if (g.team_id === awayTeam?.id && isOwn) return acc + 1
    return acc
  }, 0)

  const dynamicAwayScore = events.filter((e) => e.event_type === 'goal').reduce((acc, g) => {
    const isOwn = g.details_json?.is_own_goal === true
    if (g.team_id === awayTeam?.id && !isOwn) return acc + 1
    if (g.team_id === homeTeam?.id && isOwn) return acc + 1
    return acc
  }, 0)

  const getPlayerName = (pid?: string | null, detailsJson?: any, isSecondary = false) => {
    const targetId = pid || (isSecondary ? detailsJson?.guest_secondary_player_id : detailsJson?.guest_player_id)
    if (!targetId) return 'Player'
    const p = allPlayers.find((x) => x.id === targetId)
    return p ? p.full_name : 'Player'
  }

  // Goal Scorers List for Popular Sports Site Scoreboard
  const getTeamScorerSummary = (targetTeamId: string) => {
    const opponentTeamId = targetTeamId === homeTeam?.id ? awayTeam?.id : homeTeam?.id
    const teamGoals = events.filter((e) => {
      if (e.event_type !== 'goal') return false
      const isOwn = e.details_json?.is_own_goal === true
      if (isOwn) return e.team_id === opponentTeamId
      return e.team_id === targetTeamId
    })

    return teamGoals.map((g) => {
      const isOwn = g.details_json?.is_own_goal === true
      const scorerName = getPlayerName(g.player_id, g.details_json)
      const lastName = getLastName(scorerName)
      return {
        id: g.id,
        lastName,
        minute: g.minute,
        isOwnGoal: isOwn,
      }
    })
  }

  const homeScorers = getTeamScorerSummary(homeTeam?.id)
  const awayScorers = getTeamScorerSummary(awayTeam?.id)

  // Event Modal States
  const [goalModal, setGoalModal] = useState<{ isOpen: boolean; teamId: string; scorerId: string; assistId: string; minute: number; isOwnGoal: boolean }>({
    isOpen: false, teamId: homeTeam?.id || '', scorerId: '', assistId: '', minute: 0, isOwnGoal: false
  })
  const [cardModal, setCardModal] = useState<{ isOpen: boolean; teamId: string; playerId: string; cardType: 'yellow' | 'red'; minute: number }>({
    isOpen: false, teamId: homeTeam?.id || '', playerId: '', cardType: 'yellow', minute: 0
  })
  const [subModal, setSubModal] = useState<{ isOpen: boolean; teamId: string; subOffId: string; subOnId: string; minute: number }>({
    isOpen: false, teamId: homeTeam?.id || '', subOffId: '', subOnId: '', minute: 0
  })
  const [penModal, setPenModal] = useState<{ isOpen: boolean; playerId: string; minute: number }>({
    isOpen: false, playerId: '', minute: 0
  })

  const [isLogging, setIsLogging] = useState(false)

  const defaultStartingPids = match.starting_player_ids || allPlayers.map((p) => p.id)
  const [startingPlayerIds, setStartingPlayerIds] = useState<string[]>(defaultStartingPids)

  const handleToggleStartingPlayer = async (pid: string) => {
    if (!isAdmin) return
    const nextPids = startingPlayerIds.includes(pid)
      ? startingPlayerIds.filter((id) => id !== pid)
      : [...startingPlayerIds, pid]

    setStartingPlayerIds(nextPids)
    try {
      await updateStartingLineupAction(matchId, bookingId, groupId, nextPids)
    } catch (e: any) {
      console.error(e)
    }
  }

  // Dynamic On-Pitch / On-Bench State for Substitutions
  const getDynamicPitchState = (teamIdFilter?: string) => {
    const onPitch = new Set<string>(startingPlayerIds)
    const onBench = new Set<string>(allPlayers.map((p) => p.id).filter((id) => !startingPlayerIds.includes(id)))

    events
      .filter((e) => e.event_type === 'sub')
      .sort((a, b) => a.minute - b.minute)
      .forEach((sub) => {
        const subOffId = sub.player_id || sub.details_json?.guest_player_id
        const subOnId = sub.secondary_player_id || sub.details_json?.guest_secondary_player_id

        if (subOffId) {
          onPitch.delete(subOffId)
          onBench.add(subOffId)
        }
        if (subOnId) {
          onBench.delete(subOnId)
          onPitch.add(subOnId)
        }
      })

    let targetPlayers = allPlayers
    if (teamIdFilter === homeTeam?.id) targetPlayers = homePlayers
    else if (teamIdFilter === awayTeam?.id) targetPlayers = awayPlayers

    return {
      onPitchPlayers: targetPlayers.filter((p) => onPitch.has(p.id)),
      onBenchPlayers: targetPlayers.filter((p) => onBench.has(p.id)),
    }
  }

  // Pitch Time Calculation
  const homePids = homePlayers.map((p) => p.id)
  const awayPids = awayPlayers.map((p) => p.id)

  const pitchData = calculateMatchPlayerPitchTime(
    events,
    (matchStructure === 'halves' ? halfDuration * 2 : halfDuration) || 30,
    homePids,
    awayPids,
    startingPlayerIds
  )

  const handleLogGoal = async () => {
    if (!goalModal.scorerId || !goalModal.teamId) return
    setIsLogging(true)
    try {
      await logMatchEventAction(matchId, bookingId, groupId, {
        event_type: 'goal',
        player_id: goalModal.scorerId,
        secondary_player_id: goalModal.assistId || null,
        team_id: goalModal.teamId,
        minute: goalModal.minute || getCurrentMatchMinute(),
        details_json: { is_own_goal: goalModal.isOwnGoal },
      })
      setGoalModal({ isOpen: false, teamId: homeTeam?.id || '', scorerId: '', assistId: '', minute: 0, isOwnGoal: false })
    } catch (e: any) {
      alert(e.message || 'Failed to log goal')
    } finally {
      setIsLogging(false)
    }
  }

  const handleLogCard = async () => {
    if (!cardModal.playerId) return
    setIsLogging(true)
    try {
      await logMatchEventAction(matchId, bookingId, groupId, {
        event_type: 'card',
        player_id: cardModal.playerId,
        minute: cardModal.minute || getCurrentMatchMinute(),
        details_json: { card_type: cardModal.cardType },
      })
      setCardModal({ isOpen: false, teamId: homeTeam?.id || '', playerId: '', cardType: 'yellow', minute: 0 })
    } catch (e: any) {
      alert(e.message || 'Failed to log card')
    } finally {
      setIsLogging(false)
    }
  }

  const handleLogSub = async () => {
    if (!subModal.subOffId || !subModal.subOnId) return
    setIsLogging(true)
    try {
      await logMatchEventAction(matchId, bookingId, groupId, {
        event_type: 'sub',
        player_id: subModal.subOffId,
        secondary_player_id: subModal.subOnId,
        minute: subModal.minute || getCurrentMatchMinute(),
      })
      setSubModal({ isOpen: false, teamId: homeTeam?.id || '', subOffId: '', subOnId: '', minute: 0 })
    } catch (e: any) {
      alert(e.message || 'Failed to log substitution')
    } finally {
      setIsLogging(false)
    }
  }

  const handleLogPenaltySave = async () => {
    if (!penModal.playerId) return
    setIsLogging(true)
    try {
      await logMatchEventAction(matchId, bookingId, groupId, {
        event_type: 'penalty_save',
        player_id: penModal.playerId,
        minute: penModal.minute || getCurrentMatchMinute(),
      })
      setPenModal({ isOpen: false, playerId: '', minute: 0 })
    } catch (e: any) {
      alert(e.message || 'Failed to log penalty save')
    } finally {
      setIsLogging(false)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!isAdmin) return
    try {
      await deleteMatchEventAction(eventId, matchId, bookingId, groupId)
    } catch (e: any) {
      alert(e.message || 'Failed to delete event')
    }
  }

  const handleSelectMvp = async (pid: string) => {
    if (!isAdmin) return
    setIsUpdatingMvp(true)
    const nextId = selectedMvpId === pid ? null : pid
    setSelectedMvpId(nextId)
    try {
      await updateMatchMvpAction(matchId, bookingId, groupId, nextId)
    } catch (e: any) {
      alert(e.message || 'Failed to update MVP')
    } finally {
      setIsUpdatingMvp(false)
    }
  }

  // Handle Share / Download Card PNG
  const handleShareMatchCardImage = async () => {
    if (!shareCardRef.current) return
    setIsGeneratingShareImage(true)
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        quality: 1,
        pixelRatio: 3,
        cacheBust: true,
      })

      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], `khelahobe-match-${match.match_number}-result.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Match #${match.match_number} Result — KhelaHobe`,
          text: `Match #${match.match_number} Result: ${homeTeam?.name || 'Home'} ${dynamicHomeScore} - ${dynamicAwayScore} ${awayTeam?.name || 'Away'} ⚽`,
          files: [file],
        })
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `khelahobe-match-${match.match_number}-result.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (e) {
      console.error('Share match card failed:', e)
    } finally {
      setIsGeneratingShareImage(false)
    }
  }

  const handleDownloadMatchCardImage = async () => {
    if (!shareCardRef.current) return
    setIsGeneratingShareImage(true)
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        quality: 1,
        pixelRatio: 3,
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `khelahobe-match-${match.match_number}-result.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      console.error('Download match card failed:', e)
    } finally {
      setIsGeneratingShareImage(false)
    }
  }

  const selectedMvpPlayer = allPlayers.find((p) => p.id === selectedMvpId)

  return (
    <div className="flex flex-col gap-5 p-4 max-w-xl mx-auto pb-24 min-h-screen">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link href={`/groups/${groupId}/match/${bookingId}?tab=fixture`}>
          <Button variant="ghost" size="sm" className="rounded-xl text-neutral-600 font-bold text-xs p-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Schedule
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          {/* Share Match Card Button */}
          <Button
            size="sm"
            onClick={() => setIsShareModalOpen(true)}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl h-8 flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" /> Share Card
          </Button>

          <span
            className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
              period === 'completed' || match.status === 'completed'
                ? 'bg-neutral-200 text-neutral-700'
                : period === '1st_half' || period === '2nd_half'
                ? 'bg-blue-100 text-blue-700 animate-pulse'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {period === '1st_half'
              ? '1st Half'
              : period === 'half_time'
              ? 'Half Time'
              : period === '2nd_half'
              ? '2nd Half'
              : period === 'completed' || match.status === 'completed'
              ? 'Completed'
              : 'Scheduled'}
          </span>
        </div>
      </div>

      {/* Live Match Clock Bar (When match is ongoing / scheduled) */}
      {isAdmin && (
        <div className="bg-neutral-900 text-white rounded-2xl p-3.5 flex items-center justify-between shadow-md border border-neutral-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-base font-black tracking-widest text-emerald-400">
              {formatTimerDisplay()}
            </span>
            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
              ({period === '1st_half' ? '1st Half' : period === '2nd_half' ? '2nd Half' : period === 'half_time' ? 'Half-Time Break' : 'Match Clock'})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {period === 'scheduled' && match.status !== 'completed' ? (
              <Button
                size="sm"
                onClick={() => setIsStartSetupOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-8"
              >
                <Play className="w-3.5 h-3.5 mr-1" /> Start Match
              </Button>
            ) : (
              <>
                {period !== 'completed' && match.status !== 'completed' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTimerState(timerState === 'running' ? 'paused' : 'running')}
                      className="h-8 text-xs font-bold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700"
                    >
                      {timerState === 'running' ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleNextPeriod}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl h-8"
                    >
                      {period === '1st_half'
                        ? matchStructure === 'halves' ? 'End 1st Half' : 'Finish Match'
                        : period === 'half_time'
                        ? 'Start 2nd Half'
                        : 'Finish Match'}
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetClock}
                  className="h-8 text-xs font-bold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700 flex items-center gap-1"
                  title="Reset clock in case of false start"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Scoreboard Card */}
      <div className="bg-neutral-900 text-white rounded-3xl p-5 shadow-xl border border-neutral-800 relative overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Match #{match.match_number} {match.stage_name ? `• ${match.stage_name}` : ''}
          </span>
          <span className="text-[10px] text-neutral-400 font-bold">
            {matchStructure === 'halves' ? `2 × ${halfDuration}m` : `${halfDuration}m`}
          </span>
        </div>

        <div className="flex items-center justify-between py-2">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center text-center">
            <div
              className="w-12 h-12 rounded-2xl mb-2 flex items-center justify-center font-black text-white text-base shadow-md border"
              style={{ backgroundColor: homeTeam?.jersey_color || '#16a34a', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              {(homeTeam?.name || 'Home').charAt(0)}
            </div>
            <span className="font-black text-sm text-white truncate max-w-[110px]">{homeTeam?.name || 'Home Team'}</span>
          </div>

          {/* Live Score */}
          <div className="px-4 text-center">
            <div className="text-3xl font-black tracking-tight text-white">
              {dynamicHomeScore} : {dynamicAwayScore}
            </div>
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-400 mt-1 block">
              {period === 'completed' || match.status === 'completed' ? 'Final Score' : period === '1st_half' || period === '2nd_half' ? 'LIVE' : 'VS'}
            </span>
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center text-center">
            <div
              className="w-12 h-12 rounded-2xl mb-2 flex items-center justify-center font-black text-white text-base shadow-md border"
              style={{ backgroundColor: awayTeam?.jersey_color || '#2563eb', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              {(awayTeam?.name || 'Away').charAt(0)}
            </div>
            <span className="font-black text-sm text-white truncate max-w-[110px]">{awayTeam?.name || 'Away Team'}</span>
          </div>
        </div>

        {/* Popular Sports Site Style Goal Scorers Summary Under Scoreboard */}
        {(homeScorers.length > 0 || awayScorers.length > 0) && (
          <div className="mt-4 pt-3 border-t border-neutral-800/80 grid grid-cols-[1fr_auto_1fr] items-start gap-2 text-[11px]">
            {/* Home Scorers List */}
            <div className="space-y-1 text-left text-neutral-300 font-semibold">
              {homeScorers.map((s) => (
                <div key={s.id} className="truncate">
                  {s.lastName} {s.minute}&apos; {s.isOwnGoal && <span className="text-amber-400 text-[9px] font-bold">(OG)</span>}
                </div>
              ))}
            </div>

            {/* Soccer Ball Icon Center Divider */}
            <div className="text-center text-neutral-500 pt-0.5">⚽</div>

            {/* Away Scorers List */}
            <div className="space-y-1 text-right text-neutral-300 font-semibold">
              {awayScorers.map((s) => (
                <div key={s.id} className="truncate">
                  {s.lastName} {s.minute}&apos; {s.isOwnGoal && <span className="text-amber-400 text-[9px] font-bold">(OG)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Match MVP Badge if Selected */}
        {selectedMvpPlayer && (
          <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 py-1.5 rounded-xl border border-amber-500/20">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Match MVP: {selectedMvpPlayer.full_name}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-neutral-100 p-1.5 rounded-2xl overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'events' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          }`}
        >
          ⚽ Events ({events.length})
        </button>
        <button
          onClick={() => setActiveTab('lineup')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'lineup' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          }`}
        >
          📋 Starters & Bench
        </button>
        <button
          onClick={() => setActiveTab('pitchTime')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'pitchTime' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          }`}
        >
          ⏱️ Pitch Time
        </button>
      </div>

      {/* TAB 1: LIVE EVENTS & LOGGER */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* Match MVP Selection Block (Only Available When Match is Finished) */}
          {(period === 'completed' || match.status === 'completed') && isAdmin && (
            <div className="bg-amber-50/60 rounded-3xl p-4 border border-amber-200/80 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500" /> Select Match MVP
                </span>
                <div className="flex items-center gap-2">
                  {selectedMvpId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSelectMvp(selectedMvpId)}
                      disabled={isUpdatingMvp}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2.5 rounded-lg border border-red-200/60"
                    >
                      Clear MVP
                    </Button>
                  )}
                  {isUpdatingMvp && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />}
                </div>
              </div>
              <p className="text-[11px] text-amber-700 font-medium">Match finished! Tap a player to select MVP, or tap a selected MVP to clear.</p>

              {/* Home Team MVP Row */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-neutral-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: homeTeam?.jersey_color || '#16a34a' }} />
                  {homeTeam?.name || 'Home Team'}
                </span>
                <OptionSelector
                  options={homePlayers.map((p) => ({
                    value: p.id,
                    label: p.full_name,
                    avatarUrl: p.avatar_url,
                    color: homeTeam?.jersey_color,
                  }))}
                  value={selectedMvpId || ''}
                  onChange={(val) => handleSelectMvp(val)}
                  placeholder="Select Home MVP..."
                />
              </div>

              {/* Away Team MVP Row */}
              <div className="space-y-1 pt-1 border-t border-amber-200/40">
                <span className="text-[11px] font-bold text-neutral-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: awayTeam?.jersey_color || '#2563eb' }} />
                  {awayTeam?.name || 'Away Team'}
                </span>
                <OptionSelector
                  options={awayPlayers.map((p) => ({
                    value: p.id,
                    label: p.full_name,
                    avatarUrl: p.avatar_url,
                    color: awayTeam?.jersey_color,
                  }))}
                  value={selectedMvpId || ''}
                  onChange={(val) => handleSelectMvp(val)}
                  placeholder="Select Away MVP..."
                />
              </div>
            </div>
          )}

          {/* Quick Action Event Logger Buttons for Admin */}
          {isAdmin && (
            <div className="bg-white rounded-3xl p-4 border border-neutral-100 shadow-sm space-y-3">
              <span className="text-xs font-black text-neutral-900 uppercase tracking-wider block">
                Log Match Event
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    setGoalModal({
                      isOpen: true,
                      teamId: homeTeam?.id || '',
                      scorerId: '',
                      assistId: '',
                      minute: getCurrentMatchMinute(),
                      isOwnGoal: false,
                    })
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-10"
                >
                  ⚽ + Goal
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    setCardModal({
                      isOpen: true,
                      teamId: homeTeam?.id || '',
                      playerId: '',
                      cardType: 'yellow',
                      minute: getCurrentMatchMinute(),
                    })
                  }
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl h-10"
                >
                  🟨 + Card
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    setSubModal({
                      isOpen: true,
                      teamId: homeTeam?.id || '',
                      subOffId: '',
                      subOnId: '',
                      minute: getCurrentMatchMinute(),
                    })
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl h-10"
                >
                  🔄 + Sub
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPenModal({ isOpen: true, playerId: '', minute: getCurrentMatchMinute() })}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl h-10"
                >
                  🧤 + Pen Save
                </Button>
              </div>
            </div>
          )}

          {/* Timeline Events Feed */}
          <div className="bg-white rounded-3xl p-4 border border-neutral-100 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider">Match Events Log</h4>
            {events.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-6 text-center">No match events logged yet.</p>
            ) : (
              <div className="space-y-2">
                {events
                  .sort((a, b) => b.minute - a.minute)
                  .map((evt) => {
                    const isOwn = evt.details_json?.is_own_goal === true
                    const cardType = evt.details_json?.card_type

                    return (
                      <div
                        key={evt.id}
                        className="p-3 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-xl bg-neutral-900 text-white font-mono font-bold flex items-center justify-center shrink-0 text-[10px]">
                            {evt.minute}&apos;
                          </span>
                          <div className="flex flex-col truncate">
                            <div className="font-bold text-neutral-900 flex items-center gap-1.5 truncate">
                              <span>
                                {evt.event_type === 'goal'
                                  ? '⚽ Goal'
                                  : evt.event_type === 'card'
                                  ? cardType === 'red'
                                    ? '🟥 Red Card'
                                    : '🟨 Yellow Card'
                                  : evt.event_type === 'sub'
                                  ? '🔄 Substitution'
                                  : '🧤 Penalty Save'}
                              </span>
                              {isOwn && (
                                <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase">
                                  OG
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-neutral-500 truncate">
                              {evt.event_type === 'sub' ? (
                                <>
                                  <span className="text-red-600 font-bold">OFF: {getPlayerName(evt.player_id, evt.details_json)}</span> •{' '}
                                  <span className="text-emerald-600 font-bold">ON: {getPlayerName(evt.secondary_player_id, evt.details_json, true)}</span>
                                </>
                              ) : (
                                <>
                                  {getPlayerName(evt.player_id, evt.details_json)}
                                  {evt.secondary_player_id && (
                                    <span className="text-neutral-400 font-normal"> (Assist: {getPlayerName(evt.secondary_player_id, evt.details_json, true)})</span>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="text-neutral-400 hover:text-red-600 p-1.5 rounded-lg transition-colors shrink-0"
                            title="Undo Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STARTING XI & BENCH */}
      {activeTab === 'lineup' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 border border-neutral-100 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider">
              Starting XI & Substitutes Manager
            </h4>

            {/* Home Team Roster */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: homeTeam?.jersey_color || '#16a34a' }} />
                {homeTeam?.name || 'Home Team'}
              </span>
              <div className="flex flex-wrap gap-2">
                {homePlayers.map((p) => {
                  const isStarting = startingPlayerIds.includes(p.id)
                  const lastName = getLastName(p.full_name)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleToggleStartingPlayer(p.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm active:scale-95 ${
                        isStarting
                          ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-600 ring-offset-1'
                          : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200 opacity-70'
                      }`}
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} className="w-5 h-5 rounded-full object-cover border border-white/40 shrink-0" alt={lastName} />
                      ) : (
                        <div className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[9px] shrink-0 ${isStarting ? 'bg-emerald-700 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                          {lastName.charAt(0)}
                        </div>
                      )}
                      <span>{lastName}</span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isStarting ? 'bg-emerald-700 text-emerald-100' : 'bg-neutral-200 text-neutral-600'}`}>
                        {isStarting ? 'Starter' : 'Bench'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Away Team Roster */}
            <div className="space-y-2 pt-3 border-t border-neutral-100">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: awayTeam?.jersey_color || '#2563eb' }} />
                {awayTeam?.name || 'Away Team'}
              </span>
              <div className="flex flex-wrap gap-2">
                {awayPlayers.map((p) => {
                  const isStarting = startingPlayerIds.includes(p.id)
                  const lastName = getLastName(p.full_name)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleToggleStartingPlayer(p.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm active:scale-95 ${
                        isStarting
                          ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-600 ring-offset-1'
                          : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200 opacity-70'
                      }`}
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} className="w-5 h-5 rounded-full object-cover border border-white/40 shrink-0" alt={lastName} />
                      ) : (
                        <div className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[9px] shrink-0 ${isStarting ? 'bg-emerald-700 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                          {lastName.charAt(0)}
                        </div>
                      )}
                      <span>{lastName}</span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isStarting ? 'bg-emerald-700 text-emerald-100' : 'bg-neutral-200 text-neutral-600'}`}>
                        {isStarting ? 'Starter' : 'Bench'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PITCH TIME & CONCEDED GOALS */}
      {activeTab === 'pitchTime' && (
        <div className="bg-white rounded-3xl p-4 border border-neutral-100 shadow-sm space-y-4">
          <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider">
            Player Pitch Minutes & Conceded Goals
          </h4>

          {/* Home Team */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: homeTeam?.jersey_color || '#16a34a' }} />
              {homeTeam?.name || 'Home Team'}
            </span>
            <div className="space-y-1.5">
              {homePlayers.map((p) => {
                const mins = pitchData.minutesPlayed?.[p.id] || 0
                const gc = pitchData.goalsConcededOnPitch?.[p.id] || 0
                return (
                  <div key={p.id} className="p-3 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between text-xs" style={{ borderLeftWidth: 3, borderLeftColor: homeTeam?.jersey_color || '#16a34a' }}>
                    <div className="flex items-center gap-2 truncate">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} className="w-6 h-6 rounded-full object-cover border border-neutral-200 shrink-0" alt={p.full_name} />
                      ) : (
                        <div className="w-6 h-6 rounded-full font-bold flex items-center justify-center bg-neutral-200 text-neutral-700 text-[10px] shrink-0">
                          {(p.full_name || 'P').charAt(0)}
                        </div>
                      )}
                      <span className="font-bold text-neutral-900 truncate">{p.full_name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-neutral-700">{mins} mins</span>
                      <span className="text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded">
                        {gc} GC
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Away Team */}
          <div className="space-y-2 pt-3 border-t border-neutral-100">
            <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: awayTeam?.jersey_color || '#2563eb' }} />
              {awayTeam?.name || 'Away Team'}
            </span>
            <div className="space-y-1.5">
              {awayPlayers.map((p) => {
                const mins = pitchData.minutesPlayed?.[p.id] || 0
                const gc = pitchData.goalsConcededOnPitch?.[p.id] || 0
                return (
                  <div key={p.id} className="p-3 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between text-xs" style={{ borderLeftWidth: 3, borderLeftColor: awayTeam?.jersey_color || '#2563eb' }}>
                    <div className="flex items-center gap-2 truncate">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} className="w-6 h-6 rounded-full object-cover border border-neutral-200 shrink-0" alt={p.full_name} />
                      ) : (
                        <div className="w-6 h-6 rounded-full font-bold flex items-center justify-center bg-neutral-200 text-neutral-700 text-[10px] shrink-0">
                          {(p.full_name || 'P').charAt(0)}
                        </div>
                      )}
                      <span className="font-bold text-neutral-900 truncate">{p.full_name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-neutral-700">{mins} mins</span>
                      <span className="text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded">
                        {gc} GC
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MATCH START SETUP MODAL */}
      {isStartSetupOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-neutral-900">Start Match Configuration</h3>

            <div>
              <label className="text-xs font-bold text-neutral-600 block mb-1.5">Match Structure</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMatchStructure('halves')}
                  className={`p-3 rounded-2xl font-bold text-xs border text-center transition-all ${
                    matchStructure === 'halves'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                  }`}
                >
                  2 Halves
                </button>
                <button
                  type="button"
                  onClick={() => setMatchStructure('continuous')}
                  className={`p-3 rounded-2xl font-bold text-xs border text-center transition-all ${
                    matchStructure === 'continuous'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                  }`}
                >
                  Continuous
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-600 block mb-1">
                {matchStructure === 'halves' ? 'Half Duration (Minutes)' : 'Match Duration (Minutes)'}
              </label>
              <input
                type="number"
                min="1"
                className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-sm outline-none"
                value={halfDuration}
                onChange={(e) => setHalfDuration(parseInt(e.target.value) || 15)}
              />
            </div>

            {matchStructure === 'halves' && (
              <div>
                <label className="text-xs font-bold text-neutral-600 block mb-1">Half-Time Break (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-sm outline-none"
                  value={breakDuration}
                  onChange={(e) => setBreakDuration(parseInt(e.target.value) || 5)}
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsStartSetupOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleStartMatchConfirm}>
                Start Clock
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LOG GOAL MODAL */}
      {goalModal.isOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <h3 className="font-bold text-base text-neutral-900">⚽ Log Goal Event</h3>

            <div>
              <label className="text-xs font-bold text-neutral-600 block mb-1">Scoring Team</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setGoalModal((prev) => ({ ...prev, teamId: homeTeam?.id || '', scorerId: '', assistId: '' }))
                  }
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                    goalModal.teamId === homeTeam?.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                  }`}
                >
                  {homeTeam?.name || 'Home'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGoalModal((prev) => ({ ...prev, teamId: awayTeam?.id || '', scorerId: '', assistId: '' }))
                  }
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                    goalModal.teamId === awayTeam?.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                  }`}
                >
                  {awayTeam?.name || 'Away'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-600 block mb-1">Scorer</label>
              <OptionSelector
                options={(goalModal.teamId === homeTeam?.id ? homePlayers : awayPlayers).map((p) => ({
                  value: p.id,
                  label: p.full_name,
                }))}
                value={goalModal.scorerId}
                onChange={(val) => setGoalModal((prev) => ({ ...prev, scorerId: val }))}
                placeholder="Select Scorer..."
              />
            </div>

            {!goalModal.isOwnGoal && (
              <div>
                <label className="text-xs font-bold text-neutral-600 block mb-1">Assist (Optional)</label>
                <OptionSelector
                  options={(goalModal.teamId === homeTeam?.id ? homePlayers : awayPlayers)
                    .filter((p) => p.id !== goalModal.scorerId)
                    .map((p) => ({ value: p.id, label: p.full_name }))}
                  value={goalModal.assistId}
                  onChange={(val) => setGoalModal((prev) => ({ ...prev, assistId: val }))}
                  placeholder="Select Assist..."
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-neutral-600">Minute:</label>
              <input
                type="number"
                className="w-20 p-2 bg-neutral-50 border rounded-xl font-bold text-xs text-center"
                value={goalModal.minute}
                onChange={(e) => setGoalModal((prev) => ({ ...prev, minute: parseInt(e.target.value) || 0 }))}
              />
              <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 ml-auto cursor-pointer">
                <input
                  type="checkbox"
                  checked={goalModal.isOwnGoal}
                  onChange={(e) => setGoalModal((prev) => ({ ...prev, isOwnGoal: e.target.checked, assistId: e.target.checked ? '' : prev.assistId }))}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                Own Goal (OG)
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setGoalModal((prev) => ({ ...prev, isOpen: false }))}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleLogGoal}
                disabled={isLogging}
              >
                {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Goal'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LOG CARD MODAL */}
      {cardModal.isOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <h3 className="font-bold text-base text-neutral-900">🟨 Log Card Event</h3>

            <div>
              <label className="text-xs font-bold text-neutral-600 block mb-1">Team</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCardModal((prev) => ({ ...prev, teamId: homeTeam?.id || '', playerId: '' }))}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                    cardModal.teamId === homeTeam?.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                  }`}
                >
                  {homeTeam?.name || 'Home'}
                </button>
                <button
                  type="button"
                  onClick={() => setCardModal((prev) => ({ ...prev, teamId: awayTeam?.id || '', playerId: '' }))}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                    cardModal.teamId === awayTeam?.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                  }`}
                >
                  {awayTeam?.name || 'Away'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-600 block mb-1">Player</label>
              <OptionSelector
                options={(cardModal.teamId === homeTeam?.id ? homePlayers : awayPlayers).map((p) => ({
                  value: p.id,
                  label: p.full_name,
                }))}
                value={cardModal.playerId}
                onChange={(val) => setCardModal((prev) => ({ ...prev, playerId: val }))}
                placeholder="Select Player..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCardModal((prev) => ({ ...prev, cardType: 'yellow' }))}
                className={`p-2.5 rounded-xl font-bold text-xs border text-center transition-all ${
                  cardModal.cardType === 'yellow' ? 'bg-amber-500 text-white border-amber-500' : 'bg-neutral-50 text-neutral-700'
                }`}
              >
                🟨 Yellow Card
              </button>
              <button
                type="button"
                onClick={() => setCardModal((prev) => ({ ...prev, cardType: 'red' }))}
                className={`p-2.5 rounded-xl font-bold text-xs border text-center transition-all ${
                  cardModal.cardType === 'red' ? 'bg-red-600 text-white border-red-600' : 'bg-neutral-50 text-neutral-700'
                }`}
              >
                🟥 Red Card
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-neutral-600">Minute:</label>
              <input
                type="number"
                className="w-20 p-2 bg-neutral-50 border rounded-xl font-bold text-xs text-center"
                value={cardModal.minute}
                onChange={(e) => setCardModal((prev) => ({ ...prev, minute: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setCardModal((prev) => ({ ...prev, isOpen: false }))}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white" onClick={handleLogCard} disabled={isLogging}>
                {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Card'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LOG SUB MODAL */}
      {subModal.isOpen && (() => {
        const pitchState = getDynamicPitchState(subModal.teamId)
        return (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3">
              <h3 className="font-bold text-base text-neutral-900">🔄 Log Substitution</h3>

              <div>
                <label className="text-xs font-bold text-neutral-600 block mb-1">Team</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSubModal((prev) => ({ ...prev, teamId: homeTeam?.id || '', subOffId: '', subOnId: '' }))}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                      subModal.teamId === homeTeam?.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                    }`}
                  >
                    {homeTeam?.name || 'Home'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubModal((prev) => ({ ...prev, teamId: awayTeam?.id || '', subOffId: '', subOnId: '' }))}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                      subModal.teamId === awayTeam?.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                    }`}
                  >
                    {awayTeam?.name || 'Away'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 block mb-1">Player OFF (Leaving Pitch)</label>
                <OptionSelector
                  options={pitchState.onPitchPlayers.map((p) => ({ value: p.id, label: p.full_name }))}
                  value={subModal.subOffId}
                  onChange={(val) => setSubModal((prev) => ({ ...prev, subOffId: val }))}
                  placeholder="Select Player OFF..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 block mb-1">Player ON (Entering Pitch)</label>
                <OptionSelector
                  options={pitchState.onBenchPlayers.map((p) => ({ value: p.id, label: p.full_name }))}
                  value={subModal.subOnId}
                  onChange={(val) => setSubModal((prev) => ({ ...prev, subOnId: val }))}
                  placeholder="Select Player ON..."
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-neutral-600">Minute:</label>
                <input
                  type="number"
                  className="w-20 p-2 bg-neutral-50 border rounded-xl font-bold text-xs text-center"
                  value={subModal.minute}
                  onChange={(e) => setSubModal((prev) => ({ ...prev, minute: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setSubModal((prev) => ({ ...prev, isOpen: false }))}>
                  Cancel
                </Button>
                <Button className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white" onClick={handleLogSub} disabled={isLogging}>
                  {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Sub'}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* LOG PENALTY SAVE MODAL */}
      {penModal.isOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <h3 className="font-bold text-base text-neutral-900">🧤 Log Penalty Save</h3>

            <div>
              <label className="text-xs font-bold text-neutral-600 block mb-1">Player</label>
              <OptionSelector
                options={allPlayers.map((p) => ({
                  value: p.id,
                  label: p.full_name,
                  avatarUrl: p.avatar_url,
                }))}
                value={penModal.playerId}
                onChange={(val) => setPenModal((prev) => ({ ...prev, playerId: val }))}
                placeholder="Select Goalkeeper / Player..."
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-neutral-600">Minute:</label>
              <input
                type="number"
                className="w-20 p-2 bg-neutral-50 border rounded-xl font-bold text-xs text-center"
                value={penModal.minute}
                onChange={(e) => setPenModal((prev) => ({ ...prev, minute: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setPenModal((prev) => ({ ...prev, isOpen: false }))}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold"
                onClick={handleLogPenaltySave}
                disabled={isLogging}
              >
                {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Penalty Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SHAREABLE MATCH CARD MODAL */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-md flex items-center justify-center p-4 z-[80] animate-in fade-in duration-200">
          <div className="bg-neutral-900 rounded-3xl max-w-sm w-full max-h-[88vh] shadow-2xl flex flex-col my-auto border border-neutral-800 overflow-hidden">
            {/* Fixed Header */}
            <div className="flex justify-between items-center px-5 py-4 shrink-0 border-b border-neutral-800">
              <h3 className="font-bold text-base text-white">Share Match Card</h3>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Card Container */}
            <div className="p-4 overflow-y-auto flex-1 min-h-0 bg-neutral-900">
              {/* DOM Element to Capture with html-to-image */}
              <div
                ref={shareCardRef}
                className="bg-neutral-950 text-white rounded-3xl p-5 shadow-xl border border-neutral-800 space-y-4 relative"
              >
                {/* Match Card Top Badge */}
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    Match Summary • #{match.match_number}
                  </span>
                  <h3 className="text-base font-black text-white pt-1">{match.stage_name || 'Group Stage'}</h3>
                </div>

                {/* Score Display */}
                <div className="flex items-center justify-around py-3 bg-neutral-900/90 rounded-2xl border border-neutral-800">
                  <div className="text-center">
                    <div
                      className="w-11 h-11 rounded-2xl mx-auto mb-1 flex items-center justify-center font-black text-white text-sm shadow border"
                      style={{ backgroundColor: homeTeam?.jersey_color || '#16a34a', borderColor: 'rgba(255,255,255,0.2)' }}
                    >
                      {(homeTeam?.name || 'H').charAt(0)}
                    </div>
                    <span className="text-xs font-bold text-neutral-200 block truncate max-w-[90px]">{homeTeam?.name}</span>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-black tracking-tight text-white">
                      {dynamicHomeScore} - {dynamicAwayScore}
                    </div>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400">FULL-TIME</span>
                  </div>

                  <div className="text-center">
                    <div
                      className="w-11 h-11 rounded-2xl mx-auto mb-1 flex items-center justify-center font-black text-white text-sm shadow border"
                      style={{ backgroundColor: awayTeam?.jersey_color || '#2563eb', borderColor: 'rgba(255,255,255,0.2)' }}
                    >
                      {(awayTeam?.name || 'A').charAt(0)}
                    </div>
                    <span className="text-xs font-bold text-neutral-200 block truncate max-w-[90px]">{awayTeam?.name}</span>
                  </div>
                </div>

                {/* Match MVP Badge */}
                {selectedMvpPlayer && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-2.5 text-center space-y-0.5">
                    <div className="flex items-center justify-center gap-1 text-amber-400 font-black text-xs uppercase tracking-wider">
                      <Crown className="w-3.5 h-3.5" /> Match MVP
                    </div>
                    <div className="text-sm font-black text-white">{selectedMvpPlayer.full_name}</div>
                  </div>
                )}

                {/* Scorers Summary */}
                <div className="space-y-1.5 pt-1 border-t border-neutral-800">
                  <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block text-center">
                    Goal Scorers
                  </span>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-[11px]">
                    <div className="space-y-1 text-left text-neutral-300 font-semibold">
                      {homeScorers.length > 0 ? (
                        homeScorers.map((s) => (
                          <div key={s.id}>
                            {s.lastName} {s.minute}&apos; {s.isOwnGoal && '(OG)'}
                          </div>
                        ))
                      ) : (
                        <span className="text-neutral-500 text-[10px] italic">No goals</span>
                      )}
                    </div>
                    <div className="text-center text-neutral-500">⚽</div>
                    <div className="space-y-1 text-right text-neutral-300 font-semibold">
                      {awayScorers.length > 0 ? (
                        awayScorers.map((s) => (
                          <div key={s.id}>
                            {s.lastName} {s.minute}&apos; {s.isOwnGoal && '(OG)'}
                          </div>
                        ))
                      ) : (
                        <span className="text-neutral-500 text-[10px] italic">No goals</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed Action Buttons */}
            <div className="p-4 shrink-0 border-t border-neutral-800 flex gap-3 bg-neutral-900">
              <Button
                onClick={handleDownloadMatchCardImage}
                disabled={isGeneratingShareImage}
                variant="outline"
                className="flex-1 h-11 rounded-xl bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Save
              </Button>
              <Button
                onClick={handleShareMatchCardImage}
                disabled={isGeneratingShareImage}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11 flex items-center justify-center gap-1.5 text-xs"
              >
                {isGeneratingShareImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Share2 className="w-4 h-4" /> Share
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
