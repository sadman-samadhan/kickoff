/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Clock, Plus, Trash2, Shield, Activity, Users,
  CheckCircle, Loader2, ArrowRightLeft, Flag, Award, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  logMatchEventAction,
  deleteMatchEventAction,
  updateMatchDurationAction,
  updateMatchStatusAction,
  updateMatchScoreAction,
  updateStartingLineupAction
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
}

function OptionSelector<T extends string>({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
}: {
  options: OptionItem<T>[]
  value: T
  onChange: (val: T) => void
  placeholder?: string
}) {
  if (options.length === 0) {
    return <p className="text-xs text-neutral-400 italic py-1">No options available</p>
  }

  // Render Pill Cards if options < 5
  if (options.length < 5) {
    return (
      <div className="flex flex-wrap gap-2 py-1">
        {options.map((opt) => {
          const isSelected = value === opt.value
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
              {opt.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              <span>{opt.label}</span>
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

  // Fallback to Styled Dropdown for options >= 5
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label} {opt.sublabel ? `(${opt.sublabel})` : ''}
        </option>
      ))}
    </select>
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
  const [durationInput, setDurationInput] = useState<number>(match.duration_minutes || 30)
  const [isUpdatingDuration, setIsUpdatingDuration] = useState(false)
  const [homeScoreInput, setHomeScoreInput] = useState<number>(match.home_score ?? 0)
  const [awayScoreInput, setAwayScoreInput] = useState<number>(match.away_score ?? 0)

  const handleSaveScore = async () => {
    if (!isAdmin) return
    try {
      await updateMatchScoreAction(matchId, bookingId, groupId, homeScoreInput, awayScoreInput)
    } catch (e: any) {
      alert(e.message || 'Failed to update score')
    }
  }

  // Event Modal States
  const [goalModal, setGoalModal] = useState<{ isOpen: boolean; teamId: string; scorerId: string; assistId: string; minute: number; isOwnGoal: boolean }>({
    isOpen: false, teamId: '', scorerId: '', assistId: '', minute: 0, isOwnGoal: false
  })
  const [cardModal, setCardModal] = useState<{ isOpen: boolean; playerId: string; cardType: 'yellow' | 'red'; minute: number }>({
    isOpen: false, playerId: '', cardType: 'yellow', minute: 0
  })
  const [subModal, setSubModal] = useState<{ isOpen: boolean; subOffId: string; subOnId: string; minute: number }>({
    isOpen: false, subOffId: '', subOnId: '', minute: 0
  })
  const [penModal, setPenModal] = useState<{ isOpen: boolean; playerId: string; minute: number }>({
    isOpen: false, playerId: '', minute: 0
  })

  const [isLogging, setIsLogging] = useState(false)

  const allPlayers = [...homePlayers, ...awayPlayers]
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

  // Calculate Dynamic On-Pitch vs On-Bench State for Substitutions
  const getDynamicPitchState = () => {
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

    return {
      onPitchPlayers: allPlayers.filter((p) => onPitch.has(p.id)),
      onBenchPlayers: allPlayers.filter((p) => onBench.has(p.id)),
    }
  }

  // Calculate Pitch Time & Goals Conceded On Pitch
  const homePids = homePlayers.map((p) => p.id)
  const awayPids = awayPlayers.map((p) => p.id)

  const pitchData = calculateMatchPlayerPitchTime(
    events,
    durationInput || 30,
    homePids,
    awayPids,
    startingPlayerIds
  )

  const handleUpdateDuration = async () => {
    if (!isAdmin) return
    setIsUpdatingDuration(true)
    try {
      await updateMatchDurationAction(matchId, bookingId, groupId, durationInput)
    } catch (e: any) {
      alert(e.message || 'Failed to update match duration')
    } finally {
      setIsUpdatingDuration(false)
    }
  }

  const handleStatusToggle = async (newStatus: 'scheduled' | 'ongoing' | 'completed') => {
    if (!isAdmin) return
    try {
      await updateMatchStatusAction(matchId, bookingId, groupId, newStatus)
    } catch (e: any) {
      alert(e.message || 'Failed to update match status')
    }
  }

  const handleLogGoal = async () => {
    if (!goalModal.scorerId || !goalModal.teamId) return
    setIsLogging(true)
    try {
      await logMatchEventAction(matchId, bookingId, groupId, {
        event_type: 'goal',
        player_id: goalModal.scorerId,
        secondary_player_id: goalModal.assistId || null,
        team_id: goalModal.teamId,
        minute: goalModal.minute || 0,
        details_json: { is_own_goal: goalModal.isOwnGoal },
      })
      setGoalModal({ isOpen: false, teamId: '', scorerId: '', assistId: '', minute: 0, isOwnGoal: false })
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
        minute: cardModal.minute || 0,
        details_json: { card_type: cardModal.cardType },
      })
      setCardModal({ isOpen: false, playerId: '', cardType: 'yellow', minute: 0 })
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
        minute: subModal.minute || 0,
      })
      setSubModal({ isOpen: false, subOffId: '', subOnId: '', minute: 0 })
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
        minute: penModal.minute || 0,
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

  const getPlayerName = (pid?: string | null, detailsJson?: any, isSecondary = false) => {
    const targetId = pid || (isSecondary ? detailsJson?.guest_secondary_player_id : detailsJson?.guest_player_id)
    if (!targetId) return 'Player'
    const p = [...homePlayers, ...awayPlayers].find((x) => x.id === targetId)
    return p ? p.full_name : 'Player'
  }

  return (
    <div className="flex flex-col gap-5 p-4 max-w-xl mx-auto pb-24 min-h-screen">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link href={`/groups/${groupId}/match/${bookingId}`}>
          <Button variant="ghost" size="sm" className="rounded-xl text-neutral-600 font-bold text-xs p-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Schedule
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200 px-2 py-1 rounded-xl shadow-sm">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <input
                type="number"
                value={durationInput}
                onChange={(e) => setDurationInput(parseInt(e.target.value) || 30)}
                onBlur={handleUpdateDuration}
                className="w-10 text-center text-xs font-black outline-none bg-transparent"
                title="Match duration in minutes (Default: 30)"
              />
              <span className="text-[10px] text-neutral-400 font-bold">m</span>
            </div>
          )}

          <span
            className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
              match.status === 'completed'
                ? 'bg-neutral-200 text-neutral-700'
                : match.status === 'ongoing'
                ? 'bg-blue-100 text-blue-700 animate-pulse'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {match.status}
          </span>
        </div>
      </div>

      {/* Scoreboard Card */}
      <div className="bg-neutral-900 text-white rounded-3xl p-5 shadow-xl border border-neutral-800 relative overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Match #{match.match_number} {match.stage_name ? `• ${match.stage_name}` : ''}
          </span>
          <span className="text-[10px] text-neutral-400 font-bold">Duration: {durationInput || 30} mins</span>
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
            {isAdmin ? (
              <div className="flex items-center gap-1 justify-center">
                <input
                  type="number"
                  min="0"
                  value={homeScoreInput}
                  onChange={(e) => setHomeScoreInput(parseInt(e.target.value) || 0)}
                  onBlur={handleSaveScore}
                  className="w-11 h-9 text-center text-xl font-black bg-neutral-800 text-white rounded-xl border border-neutral-700 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-lg font-bold text-neutral-400">:</span>
                <input
                  type="number"
                  min="0"
                  value={awayScoreInput}
                  onChange={(e) => setAwayScoreInput(parseInt(e.target.value) || 0)}
                  onBlur={handleSaveScore}
                  className="w-11 h-9 text-center text-xl font-black bg-neutral-800 text-white rounded-xl border border-neutral-700 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ) : (
              <div className="text-3xl font-black tracking-tight text-white">
                {match.home_score ?? 0} : {match.away_score ?? 0}
              </div>
            )}
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-400 mt-1 block">
              {match.status === 'completed' ? 'Final Score' : match.status === 'ongoing' ? 'LIVE' : 'VS'}
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

        {/* Status Toggle Controls for Admin */}
        {isAdmin && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-neutral-800/80">
            <Button
              size="sm"
              variant={match.status === 'ongoing' ? 'default' : 'outline'}
              onClick={() => handleStatusToggle('ongoing')}
              className="flex-1 h-8 text-[10px] rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white border-none"
            >
              Set Ongoing
            </Button>
            <Button
              size="sm"
              variant={match.status === 'completed' ? 'default' : 'outline'}
              onClick={() => handleStatusToggle('completed')}
              className="flex-1 h-8 text-[10px] rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none"
            >
              Set Completed
            </Button>
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
          {/* Quick Action Event Logger Buttons for Admin */}
          {isAdmin && (
            <div className="bg-white rounded-3xl p-4 border border-neutral-100 shadow-sm space-y-3">
              <span className="text-xs font-black text-neutral-900 uppercase tracking-wider block">
                Log Match Event
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  size="sm"
                  onClick={() => setGoalModal({ isOpen: true, teamId: homeTeam?.id || '', scorerId: '', assistId: '', minute: 0, isOwnGoal: false })}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-10"
                >
                  ⚽ + Goal
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCardModal({ isOpen: true, playerId: '', cardType: 'yellow', minute: 0 })}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl h-10"
                >
                  🟨 + Card
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSubModal({ isOpen: true, subOffId: '', subOnId: '', minute: 0 })}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl h-10"
                >
                  🔁 + Sub
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPenModal({ isOpen: true, playerId: '', minute: 0 })}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl h-10"
                >
                  🧤 + Pen Save
                </Button>
              </div>
            </div>
          )}

          {/* Timeline Event Feed */}
          <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Match Timeline</h4>
            <div className="space-y-2">
              {events
                .sort((a, b) => a.minute - b.minute)
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 flex justify-between items-center text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-neutral-200 font-black text-neutral-800 flex items-center justify-center text-xs shrink-0">
                        {ev.minute}&apos;
                      </span>
                      <div>
                        <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                          {ev.event_type === 'goal' && (
                            <>
                              <span>⚽</span>
                              <span>{getPlayerName(ev.player_id, ev.details_json)}</span>
                              {ev.details_json?.is_own_goal && (
                                <span className="text-[9px] bg-rose-100 text-rose-700 font-extrabold px-1.5 py-0.2 rounded">
                                  OG
                                </span>
                              )}
                            </>
                          )}
                          {ev.event_type === 'card' && (
                            <>
                              <span>{ev.details_json?.card_type === 'red' ? '🟥' : '🟨'}</span>
                              <span>{getPlayerName(ev.player_id, ev.details_json)}</span>
                            </>
                          )}
                          {ev.event_type === 'sub' && (
                            <>
                              <span>🔁</span>
                              <span className="text-rose-600">OFF: {getPlayerName(ev.player_id, ev.details_json)}</span>
                              <span className="text-neutral-400">→</span>
                              <span className="text-emerald-600">ON: {getPlayerName(ev.secondary_player_id, ev.details_json, true)}</span>
                            </>
                          )}
                          {ev.event_type === 'penalty_save' && (
                            <>
                              <span>🧤</span>
                              <span>Penalty Saved: {getPlayerName(ev.player_id, ev.details_json)}</span>
                            </>
                          )}
                        </div>
                        {ev.event_type === 'goal' && (ev.secondary_player_id || ev.details_json?.guest_secondary_player_id) && (
                          <div className="text-[10px] text-neutral-500 font-medium mt-0.5">
                            Assist: {getPlayerName(ev.secondary_player_id, ev.details_json, true)}
                          </div>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Delete Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              {events.length === 0 && (
                <p className="text-xs text-neutral-400 italic text-center py-6">No match events logged yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LINEUPS & STARTERS */}
      {activeTab === 'lineup' && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" /> Matchday Starting XI & Bench
            </h4>
            <p className="text-[10px] text-neutral-400 font-medium">
              Tap any player pill to toggle between <strong>Started (On Pitch)</strong> and <strong>Benched (Sub)</strong>. Benched players with 0 minutes logged automatically count as DNP.
            </p>

            {/* Home Team Section */}
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold text-neutral-600 flex items-center gap-2 uppercase">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: homeTeam?.jersey_color || '#16a34a' }} />
                <span>{homeTeam?.name || 'Home Team'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {homePlayers.map((p) => {
                  const isStarter = startingPlayerIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => handleToggleStartingPlayer(p.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm active:scale-95 ${
                        isStarter
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-rose-50 text-rose-700 border-rose-200 opacity-75'
                      }`}
                    >
                      <span>{p.full_name}</span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${isStarter ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                        {isStarter ? 'Starter' : 'Bench'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Away Team Section */}
            <div className="space-y-2 pt-4 border-t border-neutral-100">
              <div className="text-xs font-bold text-neutral-600 flex items-center gap-2 uppercase">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: awayTeam?.jersey_color || '#2563eb' }} />
                <span>{awayTeam?.name || 'Away Team'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {awayPlayers.map((p) => {
                  const isStarter = startingPlayerIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => handleToggleStartingPlayer(p.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm active:scale-95 ${
                        isStarter
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-rose-50 text-rose-700 border-rose-200 opacity-75'
                      }`}
                    >
                      <span>{p.full_name}</span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${isStarter ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                        {isStarter ? 'Starter' : 'Bench'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PITCH TIME & GOALS CONCEDED */}
      {activeTab === 'pitchTime' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" /> On-Pitch Minutes & Conceded Goals
            </h4>
            <p className="text-[10px] text-neutral-400 font-medium">
              Automatically calculated from match rolling substitutions and goal event timelines.
            </p>

            <div className="space-y-2">
              {[...homePlayers, ...awayPlayers].map((p) => {
                const mins = pitchData.minutesPlayed[p.id] ?? 0
                const conceded = pitchData.goalsConcededOnPitch[p.id] ?? 0
                const isDnp = pitchData.isDnp[p.id]

                return (
                  <div
                    key={p.id}
                    className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 flex justify-between items-center text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {(p.full_name || 'P').charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-neutral-800 flex items-center gap-1.5">
                          <span>{p.full_name}</span>
                          {isDnp ? (
                            <span className="text-[8px] bg-rose-100 text-rose-700 font-black px-1.5 py-0.2 rounded uppercase">
                              DNP
                            </span>
                          ) : (
                            <span className="text-[8px] bg-emerald-100 text-emerald-700 font-black px-1.5 py-0.2 rounded uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-400">{p.preferred_position || 'Player'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-xs font-black text-neutral-900">{mins} mins</span>
                        <span className="text-[9px] text-neutral-400 block font-bold">Pitch Time</span>
                      </div>
                      <div>
                        <span className="text-xs font-black text-rose-600">-{conceded}</span>
                        <span className="text-[9px] text-neutral-400 block font-bold">Conceded</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOG GOAL */}
      {goalModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2">⚽ Log Goal Event</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-600 block mb-1">Scoring Team</label>
                <OptionSelector
                  options={[
                    { value: homeTeam?.id || 'home', label: homeTeam?.name || 'Home Team', color: homeTeam?.jersey_color || '#16a34a' },
                    { value: awayTeam?.id || 'away', label: awayTeam?.name || 'Away Team', color: awayTeam?.jersey_color || '#2563eb' }
                  ]}
                  value={goalModal.teamId}
                  onChange={(val) => {
                    setGoalModal((prev) => ({
                      ...prev,
                      teamId: val,
                      scorerId: '',
                      assistId: ''
                    }))
                  }}
                  placeholder="Select Team..."
                />
              </div>

              {(() => {
                const targetPlayers = goalModal.isOwnGoal
                  ? (goalModal.teamId === homeTeam?.id ? awayPlayers : goalModal.teamId === awayTeam?.id ? homePlayers : [...homePlayers, ...awayPlayers])
                  : (goalModal.teamId === homeTeam?.id ? homePlayers : goalModal.teamId === awayTeam?.id ? awayPlayers : [...homePlayers, ...awayPlayers])

                return (
                  <>
                    <div>
                      <label className="font-bold text-neutral-600 block mb-1">
                        {goalModal.isOwnGoal ? 'Scorer (Opposing Player - OG)' : 'Scorer'}
                      </label>
                      <OptionSelector
                        options={targetPlayers.map((p) => ({
                          value: p.id,
                          label: p.full_name,
                          sublabel: p.preferred_position || 'P'
                        }))}
                        value={goalModal.scorerId}
                        onChange={(val) => setGoalModal({ ...goalModal, scorerId: val })}
                        placeholder="Select Scorer..."
                      />
                    </div>

                    {!goalModal.isOwnGoal && (
                      <div>
                        <label className="font-bold text-neutral-600 block mb-1">Assist (Optional)</label>
                        <OptionSelector
                          options={targetPlayers
                            .filter((p) => p.id !== goalModal.scorerId)
                            .map((p) => ({
                              value: p.id,
                              label: p.full_name
                            }))}
                          value={goalModal.assistId}
                          onChange={(val) => setGoalModal({ ...goalModal, assistId: val })}
                          placeholder="No Assist"
                        />
                      </div>
                    )}
                  </>
                )
              })()}

              <div className="flex items-center justify-between">
                <label className="font-bold text-neutral-600">Minute</label>
                <input
                  type="number"
                  value={goalModal.minute}
                  onChange={(e) => setGoalModal({ ...goalModal, minute: parseInt(e.target.value) || 0 })}
                  className="w-20 p-2 text-center bg-neutral-50 border border-neutral-200 rounded-xl font-bold"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-600">
                <input
                  type="checkbox"
                  checked={goalModal.isOwnGoal}
                  onChange={(e) => setGoalModal({ ...goalModal, isOwnGoal: e.target.checked })}
                  className="w-4 h-4 rounded text-rose-600"
                />
                Own Goal (OG)
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl text-xs"
                onClick={() => setGoalModal({ ...goalModal, isOpen: false })}
              >
                Cancel
              </Button>
              <Button
                disabled={isLogging}
                onClick={handleLogGoal}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
              >
                {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Goal'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOG CARD */}
      {cardModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-neutral-900">🟨 Log Card Event</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-600 block mb-1">Card Type</label>
                <OptionSelector
                  options={[
                    { value: 'yellow', label: '🟨 Yellow Card (-1 pt)' },
                    { value: 'red', label: '🟥 Red Card (-3 pts)' }
                  ]}
                  value={cardModal.cardType}
                  onChange={(val) => setCardModal({ ...cardModal, cardType: val as any })}
                  placeholder="Select Card Type..."
                />
              </div>

              <div>
                <label className="font-bold text-neutral-600 block mb-1">Player</label>
                <OptionSelector
                  options={[...homePlayers, ...awayPlayers].map((p) => ({
                    value: p.id,
                    label: p.full_name,
                    sublabel: p.preferred_position || 'P'
                  }))}
                  value={cardModal.playerId}
                  onChange={(val) => setCardModal({ ...cardModal, playerId: val })}
                  placeholder="Select Player..."
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="font-bold text-neutral-600">Minute</label>
                <input
                  type="number"
                  value={cardModal.minute}
                  onChange={(e) => setCardModal({ ...cardModal, minute: parseInt(e.target.value) || 0 })}
                  className="w-20 p-2 text-center bg-neutral-50 border border-neutral-200 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl text-xs"
                onClick={() => setCardModal({ ...cardModal, isOpen: false })}
              >
                Cancel
              </Button>
              <Button
                disabled={isLogging}
                onClick={handleLogCard}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs"
              >
                {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Card'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOG ROLLING SUB */}
      {subModal.isOpen && (() => {
        const { onPitchPlayers, onBenchPlayers } = getDynamicPitchState()
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <h3 className="font-bold text-base text-neutral-900">🔁 Log Rolling Substitution</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-rose-600 block mb-1">Player Subbed OFF (Currently On Pitch)</label>
                  <OptionSelector
                    options={onPitchPlayers.map((p) => ({
                      value: p.id,
                      label: p.full_name,
                      sublabel: 'On Pitch'
                    }))}
                    value={subModal.subOffId}
                    onChange={(val) => setSubModal({ ...subModal, subOffId: val })}
                    placeholder="Select Player On Pitch..."
                  />
                </div>

                <div>
                  <label className="font-bold text-emerald-600 block mb-1">Player Subbed ON (Currently On Bench)</label>
                  <OptionSelector
                    options={onBenchPlayers.map((p) => ({
                      value: p.id,
                      label: p.full_name,
                      sublabel: 'Bench'
                    }))}
                    value={subModal.subOnId}
                    onChange={(val) => setSubModal({ ...subModal, subOnId: val })}
                    placeholder="Select Player On Bench..."
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="font-bold text-neutral-600">Minute</label>
                  <input
                    type="number"
                    value={subModal.minute}
                    onChange={(e) => setSubModal({ ...subModal, minute: parseInt(e.target.value) || 0 })}
                    className="w-20 p-2 text-center bg-neutral-50 border border-neutral-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl text-xs"
                  onClick={() => setSubModal({ ...subModal, isOpen: false })}
                >
                  Cancel
                </Button>
                <Button
                  disabled={isLogging}
                  onClick={handleLogSub}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs"
                >
                  {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Sub'}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAL: LOG PENALTY SAVE */}
      {penModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-neutral-900">🧤 Log Penalty Save</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-600 block mb-1">Goalkeeper</label>
                <OptionSelector
                  options={[...homePlayers, ...awayPlayers]
                    .filter((p) => p.preferred_position === 'GK' || true)
                    .map((p) => ({
                      value: p.id,
                      label: p.full_name,
                      sublabel: p.preferred_position || 'P'
                    }))}
                  value={penModal.playerId}
                  onChange={(val) => setPenModal({ ...penModal, playerId: val })}
                  placeholder="Select Goalkeeper..."
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="font-bold text-neutral-600">Minute</label>
                <input
                  type="number"
                  value={penModal.minute}
                  onChange={(e) => setPenModal({ ...penModal, minute: parseInt(e.target.value) || 0 })}
                  className="w-20 p-2 text-center bg-neutral-50 border border-neutral-200 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl text-xs"
                onClick={() => setPenModal({ ...penModal, isOpen: false })}
              >
                Cancel
              </Button>
              <Button
                disabled={isLogging}
                onClick={handleLogPenaltySave}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs"
              >
                {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Pen Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
