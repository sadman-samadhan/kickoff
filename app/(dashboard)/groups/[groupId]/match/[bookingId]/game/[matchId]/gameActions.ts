/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Update Match Duration (in minutes). Defaults to 30 if empty.
 */
export async function updateMatchDurationAction(
  matchId: string,
  bookingId: string,
  groupId: string,
  durationMinutes: number
) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const duration = durationMinutes && durationMinutes > 0 ? durationMinutes : 30

  const { error } = await admin
    .from('match_schedule')
    .update({ duration_minutes: duration })
    .eq('id', matchId)

  if (error) throw new Error(error.message)

  revalidatePath(`/groups/${groupId}/match/${bookingId}/game/${matchId}`)
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

/**
 * Update Starting Lineup (Starting XI Player IDs)
 */
export async function updateStartingLineupAction(
  matchId: string,
  bookingId: string,
  groupId: string,
  startingPlayerIds: string[]
) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await admin
    .from('match_schedule')
    .update({ starting_player_ids: startingPlayerIds })
    .eq('id', matchId)

  if (error && error.message?.includes('starting_player_ids')) {
    console.warn('starting_player_ids column missing on match_schedule table')
  } else if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}/game/${matchId}`)
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

/**
 * Log a Match Event (Goal, Card, Substitution, Penalty Save)
 */
export async function logMatchEventAction(
  matchId: string,
  bookingId: string,
  groupId: string,
  eventData: {
    event_type: 'goal' | 'card' | 'sub' | 'penalty_save'
    player_id?: string | null
    secondary_player_id?: string | null
    team_id?: string | null
    minute: number
    details_json?: any
  }
) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const isGuestPlayer = eventData.player_id?.startsWith('guest_')
  const isGuestSecondary = eventData.secondary_player_id?.startsWith('guest_')

  const realPlayerId = isGuestPlayer ? null : (eventData.player_id || null)
  const realSecondaryPlayerId = isGuestSecondary ? null : (eventData.secondary_player_id || null)

  const mergedDetails = {
    ...(eventData.details_json || {}),
    ...(isGuestPlayer ? { guest_player_id: eventData.player_id } : {}),
    ...(isGuestSecondary ? { guest_secondary_player_id: eventData.secondary_player_id } : {})
  }

  const { data: event, error } = await admin
    .from('match_events')
    .insert({
      match_schedule_id: matchId,
      event_type: eventData.event_type,
      player_id: realPlayerId,
      secondary_player_id: realSecondaryPlayerId,
      team_id: eventData.team_id || null,
      minute: eventData.minute || 0,
      details_json: mergedDetails,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Sync Legacy Tables for Goals if goal event
  if (eventData.event_type === 'goal' && eventData.team_id) {
    const isOwnGoal = eventData.details_json?.is_own_goal === true
    await admin.from('goal_events').insert({
      match_schedule_id: matchId,
      scorer_id: realPlayerId,
      assist_id: realSecondaryPlayerId,
      team_id: eventData.team_id,
      is_own_goal: isOwnGoal,
      minute: eventData.minute || null,
    })

    // Recalculate score from goal events
    await syncMatchScoreFromEvents(admin, matchId)
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}/game/${matchId}`)
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  return { success: true, event }
}

/**
 * Delete / Undo a Match Event
 */
export async function deleteMatchEventAction(
  eventId: string,
  matchId: string,
  bookingId: string,
  groupId: string
) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check event type
  const { data: event } = await admin
    .from('match_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (event) {
    await admin.from('match_events').delete().eq('id', eventId)

    if (event.event_type === 'goal') {
      await syncMatchScoreFromEvents(admin, matchId)
    }
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}/game/${matchId}`)
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}

/**
 * Sync Match Score & Legacy goal_events Table from match_events
 */
async function syncMatchScoreFromEvents(admin: any, matchId: string) {
  const { data: match } = await admin
    .from('match_schedule')
    .select('home_team_id, away_team_id')
    .eq('id', matchId)
    .single()

  if (!match) return

  const { data: events } = await admin
    .from('match_events')
    .select('*')
    .eq('match_schedule_id', matchId)
    .eq('event_type', 'goal')

  let homeScore = 0
  let awayScore = 0

  events?.forEach((g: any) => {
    const isOwn = g.details_json?.is_own_goal === true
    if (g.team_id === match.home_team_id && !isOwn) homeScore++
    else if (g.team_id === match.away_team_id && isOwn) homeScore++
    else if (g.team_id === match.away_team_id && !isOwn) awayScore++
    else if (g.team_id === match.home_team_id && isOwn) awayScore++
  })

  await admin
    .from('match_schedule')
    .update({ home_score: homeScore, away_score: awayScore })
    .eq('id', matchId)

  // Re-sync legacy goal_events table cleanly for this matchId
  await admin.from('goal_events').delete().eq('match_schedule_id', matchId)
  if (events && events.length > 0) {
    const legacyGoalRows = events.map((e: any) => ({
      match_schedule_id: matchId,
      scorer_id: e.player_id,
      assist_id: e.secondary_player_id,
      team_id: e.team_id,
      is_own_goal: e.details_json?.is_own_goal === true,
      minute: e.minute || null,
    }))
    await admin.from('goal_events').insert(legacyGoalRows)
  }
}

/**
 * Update Match Status (scheduled, ongoing, completed), start timestamp and period
 */
export async function updateMatchStatusAction(
  matchId: string,
  bookingId: string,
  groupId: string,
  status: 'scheduled' | 'ongoing' | 'completed',
  startedAt?: string | null,
  period?: string | null
) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const updatePayload: any = { status }
  if (startedAt !== undefined) updatePayload.started_at = startedAt
  if (period !== undefined) updatePayload.period = period

  let { error } = await admin
    .from('match_schedule')
    .update(updatePayload)
    .eq('id', matchId)

  // Defensive fallback if columns started_at or period do not exist in database yet
  if (error && (error.message?.includes('started_at') || error.message?.includes('period'))) {
    delete updatePayload.started_at
    delete updatePayload.period
    const res = await admin.from('match_schedule').update(updatePayload).eq('id', matchId)
    error = res.error
  }

  if (error) throw new Error(error.message)

  // Check if knockout progression should trigger
  if (status === 'completed') {
    const { checkAndAutoPopulateKnockoutProgression } = await import('@/lib/knockoutProgression')
    await checkAndAutoPopulateKnockoutProgression(admin, bookingId)
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}/game/${matchId}`)
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}

/**
 * Manually update match score
 */
export async function updateMatchScoreAction(
  matchId: string,
  bookingId: string,
  groupId: string,
  homeScore: number,
  awayScore: number
) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await admin
    .from('match_schedule')
    .update({
      home_score: Math.max(0, homeScore),
      away_score: Math.max(0, awayScore),
    })
    .eq('id', matchId)

  if (error) throw new Error(error.message)

  revalidatePath(`/groups/${groupId}/match/${bookingId}/game/${matchId}`)
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}

/**
 * Update Match MVP Player ID
 */
export async function updateMatchMvpAction(
  matchId: string,
  bookingId: string,
  groupId: string,
  mvpPlayerId: string | null
) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await admin
    .from('match_schedule')
    .update({ mvp_player_id: mvpPlayerId })
    .eq('id', matchId)

  if (error && error.message?.includes('mvp_player_id')) {
    console.warn('mvp_player_id column missing on match_schedule table')
  } else if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}/game/${matchId}`)
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}
