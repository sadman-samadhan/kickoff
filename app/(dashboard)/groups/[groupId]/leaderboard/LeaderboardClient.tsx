/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, Trophy, Target, Shield, Goal, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LeaderboardClient({ groupId, groupName }: { groupId: string, groupName: string }) {
  const [topPerformers, setTopPerformers] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [positionFilter, setPositionFilter] = useState('All')
  const [sortBy, setSortBy] = useState('goals')

  useEffect(() => {
    async function fetchTop() {
      try {
        const res = await fetch(`/api/stats/group/${groupId}/top`)
        const data = await res.json()
        setTopPerformers(data)
      } catch (e) {
        console.error(e)
      }
    }
    fetchTop()
  }, [groupId])

  useEffect(() => {
    async function fetchPlayers() {
      setLoading(true)
      try {
        const res = await fetch(`/api/stats/group/${groupId}?sort=${sortBy}`)
        const data = await res.json()
        setPlayers(data.players || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchPlayers()
  }, [groupId, sortBy])

  const filteredPlayers = players.filter(p => {
    if (positionFilter === 'All') return true
    return p.preferred_position === positionFilter
  })

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 max-w-xl mx-auto min-h-screen pb-24">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-2">
        <Link href={`/groups/${groupId}`} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-neutral-200 text-neutral-500">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </Link>
        <div>
          <div className="text-xs font-bold text-green-600 uppercase tracking-wider">{groupName}</div>
          <h1 className="text-xl font-bold text-neutral-900 truncate flex items-center gap-2">Leaderboard <Trophy className="w-5 h-5 text-amber-500"/></h1>
        </div>
      </div>

      {/* 1. TOP PERFORMERS PODIUM */}
      {topPerformers && (
        <div className="grid grid-cols-3 gap-3">
          {/* Playmaker */}
          <div className="bg-white rounded-2xl p-3 border border-neutral-100 shadow-sm flex flex-col items-center text-center pt-6 mt-4">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2 -mt-10 border-4 border-white shadow-sm">
              <Target className="w-5 h-5" />
            </div>
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Playmaker</div>
            {topPerformers.top_playmaker ? (
              <>
                {topPerformers.top_playmaker.player.avatar_url ? (
                  <img src={topPerformers.top_playmaker.player.avatar_url} className="w-12 h-12 rounded-full object-cover mb-2 border border-neutral-100" alt="Avatar" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-lg font-bold text-neutral-500 mb-2">
                    {topPerformers.top_playmaker.player.full_name?.charAt(0)}
                  </div>
                )}
                <div className="font-bold text-neutral-800 text-xs truncate w-full mb-1">{topPerformers.top_playmaker.player.full_name.split(' ')[0]}</div>
                <div className="text-sm font-black text-blue-600">{topPerformers.top_playmaker.assists} 🎯</div>
              </>
            ) : (
              <div className="text-xs text-neutral-400 mt-2">N/A</div>
            )}
          </div>

          {/* Scorer (Middle, Taller) */}
          <div className="bg-gradient-to-b from-amber-50 to-white rounded-2xl p-3 border border-amber-200 shadow-md flex flex-col items-center text-center pt-6 z-10 -mt-2">
            <div className="w-12 h-12 bg-amber-400 text-white rounded-full flex items-center justify-center mb-2 -mt-12 border-4 border-white shadow-sm">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Top Scorer</div>
            {topPerformers.top_scorer ? (
              <>
                {topPerformers.top_scorer.player.avatar_url ? (
                  <img src={topPerformers.top_scorer.player.avatar_url} className="w-16 h-16 rounded-full object-cover mb-2 border-2 border-amber-200" alt="Avatar" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-xl font-bold text-amber-600 mb-2 border-2 border-amber-200">
                    {topPerformers.top_scorer.player.full_name?.charAt(0)}
                  </div>
                )}
                <div className="font-bold text-neutral-900 text-sm truncate w-full mb-1">{topPerformers.top_scorer.player.full_name.split(' ')[0]}</div>
                <div className="text-lg font-black text-amber-500">{topPerformers.top_scorer.goals} ⚽</div>
              </>
            ) : (
              <div className="text-xs text-neutral-400 mt-2">N/A</div>
            )}
          </div>

          {/* Defender */}
          <div className="bg-white rounded-2xl p-3 border border-neutral-100 shadow-sm flex flex-col items-center text-center pt-6 mt-4">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-2 -mt-10 border-4 border-white shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Defender</div>
            {topPerformers.best_defender ? (
              <>
                {topPerformers.best_defender.player.avatar_url ? (
                  <img src={topPerformers.best_defender.player.avatar_url} className="w-12 h-12 rounded-full object-cover mb-2 border border-neutral-100" alt="Avatar" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-lg font-bold text-neutral-500 mb-2">
                    {topPerformers.best_defender.player.full_name?.charAt(0)}
                  </div>
                )}
                <div className="font-bold text-neutral-800 text-xs truncate w-full mb-1">{topPerformers.best_defender.player.full_name.split(' ')[0]}</div>
                <div className="text-sm font-black text-purple-600">{topPerformers.best_defender.clean_sheets} 🛡️</div>
              </>
            ) : (
              <div className="text-xs text-neutral-400 mt-2">N/A</div>
            )}
          </div>
        </div>
      )}

      {/* 2. POSITION FILTER TABS */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {['All', 'GK', 'DEF', 'MID', 'ATT'].map(pos => (
          <button
            key={pos}
            onClick={() => setPositionFilter(pos)}
            className={`px-4 py-2 rounded-full text-sm font-bold shrink-0 transition-colors ${positionFilter === pos ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 border border-neutral-200'}`}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* 3. SORT OPTIONS */}
      <div className="bg-neutral-100 p-1 rounded-xl flex gap-1">
        {[
          { id: 'goals', label: 'Goals' },
          { id: 'assists', label: 'Assists' },
          { id: 'clean_sheets', label: 'Clean Sheets' },
          { id: 'matches', label: 'Matches' }
        ].map(sort => (
          <button
            key={sort.id}
            onClick={() => setSortBy(sort.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === sort.id ? 'bg-white text-green-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            {sort.label}
          </button>
        ))}
      </div>

      {/* 4. PLAYER STATS LIST */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-neutral-300 animate-spin" /></div>
        ) : filteredPlayers.length === 0 ? (
          <div className="text-center py-10 text-neutral-400 text-sm font-bold">No players found.</div>
        ) : (
          filteredPlayers.map((player: any, index: number) => {
            const rank = index + 1
            const rankStyles = rank === 1 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                               rank === 2 ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                               rank === 3 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                               'text-neutral-400 font-bold w-6'

            const cardStyles = rank === 1 ? 'border-amber-200 bg-amber-50/30 shadow-sm' :
                               rank === 2 ? 'border-slate-200 bg-slate-50/30' :
                               rank === 3 ? 'border-orange-200 bg-orange-50/30' :
                               'border-neutral-100 bg-white'

            return (
              <div key={player.player_id} className={`rounded-2xl p-4 flex items-center gap-3 border ${cardStyles}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${rankStyles}`}>
                  #{rank}
                </div>
                
                <div className="relative shrink-0">
                  {player.avatar_url ? (
                    <img src={player.avatar_url} className="w-12 h-12 rounded-full object-cover border border-neutral-200" alt="Avatar" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-500 font-bold flex items-center justify-center border border-neutral-200">
                      {player.full_name?.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-neutral-900 truncate">{player.full_name}</h3>
                    <span className="text-[9px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded uppercase">{player.preferred_position || 'N/A'}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs font-bold mt-1.5">
                    <div className={`flex items-center gap-1 ${sortBy === 'goals' ? 'text-amber-600' : 'text-neutral-500'}`}>
                      <Goal className="w-3.5 h-3.5" /> {player.goals}
                    </div>
                    <div className={`flex items-center gap-1 ${sortBy === 'assists' ? 'text-blue-600' : 'text-neutral-500'}`}>
                      <Target className="w-3.5 h-3.5" /> {player.assists}
                    </div>
                    <div className={`flex items-center gap-1 ${sortBy === 'clean_sheets' ? 'text-purple-600' : 'text-neutral-500'}`}>
                      <Shield className="w-3.5 h-3.5" /> {player.clean_sheets}
                    </div>
                    <div className={`flex items-center gap-1 ml-auto ${sortBy === 'matches' ? 'text-neutral-900' : 'text-neutral-400'}`}>
                      {player.matches_played} <span className="text-[10px] uppercase">GP</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
