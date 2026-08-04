import { calculateTournamentPlayerPoints } from './tournamentScoring'

export interface CalculateFplParams {
  position?: string | null // 'GK' | 'DEF' | 'MID' | 'ATT'
  goals: number
  assists: number
  cleanSheets: number
  ownGoals?: number
  penaltySaves?: number
  goalsConcededOnPitch?: number
  appearances: number // number of completed matches played (excluding DNP)
  motmCount?: number
}

/**
 * Calculates total FPL Points according to Kickoff standard (utilizing tournament scoring rules):
 */
export function calculateFplPoints({
  position,
  goals,
  assists,
  cleanSheets,
  ownGoals = 0,
  penaltySaves = 0,
  goalsConcededOnPitch = 0,
  appearances,
  motmCount = 0
}: CalculateFplParams): number {
  const { totalPoints } = calculateTournamentPlayerPoints(position, {
    goals,
    assists,
    cleanSheets,
    penaltySaves,
    goalsConcededOnPitch,
    ownGoals,
    motmCount,
    appearances,
  })

  return totalPoints
}

/**
 * Returns positional weights breakdown for UI display
 */
export function getFplWeights(position?: string | null) {
  const pos = (position || 'ATT').toUpperCase()
  if (pos === 'GK' || pos === 'DEF') {
    return { goalPts: 5, csPts: 3, assistPts: 3, appPts: 1, motmPts: 1, ownGoalPts: -2 }
  }
  return { goalPts: 4, csPts: 1, assistPts: 3, appPts: 1, motmPts: 1, ownGoalPts: -2 }
}
