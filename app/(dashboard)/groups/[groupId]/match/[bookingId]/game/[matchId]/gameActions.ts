/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { revalidatePath } from 'next/cache'
import { requireMatchAdmin, requireMatchLogger } from '@/lib/groupAuth'
import { notifyMatch } from '@/lib/live/notify'
import { loadLiveMatch } from '@/lib/live/state'
import type { LiveEvent } from '@/lib/live/types'

// Every write goes through a row-locked SQL function (migration 0005), so two phones scoring the same match
// can't race, a retried tap can't log twice, and the score always equals the events. Results come back as
// { ok, error } because Next hides thrown messages in production.
// Logging doesn't revalidate pages (that would re-render the scoring screen on every tap): open screens get
// a realtime ping and refetch instead.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: (e as Error)?.message || 'Something went wrong' })

/** "profile id" → player; "guest_<rsvp id>" → guest; "guest_<name>" (very old teams) → kept in details only. */
function splitKey(key: string | null | undefined, detailsKey: 'guest_player_id' | 'guest_secondary_player_id') {
  if (!key) return { player: null, guest: null, details: {} }
  if (key.startsWith('guest_')) {
    const rest = key.slice(6)
    return UUID.test(rest) ? { player: null, guest: rest, details: {} } : { player: null, guest: null, details: { [detailsKey]: key } }
  }
  if (!UUID.test(key)) throw new Error('Unknown player')
  return { player: key, guest: null, details: {} }
}

/** Player keys ("profile id" / "guest_…") of everyone on the two teams in this match. */
async function rosterKeys(matchId: string) {
  const state = await loadLiveMatch(matchId)
  return new Set([...(state?.home?.players || []), ...(state?.away?.players || [])].map((p) => p.id))
}

/** A finished match was corrected: knockout places and the matchday pages may change. */
async function afterCorrection(admin: any, groupId: string, bookingId: string) {
  const { checkAndAutoPopulateKnockoutProgression } = await import('@/lib/knockoutProgression')
  await checkAndAutoPopulateKnockoutProgression(admin, bookingId)
  refreshPages(groupId, bookingId)
}

function refreshPages(groupId: string, bookingId: string) {
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
}

export type LogEventInput = {
  /** Generated on the phone, so retries are harmless. */
  id: string
  event_type: 'goal' | 'card' | 'sub' | 'penalty_save'
  team_id: string
  player_key?: string | null
  secondary_key?: string | null
  minute: number
  is_own_goal?: boolean
  card_type?: 'yellow' | 'red'
}

export async function logMatchEventAction(
  matchId: string,
  bookingId: string,
  groupId: string,
  input: LogEventInput,
): Promise<Result<{ event: LiveEvent; duplicate: { by: string | null; secondsAgo: number } | null }>> {
  try {
    const { admin, user, match } = await requireMatchLogger(matchId, bookingId, groupId)
    if (!UUID.test(input.id)) throw new Error('Bad event id')
    const p = splitKey(input.player_key, 'guest_player_id')
    const s = splitKey(input.secondary_key, 'guest_secondary_player_id')
    const details: Record<string, unknown> = { ...p.details, ...s.details }
    if (input.event_type === 'goal') details.is_own_goal = !!input.is_own_goal
    if (input.event_type === 'card') details.card_type = input.card_type === 'red' ? 'red' : 'yellow'

    const { data, error } = await admin.rpc('log_match_event', {
      p_id: input.id,
      p_match: matchId,
      p_type: input.event_type,
      p_team: input.team_id,
      p_player: p.player,
      p_guest: p.guest,
      p_secondary: s.player,
      p_secondary_guest: s.guest,
      p_minute: Math.max(0, Math.round(input.minute || 0)),
      p_details: details,
      p_created_by: user.id,
    })
    if (error) throw new Error(error.message)

    let duplicate = null
    if (data?.possible_duplicate) {
      const { data: d } = await admin
        .from('match_events')
        .select('created_at, creator:profiles!created_by(full_name)')
        .eq('id', data.possible_duplicate)
        .maybeSingle()
      if (d) duplicate = { by: (d as any).creator?.full_name || null, secondsAgo: Math.max(0, Math.round((Date.now() - new Date(d.created_at).getTime()) / 1000)) }
    }
    await notifyMatch(matchId, bookingId, { kind: 'event' })
    if (match.status === 'completed') await afterCorrection(admin, groupId, bookingId)
    return { ok: true, event: data.event as LiveEvent, duplicate }
  } catch (e) {
    return fail(e)
  }
}

export async function updateMatchEventAction(
  matchId: string,
  bookingId: string,
  groupId: string,
  eventId: string,
  input: { player_key?: string | null; secondary_key?: string | null; minute: number; is_own_goal?: boolean; card_type?: 'yellow' | 'red' },
): Promise<Result> {
  try {
    const { admin, match } = await requireMatchLogger(matchId, bookingId, groupId)
    const { data: ev } = await admin.from('match_events').select('event_type').eq('id', eventId).eq('match_schedule_id', matchId).maybeSingle()
    if (!ev) throw new Error('Event not found')
    const p = splitKey(input.player_key, 'guest_player_id')
    const s = splitKey(input.secondary_key, 'guest_secondary_player_id')
    const details: Record<string, unknown> = { ...p.details, ...s.details }
    if (ev.event_type === 'goal') details.is_own_goal = !!input.is_own_goal
    if (ev.event_type === 'card') details.card_type = input.card_type === 'red' ? 'red' : 'yellow'

    const { error } = await admin.rpc('update_match_event', {
      p_event: eventId,
      p_match: matchId,
      p_player: p.player,
      p_guest: p.guest,
      p_secondary: s.player,
      p_secondary_guest: s.guest,
      p_minute: Math.max(0, Math.round(input.minute || 0)),
      p_details: details,
    })
    if (error) throw new Error(error.message)
    await notifyMatch(matchId, bookingId, { kind: 'event' })
    if (match.status === 'completed') await afterCorrection(admin, groupId, bookingId)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** Removes an event (kept in the table as voided, so nothing is lost). */
export async function voidMatchEventAction(matchId: string, bookingId: string, groupId: string, eventId: string): Promise<Result> {
  try {
    const { admin, match } = await requireMatchLogger(matchId, bookingId, groupId)
    const { error } = await admin.rpc('void_match_event', { p_event: eventId, p_match: matchId })
    if (error) throw new Error(error.message)
    await notifyMatch(matchId, bookingId, { kind: 'event' })
    if (match.status === 'completed') await afterCorrection(admin, groupId, bookingId)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export type ClockCommand =
  | { cmd: 'start'; timingMode: 'halves' | 'continuous'; halfMinutes: number }
  | { cmd: 'pause' | 'resume' | 'half_time' | 'second_half' | 'reset' }
  | { cmd: 'adjust'; deltaMs: number }

export async function matchClockAction(matchId: string, bookingId: string, groupId: string, c: ClockCommand): Promise<Result> {
  try {
    const { admin } = await requireMatchLogger(matchId, bookingId, groupId)
    const { error } = await admin.rpc('match_clock', {
      p_match: matchId,
      p_cmd: c.cmd,
      p_timing_mode: c.cmd === 'start' ? c.timingMode : null,
      p_half_minutes: c.cmd === 'start' ? Math.max(1, Math.min(90, Math.round(c.halfMinutes))) : null,
      p_delta_ms: c.cmd === 'adjust' ? Math.round(c.deltaMs) : 0,
    })
    if (error) throw new Error(error.message)
    await notifyMatch(matchId, bookingId, { kind: 'clock' })
    if (c.cmd === 'start' || c.cmd === 'reset') refreshPages(groupId, bookingId)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** Full time: final score from events, clean sheets, knockout progression, matchday completed when all done. */
export async function completeMatchAction(matchId: string, bookingId: string, groupId: string): Promise<Result> {
  try {
    const { admin } = await requireMatchLogger(matchId, bookingId, groupId)
    const { error } = await admin.rpc('complete_match', { p_match: matchId })
    if (error) throw new Error(error.message)
    const { checkAndAutoPopulateKnockoutProgression } = await import('@/lib/knockoutProgression')
    await checkAndAutoPopulateKnockoutProgression(admin, bookingId)
    await notifyMatch(matchId, bookingId, { kind: 'status' })
    refreshPages(groupId, bookingId)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** Who started the match (everyone else starts on the bench for pitch-time stats). */
export async function updateStartingLineupAction(matchId: string, bookingId: string, groupId: string, startingPlayerIds: string[]): Promise<Result> {
  try {
    const { admin } = await requireMatchLogger(matchId, bookingId, groupId)
    const roster = await rosterKeys(matchId)
    const { error } = await admin
      .from('match_schedule')
      .update({ starting_player_ids: Array.from(new Set(startingPlayerIds)).filter((x) => typeof x === 'string' && roster.has(x)) })
      .eq('id', matchId)
    if (error) throw new Error(error.message)
    await notifyMatch(matchId, bookingId, { kind: 'status' })
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** MVP: a registered player goes in mvp/motm_player_id; a guest is stored by name in motm_guest_name. */
export async function updateMatchMvpAction(matchId: string, bookingId: string, groupId: string, playerKey: string | null): Promise<Result> {
  try {
    const { admin } = await requireMatchAdmin(matchId, bookingId, groupId)
    if (playerKey && !(await rosterKeys(matchId)).has(playerKey)) throw new Error('That player is not in this match')
    let guestName: string | null = null
    const k = splitKey(playerKey, 'guest_player_id')
    if (k.guest) {
      const { data: r } = await admin.from('rsvps').select('guest_name').eq('id', k.guest).eq('booking_id', bookingId).maybeSingle()
      if (!r?.guest_name) throw new Error('Guest not found')
      guestName = r.guest_name
    } else if (playerKey && !k.player) {
      guestName = playerKey.slice(6)
    }
    const { error } = await admin
      .from('match_schedule')
      .update({ mvp_player_id: k.player, motm_player_id: k.player, motm_guest_name: guestName })
      .eq('id', matchId)
    if (error) throw new Error(error.message)
    await notifyMatch(matchId, bookingId, { kind: 'status' })
    refreshPages(groupId, bookingId)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}
