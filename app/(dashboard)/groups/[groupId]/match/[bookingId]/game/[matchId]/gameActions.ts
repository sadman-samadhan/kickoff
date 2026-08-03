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
 * Log a Match Event (Goal, Card, Substitution, Penalty Save)
 */
export async function logMatchEventAction(
  matchId: string,
  bookingId: string,
  groupId: string,
  eventData: {
    event_type: 'goal' | 'card' | 'sub' | 'penalty_save'
    player_id: string
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

  const { data: event, error } = await admin
    .from('match_events')
    .insert({
      match_schedule_id: matchId,
      event_type: eventData.event_type,
      player_id: eventData.player_id,
      secondary_player_id: eventData.secondary_player_id || null,
      team_id: eventData.team_id || null,
      minute: eventData.minute || 0,
      details_json: eventData.details_json || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Sync Legacy Tables for Goals if goal event
  if (eventData.event_type === 'goal' && eventData.team_id) {
    const isOwnGoal = eventData.details_json?.is_own_goal === true
    await admin.from('goal_events').insert({
      match_schedule_id: matchId,
      scorer_id: eventData.player_id,
      assist_id: eventData.secondary_player_id || null,
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
      // Delete matching goal_events entry if any
      await admin
        .from('goal_events')
        .delete()
        .eq('match_schedule_id', matchId)
        .eq('scorer_id', event.player_id)
        .eq('minute', event.minute)

      await syncMatchScoreFromEvents(admin, matchId)
    }
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}/game/${matchId}`)
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}

/**
 * Sync Match Score from Goal Events
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
    const isOwnGoal = g.details_json?.is_own_goal === true
    if (g.team_id === match.home_team_id) {
      if (isOwnGoal) awayScore++
      else homeScore++
    } else if (g.team_id === match.away_team_id) {
      if (isOwnGoal) homeScore++
      else awayScore++
    }
  })

  await admin
    .from('match_schedule')
    .update({
      home_score: homeScore,
      away_score: awayScore,
    })
    .eq('id', matchId)
}

/**
 * Update Match Status (scheduled, ongoing, completed)
 */
export async function updateMatchStatusAction(
  matchId: string,
  bookingId: string,
  groupId: string,
  status: 'scheduled' | 'ongoing' | 'completed'
) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await admin
    .from('match_schedule')
    .update({ status })
    .eq('id', matchId)

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
