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
  return { teamById, tierById, current, top, currentTier, minPrice, squad, counts }
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
