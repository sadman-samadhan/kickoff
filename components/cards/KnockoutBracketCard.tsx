/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React from 'react'
import { Trophy } from 'lucide-react'

interface Team {
  id: string
  name: string
  jersey_color?: string
}

interface Match {
  id: string
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
  status: string
  stage_name?: string
  leg?: number
}

interface KnockoutBracketProps {
  matches: Match[]
  teams: Team[]
}

interface TieSummary {
  stageBase: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeScoreDisplay: string
  awayScoreDisplay: string
  winnerId: string | null
  isCompleted: boolean
  matches: Match[]
}

export function KnockoutBracketCard({ matches, teams }: KnockoutBracketProps) {
  const getTeam = (teamId: string | null) => teams.find(t => t.id === teamId)
  
  // Group matches into distinct ties (1-leg or 2-leg aggregates)
  const tiesMap: Record<string, { stageBase: string; matches: Match[] }> = {}

  matches.forEach(m => {
    if (!m.stage_name) return
    const lowerStage = m.stage_name.toLowerCase().trim()
    if (
      lowerStage === 'league' ||
      lowerStage.startsWith('group') ||
      lowerStage.startsWith('match') ||
      lowerStage === 'round-robin'
    ) {
      return
    }

    const hasExplicitLeg = lowerStage.includes('leg') || (m.leg !== undefined && m.leg > 0)
    let stageBase = m.stage_name
      .replace(/\s*\(Leg\s*\d+\)/gi, '')
      .replace(/\s*Leg\s*\d+/gi, '')
      .trim()
    if (!stageBase) stageBase = 'Knockout'

    // Group into aggregate ONLY if explicit Leg indicator is present; otherwise each match is a 1-leg card
    const tieKey = hasExplicitLeg
      ? `${stageBase}___${[m.home_team_id || 'tbd1', m.away_team_id || 'tbd2'].sort().join('___')}`
      : `${stageBase}___${m.id}`

    if (!tiesMap[tieKey]) {
      tiesMap[tieKey] = { stageBase, matches: [] }
    }
    tiesMap[tieKey].matches.push(m)
  })

  // Calculate tie aggregate / winner for each stage group
  const ties: TieSummary[] = Object.values(tiesMap).map(({ stageBase, matches: groupMatches }) => {
    const firstMatch = groupMatches[0]
    const homeTeamId = firstMatch?.home_team_id || null
    const awayTeamId = firstMatch?.away_team_id || null
    const isCompleted = groupMatches.every(m => m.status === 'completed' && m.home_score !== null && m.away_score !== null)

    let homeScoreDisplay = '-'
    let awayScoreDisplay = '-'
    let winnerId: string | null = null

    if (groupMatches.length === 1) {
      // 1-Leg Match
      const m = groupMatches[0]
      if (m.home_score !== null && m.home_score !== undefined) homeScoreDisplay = String(m.home_score)
      if (m.away_score !== null && m.away_score !== undefined) awayScoreDisplay = String(m.away_score)

      if (isCompleted && m.home_score !== null && m.away_score !== null) {
        if (m.home_score > m.away_score) winnerId = homeTeamId
        else if (m.away_score > m.home_score) winnerId = awayTeamId
      }
    } else {
      // 2-Leg Match: aggregate
      const teamScores: Record<string, number> = {}
      const teamsInTie = new Set<string>()

      let allLegsScored = true
      groupMatches.forEach(m => {
        if (m.home_score === null || m.away_score === null) allLegsScored = false
        if (m.home_team_id) {
          teamsInTie.add(m.home_team_id)
          teamScores[m.home_team_id] = (teamScores[m.home_team_id] || 0) + (m.home_score || 0)
        }
        if (m.away_team_id) {
          teamsInTie.add(m.away_team_id)
          teamScores[m.away_team_id] = (teamScores[m.away_team_id] || 0) + (m.away_score || 0)
        }
      })

      const teamList = Array.from(teamsInTie)
      const t1 = homeTeamId || teamList[0]
      const t2 = awayTeamId || teamList[1]

      if (t1 && teamScores[t1] !== undefined && allLegsScored) homeScoreDisplay = String(teamScores[t1])
      if (t2 && teamScores[t2] !== undefined && allLegsScored) awayScoreDisplay = String(teamScores[t2])

      if (isCompleted && t1 && t2) {
        const s1 = teamScores[t1] || 0
        const s2 = teamScores[t2] || 0
        if (s1 > s2) winnerId = t1
        else if (s2 > s1) winnerId = t2
      }
    }

    return {
      stageBase,
      homeTeamId,
      awayTeamId,
      homeScoreDisplay,
      awayScoreDisplay,
      winnerId,
      isCompleted,
      matches: groupMatches
    }
  })

  // Categorize ties into rounds
  const roundOf16Ties = ties.filter(t => t.stageBase.toLowerCase().includes('round of 16'))
  const quarterTies = ties.filter(t => t.stageBase.toLowerCase().includes('quarter'))
  const qualifierTies = ties.filter(t => t.stageBase.toLowerCase().includes('qualifier') || t.stageBase.toLowerCase().includes('eliminator'))
  const semiTies = ties.filter(t => t.stageBase.toLowerCase().includes('semi'))
  const finalTies = ties.filter(t => {
    const lower = t.stageBase.toLowerCase()
    return lower.includes('final') && !lower.includes('semi') && !lower.includes('quarter') && !lower.includes('3rd')
  })
  const thirdPlaceTies = ties.filter(t => t.stageBase.toLowerCase().includes('3rd'))
  const otherKnockoutTies = ties.filter(t => {
    const lower = t.stageBase.toLowerCase()
    return (
      !roundOf16Ties.includes(t) &&
      !quarterTies.includes(t) &&
      !qualifierTies.includes(t) &&
      !semiTies.includes(t) &&
      !finalTies.includes(t) &&
      !thirdPlaceTies.includes(t) &&
      (lower.includes('knockout') || lower.includes('playoff'))
    )
  })

  const rounds = [
    { title: 'Round of 16', ties: roundOf16Ties },
    { title: 'Quarter-Finals', ties: quarterTies },
    { title: 'Playoffs / Qualifiers', ties: qualifierTies },
    { title: 'Semi-Finals', ties: semiTies },
    { title: 'Final', ties: finalTies },
    { title: '3rd Place Playoff', ties: thirdPlaceTies },
    { title: 'Knockouts', ties: otherKnockoutTies }
  ].filter(r => r.ties.length > 0)

  if (rounds.length === 0) {
    return (
      <div className="text-center py-6 text-neutral-400 text-xs italic">
        No knockout bracket data available.
      </div>
    )
  }

  const renderTieCard = (tie: TieSummary, isFinalCard = false) => {
    const homeTeam = getTeam(tie.homeTeamId)
    const awayTeam = getTeam(tie.awayTeamId)

    const isHomeWinner = tie.isCompleted && tie.winnerId === tie.homeTeamId
    const isAwayWinner = tie.isCompleted && tie.winnerId === tie.awayTeamId
    const isTwoLeg = tie.matches.length > 1

    return (
      <div
        key={tie.matches[0]?.id || `${tie.stageBase}_${tie.homeTeamId}`}
        className={`rounded-xl border shadow-sm p-3 flex flex-col gap-2 transition-all ${
          isFinalCard
            ? 'bg-gradient-to-b from-amber-50/70 to-white border-amber-300 shadow-md ring-2 ring-amber-400/20'
            : 'bg-white border-neutral-200 hover:border-neutral-300'
        }`}
      >
        <div className="flex items-center justify-between text-[9px] font-extrabold uppercase text-neutral-400 border-b pb-1">
          <span className={isFinalCard ? 'text-amber-700 font-black flex items-center gap-1' : ''}>
            {isFinalCard && <Trophy className="w-3 h-3 text-amber-500 fill-amber-400" />}
            {tie.stageBase}
          </span>
          {isTwoLeg && (
            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-bold">
              2-Leg Aggregate
            </span>
          )}
        </div>

        {/* Individual Legs breakdown if 2-Leg tie */}
        {isTwoLeg && (
          <div className="space-y-1 py-1 border-b border-neutral-100 text-[10px] text-neutral-500 font-semibold">
            {tie.matches.map((m, idx) => {
              const h = getTeam(m.home_team_id)
              const a = getTeam(m.away_team_id)
              const hScore = m.home_score !== null ? m.home_score : '-'
              const aScore = m.away_score !== null ? m.away_score : '-'

              return (
                <div key={m.id || idx} className="flex justify-between items-center bg-neutral-50/60 px-2 py-0.5 rounded">
                  <span className="text-neutral-400 font-bold">Leg {m.leg || idx + 1}:</span>
                  <span className="truncate max-w-[125px]">{h?.name || 'TBD'} <strong className="text-neutral-900">{hScore}</strong> - <strong className="text-neutral-900">{aScore}</strong> {a?.name || 'TBD'}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Aggregate / Final Result Header */}
        {isTwoLeg && (
          <div className="text-[9px] font-black text-neutral-400 uppercase tracking-wider pt-0.5">
            Aggregate Result
          </div>
        )}

        {/* Home Team Row */}
        <div className={`flex items-center justify-between p-2 rounded-lg transition-colors ${isHomeWinner ? 'bg-emerald-50 text-emerald-900 font-black border border-emerald-200' : 'bg-neutral-50/80 text-neutral-800'}`}>
          <div className="flex items-center gap-2 truncate">
            <span
              className="w-3 h-3 rounded-full shrink-0 border border-black/10 shadow-2xs"
              style={{ backgroundColor: homeTeam?.jersey_color || '#9ca3af' }}
            />
            <span className="text-xs truncate font-bold">
              {homeTeam?.name || 'TBD'}
            </span>
            {isHomeWinner && <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
          </div>
          <span className="text-xs font-black px-2 py-0.5 rounded bg-white shadow-2xs">
            {tie.homeScoreDisplay}
          </span>
        </div>

        {/* Away Team Row */}
        <div className={`flex items-center justify-between p-2 rounded-lg transition-colors ${isAwayWinner ? 'bg-emerald-50 text-emerald-900 font-black border border-emerald-200' : 'bg-neutral-50/80 text-neutral-800'}`}>
          <div className="flex items-center gap-2 truncate">
            <span
              className="w-3 h-3 rounded-full shrink-0 border border-black/10 shadow-2xs"
              style={{ backgroundColor: awayTeam?.jersey_color || '#9ca3af' }}
            />
            <span className="text-xs truncate font-bold">
              {awayTeam?.name || 'TBD'}
            </span>
            {isAwayWinner && <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
          </div>
          <span className="text-xs font-black px-2 py-0.5 rounded bg-white shadow-2xs">
            {tie.awayScoreDisplay}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-5 py-2">
      {/* 1. QUARTER-FINALS (if present) */}
      {quarterTies.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-black text-center text-neutral-400 uppercase tracking-widest bg-neutral-50 py-1 px-3 rounded-md border border-neutral-100">
            Quarter-Finals
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {quarterTies.map(tie => renderTieCard(tie))}
          </div>
          <div className="flex justify-center text-neutral-300 py-1">
            <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      )}

      {/* 2. SEMI-FINALS (Top Row) */}
      {semiTies.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-black text-center text-neutral-400 uppercase tracking-widest bg-neutral-50 py-1 px-3 rounded-md border border-neutral-100">
            Semi-Finals
          </div>
          <div className={`grid ${semiTies.length > 1 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs mx-auto'} gap-2.5`}>
            {semiTies.map(tie => renderTieCard(tie))}
          </div>
        </div>
      )}

      {/* DOWNWARD CONNECTOR */}
      {semiTies.length > 0 && finalTies.length > 0 && (
        <div className="flex flex-col items-center justify-center my-1 text-neutral-300">
          <div className="w-0.5 h-3 bg-neutral-200" />
          <div className="w-6 h-6 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <div className="w-0.5 h-3 bg-neutral-200" />
        </div>
      )}

      {/* QUALIFIERS / PLAYOFFS (e.g. IPL Format) */}
      {qualifierTies.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-black text-center text-neutral-400 uppercase tracking-widest bg-neutral-50 py-1 px-3 rounded-md border border-neutral-100">
            Playoffs / Qualifiers
          </div>
          <div className={`grid ${qualifierTies.length > 1 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs mx-auto'} gap-2.5`}>
            {qualifierTies.map(tie => renderTieCard(tie))}
          </div>
        </div>
      )}

      {/* 3. FINAL (Centered Below) */}
      {finalTies.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-black text-center text-amber-700 uppercase tracking-widest bg-amber-50/80 py-1 px-3 rounded-md border border-amber-200/80 flex items-center justify-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> FINAL CHAMPIONSHIP
          </div>
          <div className="max-w-xs mx-auto">
            {finalTies.map(tie => renderTieCard(tie, true))}
          </div>
        </div>
      )}

      {/* 4. 3RD PLACE PLAYOFF (if present) */}
      {thirdPlaceTies.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-neutral-100">
          <div className="text-[10px] font-black text-center text-neutral-400 uppercase tracking-widest bg-neutral-50 py-1 px-3 rounded-md border border-neutral-100">
            3rd Place Playoff
          </div>
          <div className="max-w-xs mx-auto">
            {thirdPlaceTies.map(tie => renderTieCard(tie))}
          </div>
        </div>
      )}

      {/* 5. OTHER KNOCKOUT MATCHES (if any) */}
      {otherKnockoutTies.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-neutral-100">
          <div className="text-[10px] font-black text-center text-neutral-400 uppercase tracking-widest bg-neutral-50 py-1 px-3 rounded-md border border-neutral-100">
            Knockouts
          </div>
          <div className={`grid ${otherKnockoutTies.length > 1 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs mx-auto'} gap-2.5`}>
            {otherKnockoutTies.map(tie => renderTieCard(tie))}
          </div>
        </div>
      )}
    </div>
  )
}
