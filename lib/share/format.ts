import type { MatchdaySummary } from './matchdaySummary'

export function prettyDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** One-line description for previews. */
export function describeMatchday(s: Pick<MatchdaySummary, 'fixtures' | 'champion' | 'topScorer' | 'playersIn' | 'time' | 'venue'>) {
  const played = s.fixtures.filter((f) => f.hs !== null)
  if (s.champion) return `🏆 ${s.champion} won the matchday${s.topScorer ? ` · ⚽ ${s.topScorer.name} (${s.topScorer.goals})` : ''}`
  if (played.length) return played.slice(0, 3).map((f) => `${f.home} ${f.hs}–${f.as} ${f.away}`).join(' · ')
  return `${s.playersIn} players in${s.time ? ` · kick-off ${s.time}` : ''}${s.venue ? ` · ${s.venue}` : ''}`
}
