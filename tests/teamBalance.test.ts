import { describe, expect, it } from 'vitest'
import { BASE_RATING, computeRatings, expectedScore, type MatchResult } from '@/lib/teamBalance/rating'
import { balanceTeams, type BalancePlayer } from '@/lib/teamBalance/balance'

const match = (id: string, home: string[], away: string[], hs: number, as: number): MatchResult => ({
  id, order: id, home, away, homeScore: hs, awayScore: as,
})

describe('rating model', () => {
  it('winners go up, losers go down', () => {
    const r = computeRatings([match('1', ['a', 'b'], ['c', 'd'], 3, 0)])
    expect(r.get('a')!.rating).toBeGreaterThan(BASE_RATING)
    expect(r.get('c')!.rating).toBeLessThan(BASE_RATING)
  })

  it('learns who is consistently on the winning side', () => {
    const ms: MatchResult[] = []
    // "star" wins every match whatever the team-mates; "weak" loses every match.
    for (let i = 0; i < 12; i++) ms.push(match(String(i).padStart(2, '0'), ['star', `x${i}`], ['weak', `y${i}`], 2, 1))
    const r = computeRatings(ms)
    expect(r.get('star')!.strength).toBeGreaterThan(r.get('weak')!.strength + 100)
  })

  it('pulls players with few matches toward average', () => {
    const one = computeRatings([match('1', ['new'], ['other'], 5, 0)])
    expect(Math.abs(one.get('new')!.strength - BASE_RATING)).toBeLessThan(Math.abs(one.get('new')!.rating - BASE_RATING))
  })

  it('expected score is symmetric', () => {
    expect(expectedScore(1600, 1400) + expectedScore(1400, 1600)).toBeCloseTo(1)
  })
})

describe('balancer', () => {
  const players: BalancePlayer[] = Array.from({ length: 22 }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    strength: 1300 + i * 20,
    position: i < 3 ? 'GK' : i % 3 === 0 ? 'DEF' : i % 3 === 1 ? 'MID' : 'ATT',
  }))

  it('makes equal-sized teams with close average strength', () => {
    const r = balanceTeams(players, 3, 7)
    const sizes = r.teams.map((t) => t.players.length).sort()
    expect(sizes[sizes.length - 1] - sizes[0]).toBeLessThanOrEqual(1)
    expect(r.teams.flatMap((t) => t.players).length).toBe(22)
    expect(r.spread).toBeLessThan(15)
  })

  it('spreads goalkeepers one per team', () => {
    const r = balanceTeams(players, 3, 3)
    expect(r.teams.map((t) => t.players.filter((p) => p.position === 'GK').length)).toEqual([1, 1, 1])
  })

  it('same seed → same teams; different seeds can differ', () => {
    const a = balanceTeams(players, 3, 11).teams.map((t) => t.players.map((p) => p.id).sort().join())
    const b = balanceTeams(players, 3, 11).teams.map((t) => t.players.map((p) => p.id).sort().join())
    expect(a).toEqual(b)
  })
})
