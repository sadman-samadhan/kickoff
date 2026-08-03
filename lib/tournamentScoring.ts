/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PositionScoringRules {
  goal: number
  assist: number
  cleanSheet: number
  penaltySave: number
  goalConceded: number
  ownGoal: number
  yellowCard: number
  redCard: number
}

export interface GroupScoringSettings {
  GK: PositionScoringRules
  DEF: PositionScoringRules
  MID: PositionScoringRules
  ATT: PositionScoringRules
}

/**
 * Default tournament scoring matrix as specified by user requirements
 */
export const DEFAULT_GROUP_SCORING: GroupScoringSettings = {
  GK: {
    goal: 7,
    assist: 6,
    cleanSheet: 5,
    penaltySave: 5,
    goalConceded: -1,
    ownGoal: -3,
    yellowCard: -1,
    redCard: -3,
  },
  DEF: {
    goal: 4,
    assist: 3,
    cleanSheet: 4,
    penaltySave: 0,
    goalConceded: -1,
    ownGoal: -3,
    yellowCard: -1,
    redCard: -3,
  },
  MID: {
    goal: 3,
    assist: 3,
    cleanSheet: 1,
    penaltySave: 0,
    goalConceded: -1,
    ownGoal: -3,
    yellowCard: -1,
    redCard: -3,
  },
  ATT: {
    goal: 4,
    assist: 3,
    cleanSheet: 0,
    penaltySave: 0,
    goalConceded: 0,
    ownGoal: -3,
    yellowCard: -1,
    redCard: -3,
  },
}

/**
 * Merges custom group scoring settings with default fallback values
 */
export function getGroupScoringSettings(groupCustomSettings: any): GroupScoringSettings {
  if (!groupCustomSettings) return DEFAULT_GROUP_SCORING
  return {
    GK: { ...DEFAULT_GROUP_SCORING.GK, ...(groupCustomSettings.GK || {}) },
    DEF: { ...DEFAULT_GROUP_SCORING.DEF, ...(groupCustomSettings.DEF || {}) },
    MID: { ...DEFAULT_GROUP_SCORING.MID, ...(groupCustomSettings.MID || {}) },
    ATT: { ...DEFAULT_GROUP_SCORING.ATT, ...(groupCustomSettings.ATT || {}) },
  }
}

/**
 * Match Event Definition
 */
export interface MatchEvent {
  id: string
  match_schedule_id: string
  event_type: 'goal' | 'card' | 'sub' | 'penalty_save'
  player_id?: string | null
  secondary_player_id?: string | null // assist_id or sub_on_player_id
  team_id?: string | null
  minute: number
  details_json?: {
    card_type?: 'yellow' | 'red'
    is_own_goal?: boolean
    guest_name?: string
    guest_player_id?: string
    guest_secondary_player_id?: string
  } | null
}

/**
 * Calculates rolling substitution intervals and goals conceded on pitch for all players
 */
export function calculateMatchPlayerPitchTime(
  allEvents: MatchEvent[],
  durationMinutes: number = 30,
  homeTeamPlayerIds: string[],
  awayTeamPlayerIds: string[],
  startingPlayerIds: string[]
) {
  const matchDuration = durationMinutes && durationMinutes > 0 ? durationMinutes : 30
  const allPlayerIds = Array.from(new Set([...homeTeamPlayerIds, ...awayTeamPlayerIds]))

  // Track intervals for each player: Array of { start: number, end: number }
  const playerIntervals: Record<string, { start: number; end: number | null }[]> = {}

  allPlayerIds.forEach((pid) => {
    playerIntervals[pid] = []
    if (startingPlayerIds.includes(pid)) {
      // Started on pitch
      playerIntervals[pid].push({ start: 0, end: null })
    }
  })

  // Process substitution events sorted by minute
  const subEvents = allEvents
    .filter((e) => e.event_type === 'sub')
    .sort((a, b) => a.minute - b.minute)

  subEvents.forEach((sub) => {
    const subOffId = sub.player_id || sub.details_json?.guest_player_id
    const subOnId = sub.secondary_player_id || sub.details_json?.guest_secondary_player_id
    const min = Math.min(Math.max(0, sub.minute), matchDuration)

    // Close active interval for subOff player
    if (subOffId && playerIntervals[subOffId]) {
      const activeInt = playerIntervals[subOffId].find((i) => i.end === null)
      if (activeInt) {
        activeInt.end = min
      }
    }

    // Open new interval for subOn player
    if (subOnId) {
      if (!playerIntervals[subOnId]) playerIntervals[subOnId] = []
      const activeInt = playerIntervals[subOnId].find((i) => i.end === null)
      if (!activeInt) {
        playerIntervals[subOnId].push({ start: min, end: null })
      }
    }
  })

  // Close any open intervals at matchDuration
  allPlayerIds.forEach((pid) => {
    if (playerIntervals[pid]) {
      playerIntervals[pid].forEach((i) => {
        if (i.end === null) {
          i.end = matchDuration
        }
      })
    }
  })

  // Helper: Check if player was on pitch at specific minute
  const wasOnPitchAtMinute = (pid: string, minute: number): boolean => {
    const intervals = playerIntervals[pid] || []
    return intervals.some((i) => minute >= i.start && minute <= (i.end ?? matchDuration))
  }

  // Calculate Pitch Minutes & DNP flag for each player
  const minutesPlayed: Record<string, number> = {}
  const goalsConcededOnPitch: Record<string, number> = {}
  const isDnp: Record<string, boolean> = {}

  const goalEvents = allEvents.filter((e) => e.event_type === 'goal')

  allPlayerIds.forEach((pid) => {
    const intervals = playerIntervals[pid] || []
    const totalMins = intervals.reduce((acc, i) => acc + ((i.end ?? matchDuration) - i.start), 0)
    minutesPlayed[pid] = totalMins
    isDnp[pid] = totalMins === 0

    // Count goals conceded by this player's team while they were on pitch
    const isHome = homeTeamPlayerIds.includes(pid)
    let concededCount = 0

    goalEvents.forEach((g) => {
      const gMin = g.minute
      const isOwnGoal = g.details_json?.is_own_goal === true
      const scorerId = (g.player_id || g.details_json?.guest_player_id) ?? ''

      // Goal against home team: Goal scored by away team OR own goal by home team
      const isGoalAgainstHome = (!isOwnGoal && !homeTeamPlayerIds.includes(scorerId)) || (isOwnGoal && homeTeamPlayerIds.includes(scorerId))

      const isConcededAgainstMyTeam = isHome ? isGoalAgainstHome : !isGoalAgainstHome

      if (isConcededAgainstMyTeam && wasOnPitchAtMinute(pid, gMin)) {
        concededCount++
      }
    })

    goalsConcededOnPitch[pid] = concededCount
  })

  return {
    playerIntervals,
    minutesPlayed,
    goalsConcededOnPitch,
    isDnp,
    wasOnPitchAtMinute,
  }
}

/**
 * Calculates custom tournament role-based points for a player
 */
export function calculateTournamentPlayerPoints(
  position: 'GK' | 'DEF' | 'MID' | 'ATT' | null | undefined,
  stats: {
    goals: number
    assists: number
    cleanSheets: number
    penaltySaves: number
    goalsConcededOnPitch: number
    ownGoals: number
    yellowCards: number
    redCards: number
  },
  customSettings?: GroupScoringSettings
): number {
  const settings = getGroupScoringSettings(customSettings)
  const posKey = (position || 'MID') as 'GK' | 'DEF' | 'MID' | 'ATT'
  const rules = settings[posKey] || settings.MID

  const goalPts = stats.goals * rules.goal
  const assistPts = stats.assists * rules.assist
  const csPts = stats.cleanSheets * rules.cleanSheet
  const penSavePts = stats.penaltySaves * rules.penaltySave
  const concededPts = stats.goalsConcededOnPitch * rules.goalConceded
  const ogPts = stats.ownGoals * rules.ownGoal
  const yellowPts = stats.yellowCards * rules.yellowCard
  const redPts = stats.redCards * rules.redCard

  return goalPts + assistPts + csPts + penSavePts + concededPts + ogPts + yellowPts + redPts
}
