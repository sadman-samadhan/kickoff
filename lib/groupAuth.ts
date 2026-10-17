import 'server-only'
import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createAdminClient, createClient } from '@/lib/supabase/server'

// Permission helpers for pages, server actions and route handlers.
// Each one looks the owning group up from the database, so a groupId sent by the browser is never trusted.

export class AuthError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.status = status
  }
}

export type GroupRole = 'admin' | 'member'

/** The signed-in user (one Supabase Auth call per request). */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const {
    data: { user },
  } = await createClient().auth.getUser()
  return user
})

export async function requireUser(): Promise<User> {
  const user = await getAuthUser()
  if (!user) throw new AuthError('Not authenticated', 401)
  return user
}

/** The current user's role in a group, or null if they are not a member. */
export const getGroupRole = cache(async (groupId: string): Promise<GroupRole | null> => {
  const user = await getAuthUser()
  if (!user || !groupId) return null
  const { data } = await createAdminClient()
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('player_id', user.id)
    .maybeSingle()
  return (data?.role as GroupRole) ?? null
})

const getBooking = cache(async (bookingId: string) => {
  const { data } = await createAdminClient()
    .from('bookings')
    .select('id, group_id, created_by, status')
    .eq('id', bookingId)
    .maybeSingle()
  return data
})

const getMatch = cache(async (matchId: string) => {
  const { data } = await createAdminClient()
    .from('match_schedule')
    .select('id, booking_id, home_team_id, away_team_id, status')
    .eq('id', matchId)
    .maybeSingle()
  return data
})

function checkGroup(actual: string, expected?: string) {
  if (expected && actual !== expected) throw new AuthError('This item belongs to a different group')
}

export async function requireGroupMember(groupId: string) {
  const user = await requireUser()
  const role = await getGroupRole(groupId)
  if (!role) throw new AuthError('You are not a member of this group')
  return { user, role, admin: createAdminClient() }
}

export async function requireGroupAdmin(groupId: string) {
  const res = await requireGroupMember(groupId)
  if (res.role !== 'admin') throw new AuthError('Only group admins can do that')
  return res
}

/** Booking must exist (and belong to expectedGroupId if given); caller must be a member of its group. */
export async function requireBookingMember(bookingId: string, expectedGroupId?: string) {
  const booking = await getBooking(bookingId)
  if (!booking) throw new AuthError('Match not found', 404)
  checkGroup(booking.group_id, expectedGroupId)
  const res = await requireGroupMember(booking.group_id)
  return { ...res, booking, groupId: booking.group_id as string }
}

export async function requireBookingAdmin(bookingId: string, expectedGroupId?: string) {
  const res = await requireBookingMember(bookingId, expectedGroupId)
  if (res.role !== 'admin') throw new AuthError('Only group admins can do that')
  return res
}

/** Admins, or the booking's creator (used for cancelling). */
export async function requireBookingAdminOrCreator(bookingId: string, expectedGroupId?: string) {
  const res = await requireBookingMember(bookingId, expectedGroupId)
  if (res.role !== 'admin' && res.booking.created_by !== res.user.id) {
    throw new AuthError('Only admins or the person who created this match can do that')
  }
  return res
}

/** Team must belong to bookingId (if given); caller must be an admin of the booking's group. */
export async function requireTeamAdmin(teamId: string, expectedBookingId?: string, expectedGroupId?: string) {
  const { data: team } = await createAdminClient().from('teams').select('id, booking_id').eq('id', teamId).maybeSingle()
  if (!team) throw new AuthError('Team not found', 404)
  if (expectedBookingId && team.booking_id !== expectedBookingId) throw new AuthError('Team belongs to a different match')
  const res = await requireBookingAdmin(team.booking_id, expectedGroupId)
  return { ...res, team }
}

/**
 * Who may log match events, run the clock and set lineups: group admins, plus the captains of the
 * two teams playing this match.
 */
export async function requireMatchLogger(matchId: string, expectedBookingId?: string, expectedGroupId?: string) {
  const match = await getMatch(matchId)
  if (!match) throw new AuthError('Match not found', 404)
  if (expectedBookingId && match.booking_id !== expectedBookingId) throw new AuthError('Match belongs to a different matchday')
  const res = await requireBookingMember(match.booking_id, expectedGroupId)
  if (res.role === 'admin') return { ...res, match, isCaptain: false }

  const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[]
  if (teamIds.length) {
    const { data: teams } = await res.admin.from('teams').select('captain_id').in('id', teamIds)
    if ((teams ?? []).some((t) => t.captain_id === res.user.id)) return { ...res, match, isCaptain: true }
  }
  throw new AuthError('Only admins and the two team captains can update this match')
}

/** Admin-only match changes (e.g. MVP after the match). */
export async function requireMatchAdmin(matchId: string, expectedBookingId?: string, expectedGroupId?: string) {
  const match = await getMatch(matchId)
  if (!match) throw new AuthError('Match not found', 404)
  if (expectedBookingId && match.booking_id !== expectedBookingId) throw new AuthError('Match belongs to a different matchday')
  const res = await requireBookingAdmin(match.booking_id, expectedGroupId)
  return { ...res, match }
}

/** Whether the current user can log events for a match (for showing/hiding controls on pages). */
export async function canLogMatch(matchId: string): Promise<boolean> {
  try {
    await requireMatchLogger(matchId)
    return true
  } catch {
    return false
  }
}
