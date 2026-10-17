import { describe, expect, it } from 'vitest'
import { checkBid, computeStanding, minNextBid, pickAutoAssignTeam, tierProblem } from '@/lib/auctionRules'
import { V12_RULES as R } from './fixtures/v12'

describe('computeStanding', () => {
  it('keeps base price for every other open slot', () => {
    const s = computeStanding(R, [])
    expect(s).toMatchObject({ spent: 0, remaining: 8000, slotsLeft: 8, maxBid: 8000 - 7 * 50 })
  })
  it('matches the V12 sheet for Syndicate', () => {
    const s = computeStanding(R, [1850, 1300, 2600, 1200, 200, 400, 175, 50])
    expect(s).toMatchObject({ spent: 7775, remaining: 225, slotsLeft: 0, maxBid: 0 })
  })
  it('respects budget adjustments', () => {
    expect(computeStanding(R, [1000], 500).remaining).toBe(7500)
  })
})

describe('checkBid', () => {
  const standing = computeStanding(R, [])
  const base = { rules: R, minPrice: 50, teamId: 'a', standing }

  it('accepts a valid opening bid', () => {
    expect(checkBid({ ...base, amount: 50, top: null })).toEqual({ ok: true })
  })
  it('rejects an opening bid under the base price', () => {
    expect(checkBid({ ...base, amount: 25, top: null }).ok).toBe(false)
  })
  it('needs at least top + increment', () => {
    expect(checkBid({ ...base, amount: 100, top: { teamId: 'b', amount: 100 } }).ok).toBe(false)
    expect(checkBid({ ...base, amount: 125, top: { teamId: 'b', amount: 100 } }).ok).toBe(true)
  })
  it('enforces steps of 25', () => {
    expect(checkBid({ ...base, amount: 130, top: { teamId: 'b', amount: 100 } })).toMatchObject({ ok: false })
  })
  it('stops the highest bidder outbidding themselves', () => {
    const r = checkBid({ ...base, amount: 200, top: { teamId: 'a', amount: 100 } })
    expect(r).toEqual({ ok: false, reason: 'You are already the highest bidder' })
  })
  it('enforces the max bid', () => {
    expect(checkBid({ ...base, amount: 7650, top: null }).ok).toBe(true)
    expect(checkBid({ ...base, amount: 7675, top: null }).ok).toBe(false)
  })
  it('blocks a full squad', () => {
    const full = computeStanding(R, [1000, 1000, 1000, 1000, 1000, 1000, 1000, 500])
    expect(checkBid({ ...base, standing: full, amount: 50, top: null })).toMatchObject({ ok: false })
  })
  it('minNextBid', () => {
    expect(minNextBid(R, 50, null)).toBe(50)
    expect(minNextBid(R, 50, 300)).toBe(325)
  })
})

describe('pickAutoAssignTeam', () => {
  it('prefers most open slots, then most money', () => {
    const teams = [
      { id: 'a', sortOrder: 0, standing: computeStanding(R, [100, 100]) },
      { id: 'b', sortOrder: 1, standing: computeStanding(R, [100]) },
      { id: 'c', sortOrder: 2, standing: computeStanding(R, [50]) },
    ]
    expect(pickAutoAssignTeam(teams, 50)?.id).toBe('c')
  })
  it('skips teams that cannot afford it', () => {
    const teams = [{ id: 'a', sortOrder: 0, standing: computeStanding(R, [7900]) }]
    expect(pickAutoAssignTeam(teams, 150)).toBeNull()
  })
})

describe('tierProblem (one player from every tier)', () => {
  const tiers = [{ id: 'a', name: 'Apex' }, { id: 'p', name: 'Prestige' }, { id: 'd', name: 'Dominion' }]
  const base = { enabled: true, tiersInUse: tiers, availableInTier: 5, otherTeamsMissingTier: 0 }
  it('allows a player from a missing tier', () => {
    expect(tierProblem({ ...base, entryTierId: 'p', teamTierIds: new Set(['a']), slotsLeft: 2 })).toBeNull()
  })
  it('keeps spots for missing tiers', () => {
    expect(tierProblem({ ...base, entryTierId: 'a', teamTierIds: new Set(['a']), slotsLeft: 2 })).toMatch(/Save your spots.*Prestige, Dominion/)
  })
  it('leaves enough of a tier for teams without one', () => {
    expect(tierProblem({ ...base, entryTierId: 'a', teamTierIds: new Set(['a']), slotsLeft: 6, availableInTier: 1, otherTeamsMissingTier: 2 })).toMatch(/Leave enough Apex/)
  })
  it('does nothing when switched off or the player has no tier', () => {
    expect(tierProblem({ ...base, enabled: false, entryTierId: 'a', teamTierIds: new Set(['a']), slotsLeft: 1 })).toBeNull()
    expect(tierProblem({ ...base, entryTierId: null, teamTierIds: new Set(), slotsLeft: 1 })).toBeNull()
  })
})
