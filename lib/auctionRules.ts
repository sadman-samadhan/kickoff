// Mirrors the checks in supabase/migrations/0004_auction.sql (auction_place_bid / auction_team_standings).
// The database is the source of truth; this copy lets the UI disable buttons and explain why.

export type Rules = {
  budget: number
  squadSize: number
  bidIncrement: number
  basePrice: number
}

export type Standing = {
  totalBudget: number
  spent: number
  remaining: number
  slotsLeft: number
  maxBid: number
}

export function computeStanding(
  rules: Rules,
  soldPrices: number[],
  budgetAdjustment = 0,
): Standing {
  const totalBudget = rules.budget + budgetAdjustment
  const spent = soldPrices.reduce((a, b) => a + b, 0)
  const remaining = totalBudget - spent
  const slotsLeft = rules.squadSize - soldPrices.length
  const maxBid = slotsLeft <= 0 ? 0 : Math.max(0, remaining - (slotsLeft - 1) * rules.basePrice)
  return { totalBudget, spent, remaining, slotsLeft, maxBid }
}

/** Smallest valid bid right now. */
export function minNextBid(rules: Rules, minPrice: number, topAmount: number | null): number {
  return topAmount == null ? minPrice : topAmount + rules.bidIncrement
}

export type BidCheck = { ok: true } | { ok: false; reason: string }

export function checkBid(args: {
  rules: Rules
  minPrice: number // opening price for this player (tier override or base price)
  amount: number
  top: { teamId: string; amount: number } | null
  teamId: string
  standing: Standing
}): BidCheck {
  const { rules, minPrice, amount, top, teamId, standing } = args
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) return { ok: false, reason: 'Enter a whole number' }
  if (top) {
    if (top.teamId === teamId) return { ok: false, reason: 'You are already the highest bidder' }
    if (amount < top.amount + rules.bidIncrement)
      return { ok: false, reason: `Bid must be at least ${top.amount + rules.bidIncrement}` }
  } else if (amount < minPrice) {
    return { ok: false, reason: `Opening bid must be at least ${minPrice}` }
  }
  if ((amount - minPrice) % rules.bidIncrement !== 0)
    return { ok: false, reason: `Bids go up in steps of ${rules.bidIncrement}` }
  if (standing.slotsLeft <= 0) return { ok: false, reason: 'Your squad is already full' }
  if (amount > standing.maxBid)
    return {
      ok: false,
      reason: `Your max bid is ${standing.maxBid} (you must keep ${rules.basePrice} for each of your other ${standing.slotsLeft - 1} open spots)`,
    }
  return { ok: true }
}

/** Auto-assign order used for leftover players: most open slots, then most money left. */
export function pickAutoAssignTeam<T extends { id: string; standing: Standing; sortOrder: number }>(
  teams: T[],
  price: number,
): T | null {
  const eligible = teams.filter((t) => t.standing.slotsLeft > 0 && t.standing.maxBid >= price)
  eligible.sort(
    (a, b) =>
      b.standing.slotsLeft - a.standing.slotsLeft ||
      b.standing.remaining - a.standing.remaining ||
      a.sortOrder - b.sortOrder,
  )
  return eligible[0] ?? null
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US')
}

/**
 * "At least one player from every tier" (mirrors _auction_tier_problem in 0004_auction.sql).
 * Returns the reason a team may not buy a player, or null when it may.
 */
export function tierProblem(args: {
  enabled: boolean
  entryTierId: string | null
  /** Tiers that have at least one player, in auction order. */
  tiersInUse: { id: string; name: string }[]
  /** Tiers the team already has a player from. */
  teamTierIds: Set<string>
  slotsLeft: number
  /** Unsold players left in the entry's tier, not counting this one. */
  availableInTier: number
  /** Other teams with open spots that have no player from the entry's tier yet. */
  otherTeamsMissingTier: number
}): string | null {
  const { enabled, entryTierId, tiersInUse, teamTierIds, slotsLeft, availableInTier, otherTeamsMissingTier } = args
  if (!enabled || !entryTierId) return null
  const missing = tiersInUse.filter((t) => !teamTierIds.has(t.id))
  const fillsAGap = missing.some((t) => t.id === entryTierId)
  if (!fillsAGap && slotsLeft - 1 < missing.length) {
    return `Save your spots: you still need a player from ${missing.map((t) => t.name).join(', ')}`
  }
  if (!fillsAGap && availableInTier < otherTeamsMissingTier) {
    const name = tiersInUse.find((t) => t.id === entryTierId)?.name ?? 'that tier'
    return `Leave enough ${name} players for the teams that don't have one yet`
  }
  return null
}
