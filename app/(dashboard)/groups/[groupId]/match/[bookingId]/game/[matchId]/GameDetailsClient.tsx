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
  updateMatchStatusAction
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
  const [activeTab, setActiveTab] = useState<'events' | 'pitchTime'>('events')
  const [durationInput, setDurationInput] = useState<number>(match.duration_minutes || 30)
  const [isUpdatingDuration, setIsUpdatingDuration] = useState(false)

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

  // Calculate Pitch Time & Goals Conceded On Pitch
  const homePids = homePlayers.map((p) => p.id)
  const awayPids = awayPlayers.map((p) => p.id)
  const startingPids = [...homePids.slice(0, 7), ...awayPids.slice(0, 7)] // Defaults to initial roster

  const pitchData = calculateMatchPlayerPitchTime(
    events,
    durationInput || 30,
    homePids,
    awayPids,
    startingPids
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

  const getPlayerName = (pid?: string) => {
    if (!pid) return ''
    const p = [...homePlayers, ...awayPlayers].find((x) => x.id === pid)
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
            <div className="text-3xl font-black tracking-tight text-white">
              {match.home_score ?? 0} : {match.away_score ?? 0}
            </div>
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
      <div className="flex bg-neutral-100 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'events' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          }`}
        >
          ⚽ Live Events & Feed ({events.length})
        </button>
        <button
          onClick={() => setActiveTab('pitchTime')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'pitchTime' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          }`}
        >
          ⏱️ Pitch Time & Goals Conceded
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
                              <span>{getPlayerName(ev.player_id)}</span>
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
                              <span>{getPlayerName(ev.player_id)}</span>
                            </>
                          )}
                          {ev.event_type === 'sub' && (
                            <>
                              <span>🔁</span>
                              <span className="text-rose-600">OFF: {getPlayerName(ev.player_id)}</span>
                              <span className="text-neutral-400">→</span>
                              <span className="text-emerald-600">ON: {getPlayerName(ev.secondary_player_id)}</span>
                            </>
                          )}
                          {ev.event_type === 'penalty_save' && (
                            <>
                              <span>🧤</span>
                              <span>Penalty Saved: {getPlayerName(ev.player_id)}</span>
                            </>
                          )}
                        </div>
                        {ev.event_type === 'goal' && ev.secondary_player_id && (
                          <div className="text-[10px] text-neutral-500 font-medium mt-0.5">
                            Assist: {getPlayerName(ev.secondary_player_id)}
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

      {/* TAB 2: PITCH TIME & GOALS CONCEDED */}
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
                <select
                  value={goalModal.teamId}
                  onChange={(e) => setGoalModal({ ...goalModal, teamId: e.target.value })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold outline-none"
                >
                  <option value={homeTeam?.id}>{homeTeam?.name || 'Home Team'}</option>
                  <option value={awayTeam?.id}>{awayTeam?.name || 'Away Team'}</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-neutral-600 block mb-1">Scorer</label>
                <select
                  value={goalModal.scorerId}
                  onChange={(e) => setGoalModal({ ...goalModal, scorerId: e.target.value })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold outline-none"
                >
                  <option value="">Select Scorer...</option>
                  {[...homePlayers, ...awayPlayers].map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.preferred_position || 'P'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-neutral-600 block mb-1">Assist (Optional)</label>
                <select
                  value={goalModal.assistId}
                  onChange={(e) => setGoalModal({ ...goalModal, assistId: e.target.value })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-medium outline-none"
                >
                  <option value="">No Assist</option>
                  {[...homePlayers, ...awayPlayers].map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

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
                <label className="font-bold text-neutral-600 block mb-1">Player</label>
                <select
                  value={cardModal.playerId}
                  onChange={(e) => setCardModal({ ...cardModal, playerId: e.target.value })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold outline-none"
                >
                  <option value="">Select Player...</option>
                  {[...homePlayers, ...awayPlayers].map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-neutral-600 block mb-1">Card Type</label>
                <select
                  value={cardModal.cardType}
                  onChange={(e) => setCardModal({ ...cardModal, cardType: e.target.value as any })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold outline-none"
                >
                  <option value="yellow">🟨 Yellow Card (-1 pt)</option>
                  <option value="red">🟥 Red Card (-3 pts)</option>
                </select>
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
      {subModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-neutral-900">🔁 Log Rolling Substitution</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-rose-600 block mb-1">Player Subbed OFF</label>
                <select
                  value={subModal.subOffId}
                  onChange={(e) => setSubModal({ ...subModal, subOffId: e.target.value })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold outline-none"
                >
                  <option value="">Select Sub Off...</option>
                  {[...homePlayers, ...awayPlayers].map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-emerald-600 block mb-1">Player Subbed ON</label>
                <select
                  value={subModal.subOnId}
                  onChange={(e) => setSubModal({ ...subModal, subOnId: e.target.value })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold outline-none"
                >
                  <option value="">Select Sub On...</option>
                  {[...homePlayers, ...awayPlayers].map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
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
      )}

      {/* MODAL: LOG PENALTY SAVE */}
      {penModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-neutral-900">🧤 Log Penalty Save</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-600 block mb-1">Goalkeeper</label>
                <select
                  value={penModal.playerId}
                  onChange={(e) => setPenModal({ ...penModal, playerId: e.target.value })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold outline-none"
                >
                  <option value="">Select Goalkeeper...</option>
                  {[...homePlayers, ...awayPlayers]
                    .filter((p) => p.preferred_position === 'GK' || true)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.preferred_position || 'P'})
                      </option>
                    ))}
                </select>
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
