// A small rating model learned from a group's own match results (no external AI).
//
// Each player starts at 1500. After every finished match, each player on the winning side gains and each
// player on the losing side loses, more for an upset or a big margin, and more while a player is new
// (their rating is still settling). It's team Elo: cheap, explainable, and it keeps learning every matchday.
// A small bonus for goal involvement per match is added on top, and players with only a few matches
// are pulled toward the average until the model has seen enough of them.

export type MatchResult = {
  id: string
  /** Sort key: matchday date then order within the matchday. */
  order: string
  home: string[]
  away: string[]
  homeScore: number
  awayScore: number
}

export type PlayerRating = { rating: number; matches: number; strength: number }

export const BASE_RATING = 1500

/** How much one result moves a player: bigger while they have few matches. */
function kFactor(matchesPlayed: number) {
  return Math.max(16, 40 - 2 * matchesPlayed)
}

/** Margin of victory multiplier: a 4–0 says more than a 1–0, with diminishing returns. */
function marginMultiplier(goalDiff: number) {
  return 1 + 0.5 * Math.log1p(Math.abs(goalDiff))
}

export function expectedScore(ratingA: number, ratingB: number) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

export function computeRatings(
  matches: MatchResult[],
  goalInvolvements: Map<string, number> = new Map(),
): Map<string, PlayerRating> {
  const rating = new Map<string, number>()
  const played = new Map<string, number>()
  const get = (id: string) => rating.get(id) ?? BASE_RATING
  const mean = (ids: string[]) => ids.reduce((s, id) => s + get(id), 0) / ids.length

  for (const m of [...matches].sort((a, b) => a.order.localeCompare(b.order))) {
    if (m.home.length === 0 || m.away.length === 0) continue
    const expectedHome = expectedScore(mean(m.home), mean(m.away))
    const actualHome = m.homeScore > m.awayScore ? 1 : m.homeScore < m.awayScore ? 0 : 0.5
    const mult = marginMultiplier(m.homeScore - m.awayScore)
    const swing = mult * (actualHome - expectedHome)
    for (const id of m.home) rating.set(id, get(id) + kFactor(played.get(id) ?? 0) * swing)
    for (const id of m.away) rating.set(id, get(id) - kFactor(played.get(id) ?? 0) * swing)
    for (const id of [...m.home, ...m.away]) played.set(id, (played.get(id) ?? 0) + 1)
  }

  // Goal involvement per match, relative to the group average, as a small capped bonus.
  const perMatch = new Map<string, number>()
  for (const [id, n] of Array.from(played.entries())) perMatch.set(id, (goalInvolvements.get(id) ?? 0) / Math.max(1, n))
  const values = Array.from(perMatch.values())
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

  const out = new Map<string, PlayerRating>()
  for (const [id, n] of Array.from(played.entries())) {
    const r = get(id)
    const bonus = Math.max(-60, Math.min(60, 40 * ((perMatch.get(id) ?? 0) - avg)))
    const confidence = n / (n + 5) // few matches → closer to average
    out.set(id, { rating: Math.round(r), matches: n, strength: Math.round(BASE_RATING + confidence * (r + bonus - BASE_RATING)) })
  }
  return out
}
