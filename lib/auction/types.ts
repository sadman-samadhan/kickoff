import type { Standing } from '@/lib/auctionRules'

export type AuctionStatus = 'draft' | 'live' | 'paused' | 'done'
export type EntryStatus = 'queued' | 'on_block' | 'sold' | 'unsold'

export type AuctionInfo = {
  id: string
  bookingId: string
  groupId: string
  groupName: string
  matchLabel: string
  status: AuctionStatus
  phase: 'main' | 'reauction' | 'done'
  budget: number
  squadSize: number
  bidIncrement: number
  basePrice: number
  callState: 'none' | 'once' | 'twice'
  currentEntryId: string | null
  finalizedAt: string | null
}

export type AuctionTier = { id: string; name: string; sortOrder: number; basePrice: number | null; color: string }

export type AuctionTeam = {
  id: string
  name: string
  color: string
  captainId: string | null
  captainName: string | null
  captainAvatar: string | null
  sortOrder: number
  budgetAdjustment: number
  standing: Standing
}

export type AuctionEntry = {
  id: string
  rsvpId: string
  playerId: string | null
  name: string
  avatarUrl: string | null
  position: string | null
  isGuest: boolean
  tierId: string | null
  status: EntryStatus
  queueOrder: number | null
  soldTeamId: string | null
  soldPrice: number | null
  soldVia: 'bid' | 'auto_assign' | 'manual' | null
}

export type AuctionBid = { id: string; teamId: string; amount: number; createdAt: string }

export type AuctionEvent = {
  id: string
  type: string
  entryId: string | null
  teamId: string | null
  amount: number | null
  undone: boolean
  createdAt: string
}

export type AuctionState = {
  auction: AuctionInfo
  tiers: AuctionTier[]
  teams: AuctionTeam[]
  entries: AuctionEntry[]
  currentBids: AuctionBid[]
  events: AuctionEvent[]
  myTeamId: string | null
  isAdmin: boolean
  fetchedAt: string
}

/** Broadcast after every change so open screens refetch. */
export type AuctionPing =
  | { kind: 'changed' }
  | { kind: 'bid'; teamId: string; amount: number; entryId: string }
  | { kind: 'sold'; teamId: string; amount: number; entryId: string }
