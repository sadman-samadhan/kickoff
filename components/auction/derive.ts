import { tierProblem } from '@/lib/auctionRules'
import type { AuctionEntry, AuctionState, AuctionTeam, AuctionTier } from '@/lib/auction/types'

/** Handy lookups computed from a snapshot. */
export function derive(state: AuctionState) {
  const teamById = new Map(state.teams.map((t) => [t.id, t]))
  const tierById = new Map(state.tiers.map((t) => [t.id, t]))
  const current = state.entries.find((e) => e.id === state.auction.currentEntryId) ?? null
  const top = state.currentBids[0] ?? null
  const currentTier = current?.tierId ? tierById.get(current.tierId) ?? null : null
  const minPrice = currentTier?.basePrice ?? state.auction.basePrice
  const squad = (teamId: string) => state.entries.filter((e) => e.status === 'sold' && e.soldTeamId === teamId)
  const counts = {
    total: state.entries.length,
    sold: state.entries.filter((e) => e.status === 'sold').length,
    unsold: state.entries.filter((e) => e.status === 'unsold').length,
    queued: state.entries.filter((e) => e.status === 'queued').length,
  }
  const tiersInUse = state.tiers.filter((t) => state.entries.some((e) => e.tierId === t.id))
  const teamTierIds = (teamId: string) => new Set(squad(teamId).map((e) => e.tierId).filter(Boolean) as string[])
  /** Tiers a team still needs a player from (empty when the rule is off). */
  const missingTiers = (teamId: string) => {
    if (!state.auction.requireEachTier) return []
    const have = teamTierIds(teamId)
    return tiersInUse.filter((t) => !have.has(t.id))
  }
  /** Why a team may not buy this player under the one-per-tier rule, or null. */
  const tierProblemFor = (teamId: string, entry: AuctionEntry | null) => {
    if (!entry) return null
    const team = teamById.get(teamId)
    if (!team) return null
    return tierProblem({
      enabled: state.auction.requireEachTier,
      entryTierId: entry.tierId,
      tiersInUse,
      teamTierIds: teamTierIds(teamId),
      slotsLeft: team.standing.slotsLeft,
      availableInTier: state.entries.filter((e) => e.tierId === entry.tierId && e.id !== entry.id && e.status !== 'sold').length,
      otherTeamsMissingTier: state.teams.filter(
        (t) => t.id !== teamId && t.standing.slotsLeft > 0 && !teamTierIds(t.id).has(entry.tierId as string),
      ).length,
    })
  }
  return { teamById, tierById, current, top, currentTier, minPrice, squad, counts, missingTiers, tierProblemFor }
}

export type Derived = ReturnType<typeof derive>

export function tierOf(e: AuctionEntry, tierById: Map<string, AuctionTier>) {
  return e.tierId ? tierById.get(e.tierId) ?? null : null
}

export function rulesOf(state: AuctionState) {
  const a = state.auction
  return { budget: a.budget, squadSize: a.squadSize, bidIncrement: a.bidIncrement, basePrice: a.basePrice }
}

export function teamLabel(t: AuctionTeam | undefined | null) {
  return t?.name ?? '—'
}

/** Dark or light text for a colour background. */
export function onColor(hex: string): string {
  const h = (hex || '').replace('#', '')
  if (h.length !== 6) return '#ffffff'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#0f172a' : '#ffffff'
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
}
