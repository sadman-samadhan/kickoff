"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { CalendarDays, MapPin, Clock, Goal, Target, Shield, Loader2, ChevronRight, Activity } from 'lucide-react'

export default function MatchHistoryClient({ userId, groupOptions }: { userId: string, groupOptions: any[] }) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState('all')

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true)
      try {
        const res = await fetch(`/api/players/${userId}/match-history?group_id=${selectedGroup}`)
        const data = await res.json()
        setHistory(data.history || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [userId, selectedGroup])

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 max-w-xl mx-auto min-h-screen">
      {/* 1. PAGE HEADER */}
      <div>
        <h1 className="text-2xl font-black text-neutral-900 flex items-center gap-2 mb-4">
          <Activity className="w-6 h-6 text-green-600" /> Match History
        </h1>
        
        <div className="flex items-center gap-2">
          <select 
            className="px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 outline-none focus:border-green-500 shadow-sm"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="all">All Groups</option>
            {groupOptions.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. MATCH HISTORY LIST */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-neutral-300 animate-spin" /></div>
        ) : history.length === 0 ? (
          /* 3. EMPTY STATE */
          <div className="flex flex-col items-center justify-center text-center py-20 bg-white rounded-3xl border border-neutral-100 shadow-sm mt-4">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <CalendarDays className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">No matches yet</h3>
            <p className="text-sm text-neutral-500 max-w-[200px]">Join a group and get playing! 🏃</p>
          </div>
        ) : (
          history.map(match => (
            <Link key={match.booking_id} href={`/groups/${match.group_id}/match/${match.booking_id}`}>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 active:scale-[0.98] transition-transform relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${match.is_completed ? 'bg-neutral-300' : match.status === 'cancelled' ? 'bg-red-400' : 'bg-green-500'}`}></div>
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded mr-2">
                      {match.group_name}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${match.is_completed ? 'bg-neutral-100 text-neutral-600 border-neutral-200' : match.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-100 text-green-700 border-green-200'}`}>
                      {match.is_completed ? 'Completed' : match.status}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-300" />
                </div>

                <h3 className="text-base font-bold text-neutral-900 mb-1 pl-2">
                  {format(parseISO(match.match_date), 'EEEE, MMM d, yyyy')}
                </h3>
                
                <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium mb-4 pl-2">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {match.match_time.slice(0,5)}</span>
                  <span className="flex items-center gap-1 truncate"><MapPin className="w-3.5 h-3.5" /> {match.field_name}</span>
                </div>

                {match.teams_display && (
                  <div className="bg-neutral-50 rounded-xl p-3 text-center mb-4 border border-neutral-100 ml-2">
                    <span className="text-sm font-black text-neutral-800">{match.teams_display}</span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-neutral-100 pt-3 pl-2">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">My Stats</span>
                  <div className="flex items-center gap-3 text-sm font-bold">
                    <span className="flex items-center gap-1 text-amber-600"><Goal className="w-4 h-4" /> {match.stats.goals}</span>
                    <span className="flex items-center gap-1 text-blue-600"><Target className="w-4 h-4" /> {match.stats.assists}</span>
                    <span className="flex items-center gap-1 text-purple-600"><Shield className="w-4 h-4" /> {match.stats.clean_sheets}</span>
                  </div>
                </div>

              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
