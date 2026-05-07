"use client"

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { MapPin, Clock, Calendar, CheckCircle, XCircle, Users, Shield, Map as MapIcon, Plus, ChevronRight, X, Loader2, Trophy, Goal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rsvpAction } from '../../actions'
import { saveTeamsAction, generateScheduleAction, updateMatchScoreAction } from './actions'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function MatchClient({
  booking,
  rsvps,
  teams,
  matchSchedule,
  goalEvents,
  currentUser,
  groupId
}: any) {
  const router = useRouter()
  
  // Players parsing
  const inPlayers = rsvps.filter((r: any) => r.status === 'in')
  const waitlistPlayers = rsvps.filter((r: any) => r.status === 'waitlist').sort((a: any, b: any) => (a.waitlist_position || 0) - (b.waitlist_position || 0))
  
  const sortOrder: Record<string, number> = { 'GK': 1, 'DEF': 2, 'MID': 3, 'ATT': 4 }
  const sortedInPlayers = [...inPlayers].sort((a: any, b: any) => {
    const posA = a.profiles.preferred_position || 'ATT'
    const posB = b.profiles.preferred_position || 'ATT'
    return (sortOrder[posA] || 5) - (sortOrder[posB] || 5)
  })

  // RSVP state
  const myRsvpObj = rsvps.find((r: any) => r.player_id === currentUser.id)
  const myRsvp = myRsvpObj?.status || 'none'
  const [isConfirmOutOpen, setIsConfirmOutOpen] = useState(false)
  const [isRsvpLoading, setIsRsvpLoading] = useState(false)

  // Teams Form State
  const [isAddingTeams, setIsAddingTeams] = useState(false)
  const [teamForm, setTeamForm] = useState([{ name: '', jerseyColor: '#ffffff', captainId: '' }, { name: '', jerseyColor: '#000000', captainId: '' }])
  const [isTeamsLoading, setIsTeamsLoading] = useState(false)

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
      await saveTeamsAction(booking.id, groupId, teamForm)
      setIsAddingTeams(false)
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
      await fetch(`/api/matches/${expandedMatchId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: goalForm.teamId,
          scorer_id: goalForm.scorerId,
          assist_id: goalForm.assistId || null,
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

  const handleDeleteGoal = async (goalId: string, matchId: string) => {
    if (!confirm('Delete goal?')) return
    try {
      await fetch(`/api/matches/${matchId}/goals/${goalId}`, { method: 'DELETE' })
      router.refresh()
    } catch (e) {
      console.error(e)
    }
  }

  const getTeamName = (teamId: string) => teams.find((t: any) => t.id === teamId)?.name || 'Team'

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 max-w-xl mx-auto min-h-screen pb-24">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-2">
        <Link href={`/groups/${groupId}`} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-neutral-200 text-neutral-500">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </Link>
        <h1 className="text-xl font-bold text-neutral-900 truncate">{booking.groups.name} Match</h1>
      </div>

      {/* 1. MATCH INFO CARD */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2.5 py-1 rounded-md">
            <Calendar className="w-4 h-4" />
            {format(parseISO(booking.match_date), 'MMM d, yyyy')}
          </div>
          <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
            booking.status === 'upcoming' ? 'bg-amber-100 text-amber-700' :
            booking.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
            'bg-neutral-100 text-neutral-700'
          }`}>
            {booking.status}
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
            <a href={booking.google_maps_url} target="_blank" rel="noopener noreferrer" className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 p-2 rounded-xl transition-colors">
              <MapIcon className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>

      {/* 3. RSVP WIDGET */}
      {booking.status === 'upcoming' && (
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={() => handleRsvp('in')}
            disabled={isRsvpLoading}
            className={`h-14 rounded-2xl text-base shadow-sm transition-all ${myRsvp === 'in' ? 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-600 ring-offset-2' : 'bg-white text-green-700 border-2 border-green-100 hover:bg-green-50'}`}
          >
            <CheckCircle className={`w-5 h-5 mr-2 ${myRsvp === 'in' ? 'text-white' : 'text-green-600'}`} />
            I'm In
          </Button>
          <Button 
            onClick={() => handleRsvp('out')}
            disabled={isRsvpLoading}
            className={`h-14 rounded-2xl text-base shadow-sm transition-all ${myRsvp === 'out' ? 'bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-500 ring-offset-2' : 'bg-white text-red-600 border-2 border-red-100 hover:bg-red-50'}`}
          >
            <XCircle className={`w-5 h-5 mr-2 ${myRsvp === 'out' ? 'text-white' : 'text-red-500'}`} />
            I'm Out
          </Button>
        </div>
      )}

      {/* 2. PLAYER LIST CARD */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
          <h3 className="font-bold text-neutral-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-neutral-500" />
            Confirmed Players
          </h3>
          <span className="text-sm font-bold text-neutral-500 bg-white px-2 py-1 rounded-md border border-neutral-200 shadow-sm">
            <span className={inPlayers.length >= booking.max_players ? 'text-green-600' : 'text-neutral-900'}>{inPlayers.length}</span> / {booking.max_players}
          </span>
        </div>
        
        <div className="divide-y divide-neutral-50">
          {sortedInPlayers.map((rsvp: any) => (
            <div key={rsvp.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50 transition-colors">
              <div className="flex items-center gap-3">
                {rsvp.profiles?.avatar_url ? (
                  <img src={rsvp.profiles.avatar_url} className="w-11 h-11 rounded-full object-cover border border-neutral-100 shadow-sm" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-green-50 text-green-700 font-bold flex items-center justify-center border border-green-100 text-lg">
                    {rsvp.profiles?.full_name?.charAt(0) || 'P'}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-bold text-neutral-900 leading-tight">
                    {rsvp.profiles?.full_name || 'Anonymous Player'}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    {rsvp.profiles?.preferred_position || 'Field Player'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">In</span>
              </div>
            </div>
          ))}
          {sortedInPlayers.length === 0 && (
            <div className="p-8 text-center text-neutral-400 text-sm italic">No players confirmed yet.</div>
          )}
        </div>

        {waitlistPlayers.length > 0 && (
          <>
            <div className="p-3 border-y border-neutral-100 bg-purple-50 flex justify-between items-center">
              <h4 className="font-bold text-purple-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" /> Waitlist
              </h4>
              <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">{waitlistPlayers.length} waiting</span>
            </div>
            <div className="divide-y divide-neutral-50 bg-purple-50/30">
              {waitlistPlayers.map((rsvp: any, index: number) => (
                <div key={rsvp.id} className="p-3 flex items-center gap-3 opacity-80">
                  <span className="text-xs font-bold text-neutral-400 w-4">{index + 1}.</span>
                  {rsvp.profiles.avatar_url ? (
                    <img src={rsvp.profiles.avatar_url} className="w-8 h-8 rounded-full object-cover grayscale" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-500 font-bold flex items-center justify-center text-xs">
                      {rsvp.profiles.full_name?.charAt(0)}
                    </div>
                  )}
                  <span className="font-medium text-neutral-700 text-sm">{rsvp.profiles.full_name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 4. TEAMS SECTION */}
      {['upcoming', 'ongoing'].includes(booking.status) && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
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
                      <div className="flex gap-2 items-center">
                        <label className="text-xs text-neutral-500 font-semibold">Color:</label>
                        <input 
                          type="color" 
                          className="w-8 h-8 rounded cursor-pointer"
                          value={t.jerseyColor}
                          onChange={e => {
                            const newForm = [...teamForm]
                            newForm[idx].jerseyColor = e.target.value
                            setTeamForm(newForm)
                          }}
                        />
                      </div>
                      <select 
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
                        value={t.captainId}
                        onChange={e => {
                          const newForm = [...teamForm]
                          newForm[idx].captainId = e.target.value
                          setTeamForm(newForm)
                        }}
                      >
                        <option value="">Select Captain...</option>
                        {inPlayers.map((p: any) => (
                          <option key={p.player_id} value={p.player_id}>{p.profiles.full_name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setTeamForm([...teamForm, { name: '', jerseyColor: '#cccccc', captainId: '' }])}>
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
              <div className="grid grid-cols-2 gap-3">
                {teams.map((team: any) => (
                  <div key={team.id} className="p-3 border rounded-xl" style={{ borderColor: team.jersey_color }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.jersey_color }}></div>
                      <h4 className="font-bold text-sm truncate">{team.name}</h4>
                    </div>
                    {team.team_players && (
                      <div className="text-[10px] text-neutral-500 font-medium">
                        {team.team_players.length} players assigned
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MATCH SCHEDULE */}
      {teams.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-neutral-500" />
              Schedule & Scores
            </h3>
          </div>
          
          <div className="p-4">
            {matchSchedule.length === 0 ? (
              <div className="space-y-3">
                <select 
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-white"
                  value={scheduleType}
                  onChange={e => setScheduleType(e.target.value)}
                >
                  <option>1-Leg League</option>
                  <option>2-Leg League</option>
                </select>
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
                                      <img src={g.profiles.avatar_url} className="w-6 h-6 rounded-full" />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 font-bold flex items-center justify-center text-[10px]">
                                        {g.profiles?.full_name?.charAt(0) || g.scorer?.full_name?.charAt(0)}
                                      </div>
                                    )}
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-neutral-800 leading-none">
                                        {g.profiles?.full_name || g.scorer?.full_name} {g.is_own_goal && <span className="text-red-500 text-[9px] ml-1">(OG)</span>}
                                      </span>
                                      {g.assist && <span className="text-[9px] text-neutral-500 mt-0.5">Assist: {g.assist.full_name}</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {g.minute && <span className="text-[10px] font-bold text-neutral-400">{g.minute}'</span>}
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

      {/* ADD GOAL MODAL */}
      {isAddGoalOpen && expandedMatchId && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-neutral-900/60 p-4 pb-0 sm:pb-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2"><Goal className="w-5 h-5"/> Add Goal</h3>
              <button onClick={() => setIsAddGoalOpen(false)}><X className="w-5 h-5 text-neutral-500" /></button>
            </div>
            
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Team</label>
                <select 
                  required
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-white"
                  value={goalForm.teamId}
                  onChange={e => setGoalForm({...goalForm, teamId: e.target.value, scorerId: '', assistId: ''})}
                >
                  <option value="">Select Team...</option>
                  <option value={matchSchedule.find((m:any) => m.id === expandedMatchId)?.home_team_id}>{getTeamName(matchSchedule.find((m:any) => m.id === expandedMatchId)?.home_team_id)}</option>
                  <option value={matchSchedule.find((m:any) => m.id === expandedMatchId)?.away_team_id}>{getTeamName(matchSchedule.find((m:any) => m.id === expandedMatchId)?.away_team_id)}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Scorer</label>
                <select 
                  required
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-white"
                  value={goalForm.scorerId}
                  onChange={e => setGoalForm({...goalForm, scorerId: e.target.value})}
                >
                  <option value="">Select Player...</option>
                  {teams.find((t:any) => t.id === goalForm.teamId)?.team_players.map((p:any) => (
                    <option key={p.player_id} value={p.player_id}>{p.profiles.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Assist (Optional)</label>
                <select 
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-white"
                  value={goalForm.assistId}
                  onChange={e => setGoalForm({...goalForm, assistId: e.target.value})}
                >
                  <option value="">None</option>
                  {teams.find((t:any) => t.id === goalForm.teamId)?.team_players.filter((p:any) => p.player_id !== goalForm.scorerId).map((p:any) => (
                    <option key={p.player_id} value={p.player_id}>{p.profiles.full_name}</option>
                  ))}
                </select>
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
                Yes, I'm Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
