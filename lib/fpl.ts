export interface CalculateFplParams {
  position?: string | null // 'GK' | 'DEF' | 'MID' | 'ATT'
  goals: number
  assists: number
  cleanSheets: number
  ownGoals?: number
  appearances: number // number of completed matches played (excluding DNP)
  motmCount?: number
}

/**
 * Calculates total FPL Points according to Kickoff standard:
 * GK / DEF: Goal = +5, Clean Sheet = +3
 * MID: Goal = +4, Clean Sheet = +1
 * ATT: Goal = +4, Clean Sheet = +1
 * Assist: +3 for all
 * Own Goal: -2 for all
 * Appearance: +1 (if played, not DNP)
 * MOTM Bonus: +1 per MOTM award
 */
export function calculateFplPoints({
  position,
  goals,
  assists,
  cleanSheets,
  ownGoals = 0,
  appearances,
  motmCount = 0
}: CalculateFplParams): number {
  const pos = (position || 'ATT').toUpperCase()

  // Position-specific weights for Goal and Clean Sheet
  let goalWeight = 4
  let cleanSheetWeight = 1

  if (pos === 'GK' || pos === 'DEF') {
    goalWeight = 5
    cleanSheetWeight = 3
  } else if (pos === 'MID' || pos === 'ATT') {
    goalWeight = 4
    cleanSheetWeight = 1
  }

  const points =
    (appearances * 1) +
    (goals * goalWeight) +
    (assists * 3) +
    (cleanSheets * cleanSheetWeight) -
    (ownGoals * 2) +
    (motmCount * 1)

  return Math.max(0, points)
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
