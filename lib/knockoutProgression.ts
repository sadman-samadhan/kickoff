/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Evaluates completed knockout matches for a booking and automatically
 * populates downstream placeholder matches (e.g. Final, 3rd Place, Semi-Finals)
 * with the winning (or losing) team IDs.
 */
export async function checkAndAutoPopulateKnockoutProgression(supabaseAdmin: any, bookingId: string) {
  // 1. Fetch all matches for this booking ordered by schedule
  const { data: matches, error } = await supabaseAdmin
    .from('match_schedule')
    .select('*')
    .eq('booking_id', bookingId)
    .order('scheduled_order', { ascending: true })

  if (error || !matches || matches.length === 0) return

  // Helper to determine tie winner & loser for a stage prefix (e.g. "Semi-Final 1", "Quarter-Final 2")
  function getTieWinnerAndLoser(stageBaseName: string): { winnerId: string | null; loserId: string | null } {
    const tieMatches = matches.filter((m: any) => m.stage_name && m.stage_name.startsWith(stageBaseName))
    if (tieMatches.length === 0) return { winnerId: null, loserId: null }

    // Check if all legs in this tie are completed
    const allCompleted = tieMatches.every((m: any) => m.status === 'completed' && m.home_score !== null && m.away_score !== null)
    if (!allCompleted) return { winnerId: null, loserId: null }

    // Aggregate team scores across leg(s)
    const teamScores: Record<string, number> = {}
    const teamsInTie = new Set<string>()

    for (const m of tieMatches) {
      if (m.home_team_id) {
        teamsInTie.add(m.home_team_id)
        teamScores[m.home_team_id] = (teamScores[m.home_team_id] || 0) + (m.home_score || 0)
      }
      if (m.away_team_id) {
        teamsInTie.add(m.away_team_id)
        teamScores[m.away_team_id] = (teamScores[m.away_team_id] || 0) + (m.away_score || 0)
      }
    }

    const teamList = Array.from(teamsInTie)
    if (teamList.length < 2) return { winnerId: null, loserId: null }

    const [t1, t2] = teamList
    const score1 = teamScores[t1] || 0
    const score2 = teamScores[t2] || 0

    if (score1 > score2) return { winnerId: t1, loserId: t2 }
    if (score2 > score1) return { winnerId: t2, loserId: t1 }

    // Aggregate tie-breaker: check Leg 2 result, or fallback to first team
    const lastMatch = tieMatches[tieMatches.length - 1]
    if (lastMatch.home_score > lastMatch.away_score) return { winnerId: lastMatch.home_team_id, loserId: lastMatch.away_team_id }
    if (lastMatch.away_score > lastMatch.home_score) return { winnerId: lastMatch.away_team_id, loserId: lastMatch.home_team_id }

    return { winnerId: t1, loserId: t2 }
  }

  // 2. Check Semi-Final 1 and Semi-Final 2 winners -> Final / 3rd Place
  const sf1 = getTieWinnerAndLoser('Semi-Final 1')
  const sf2 = getTieWinnerAndLoser('Semi-Final 2')
  const sfSingle = getTieWinnerAndLoser('Semi-Final') // For 3 team tournaments

  // A) 4-Team Tournament (SF1 + SF2 -> Final)
  if (sf1.winnerId && sf2.winnerId) {
    const finalMatches = matches.filter((m: any) => m.stage_name && m.stage_name.startsWith('Final'))
    for (const finalMatch of finalMatches) {
      if (finalMatch.leg === 2) {
        if (finalMatch.home_team_id !== sf2.winnerId || finalMatch.away_team_id !== sf1.winnerId) {
          await supabaseAdmin
            .from('match_schedule')
            .update({ home_team_id: sf2.winnerId, away_team_id: sf1.winnerId })
            .eq('id', finalMatch.id)
        }
      } else {
        if (finalMatch.home_team_id !== sf1.winnerId || finalMatch.away_team_id !== sf2.winnerId) {
          await supabaseAdmin
            .from('match_schedule')
            .update({ home_team_id: sf1.winnerId, away_team_id: sf2.winnerId })
            .eq('id', finalMatch.id)
        }
      }
    }

    const thirdPlaceMatches = matches.filter((m: any) => m.stage_name && m.stage_name.startsWith('3rd Place'))
    for (const tpMatch of thirdPlaceMatches) {
      if (sf1.loserId && sf2.loserId) {
        if (tpMatch.home_team_id !== sf1.loserId || tpMatch.away_team_id !== sf2.loserId) {
          await supabaseAdmin
            .from('match_schedule')
            .update({ home_team_id: sf1.loserId, away_team_id: sf2.loserId })
            .eq('id', tpMatch.id)
        }
      }
    }
  }

  // B) 3-Team Tournament (1 Semi-Final -> Winner plays Bye team in Final)
  if (sfSingle.winnerId && !sf1.winnerId) {
    const finalMatches = matches.filter((m: any) => m.stage_name && m.stage_name.startsWith('Final'))
    for (const finalMatch of finalMatches) {
      if (finalMatch.home_team_id && !finalMatch.away_team_id && finalMatch.home_team_id !== sfSingle.winnerId) {
        await supabaseAdmin
          .from('match_schedule')
          .update({ away_team_id: sfSingle.winnerId })
          .eq('id', finalMatch.id)
      } else if (!finalMatch.home_team_id && finalMatch.away_team_id && finalMatch.away_team_id !== sfSingle.winnerId) {
        await supabaseAdmin
          .from('match_schedule')
          .update({ home_team_id: sfSingle.winnerId })
          .eq('id', finalMatch.id)
      } else if (!finalMatch.home_team_id && !finalMatch.away_team_id) {
        await supabaseAdmin
          .from('match_schedule')
          .update({ away_team_id: sfSingle.winnerId })
          .eq('id', finalMatch.id)
      }
    }
  }

  // C) Quarter-Finals -> Semi-Finals (QF1 + QF2 -> SF1; QF3 + QF4 -> SF2)
  const qf1 = getTieWinnerAndLoser('Quarter-Final 1')
  const qf2 = getTieWinnerAndLoser('Quarter-Final 2')
  const qf3 = getTieWinnerAndLoser('Quarter-Final 3')
  const qf4 = getTieWinnerAndLoser('Quarter-Final 4')

  if (qf1.winnerId && qf2.winnerId) {
    const sf1Matches = matches.filter((m: any) => m.stage_name && m.stage_name.startsWith('Semi-Final 1'))
    for (const sfMatch of sf1Matches) {
      const homeId = sfMatch.leg === 2 ? qf2.winnerId : qf1.winnerId
      const awayId = sfMatch.leg === 2 ? qf1.winnerId : qf2.winnerId
      if (sfMatch.home_team_id !== homeId || sfMatch.away_team_id !== awayId) {
        await supabaseAdmin.from('match_schedule').update({ home_team_id: homeId, away_team_id: awayId }).eq('id', sfMatch.id)
      }
    }
  }

  if (qf3.winnerId && qf4.winnerId) {
    const sf2Matches = matches.filter((m: any) => m.stage_name && m.stage_name.startsWith('Semi-Final 2'))
    for (const sfMatch of sf2Matches) {
      const homeId = sfMatch.leg === 2 ? qf4.winnerId : qf3.winnerId
      const awayId = sfMatch.leg === 2 ? qf3.winnerId : qf4.winnerId
      if (sfMatch.home_team_id !== homeId || sfMatch.away_team_id !== awayId) {
        await supabaseAdmin.from('match_schedule').update({ home_team_id: homeId, away_team_id: awayId }).eq('id', sfMatch.id)
      }
    }
  }
}
