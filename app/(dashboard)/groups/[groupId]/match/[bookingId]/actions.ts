/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveTeamsAction(bookingId: string, groupId: string, teamsData: any[]) {
  const admin = createAdminClient()
  
  for (const team of teamsData) {
    const realCaptainId = (team.captainId && !team.captainId.startsWith('guest_')) ? team.captainId : null
    const guestRsvpIds = Array.from(new Set(
      (team.playerIds || [])
        .filter((id: string) => id.startsWith('guest_'))
        .map((id: string) => id.replace('guest_', '').replace(' (C)', '').trim())
    ))

    const { data: newTeam, error: teamError } = await admin.from('teams').insert({
      booking_id: bookingId,
      name: team.name || 'Team',
      jersey_color: team.jerseyColor || '#ffffff',
      captain_id: realCaptainId,
      guest_members: guestRsvpIds.length > 0 ? guestRsvpIds : null
    }).select().single()

    if (teamError) throw new Error(teamError.message)

    const playerIds = new Set<string>()
    if (realCaptainId) playerIds.add(realCaptainId)
    ;(team.playerIds || []).filter((id: string) => !id.startsWith('guest_')).forEach((id: string) => playerIds.add(id))

    if (playerIds.size > 0) {
      await admin.from('team_players').insert(Array.from(playerIds).map(pid => ({ team_id: newTeam.id, player_id: pid })))
      for (const pid of Array.from(playerIds)) {
        notifyPlayerOfTeamAssignment(admin, bookingId, groupId, pid, newTeam.id)
      }
    }
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function updateTeamAction(teamId: string, bookingId: string, groupId: string, data: { name: string, jerseyColor: string, captainId: string, playerIds: string[], guestNames?: Record<string, string> }) {
  const admin = createAdminClient()
  const realCaptainId = (data.captainId && !data.captainId.startsWith('guest_')) ? data.captainId : null
  const guestRsvpIds = Array.from(new Set(
    (data.playerIds || [])
      .filter((id: string) => id.startsWith('guest_'))
      .map((id: string) => id.replace('guest_', '').replace(' (C)', '').trim())
  ))

  await admin.from('teams').update({
    name: data.name,
    jersey_color: data.jerseyColor,
    captain_id: realCaptainId,
    guest_members: guestRsvpIds.length > 0 ? guestRsvpIds : null
  }).eq('id', teamId)

  const { data: oldPlayers } = await admin.from('team_players').select('player_id').eq('team_id', teamId)
  const oldPlayerIds = new Set(oldPlayers?.map(p => p.player_id) || [])

  await admin.from('team_players').delete().eq('team_id', teamId)
  const realPlayerIds = new Set<string>()
  if (realCaptainId) realPlayerIds.add(realCaptainId)
  ;(data.playerIds || []).filter((id: string) => !id.startsWith('guest_')).forEach((id: string) => realPlayerIds.add(id))
  if (realPlayerIds.size > 0) {
    await admin.from('team_players').insert(Array.from(realPlayerIds).map(pid => ({ team_id: teamId, player_id: pid })))
    
    const newlyAssigned = Array.from(realPlayerIds).filter(pid => !oldPlayerIds.has(pid))
    for (const pid of newlyAssigned) {
      notifyPlayerOfTeamAssignment(admin, bookingId, groupId, pid, teamId)
    }
  }
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function deleteTeamAction(teamId: string, bookingId: string, groupId: string) {
  const admin = createAdminClient()
  await admin.from('team_players').delete().eq('team_id', teamId)
  await admin.from('teams').delete().eq('id', teamId)
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function generateScheduleAction(bookingId: string, groupId: string, teams: any[], scheduleType: string) {
  const supabase = createClient()
  const { generateLeagueSchedule, generateKnockoutSchedule } = await import('@/lib/scheduleGenerator')

  const is2Leg = scheduleType.includes('2-Leg') || scheduleType.includes('2-leg') || scheduleType.includes('UCL')
  const isKnockout = scheduleType.includes('Knockout') || scheduleType.includes('World Cup') || scheduleType.includes('UCL')

  const generatedMatches = isKnockout
    ? generateKnockoutSchedule(teams, is2Leg ? 2 : 1)
    : generateLeagueSchedule(teams, is2Leg ? 2 : 1)

  for (const match of generatedMatches) {
    await supabase.from('match_schedule').insert({
      booking_id: bookingId,
      home_team_id: match.home_team_id,
      away_team_id: match.away_team_id,
      match_number: match.match_number,
      leg: match.leg,
      scheduled_order: match.scheduled_order,
      stage_name: match.stage_name || (isKnockout ? 'Knockout' : 'League'),
      status: 'scheduled'
    })
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function addManualMatchAction(
  bookingId: string,
  groupId: string,
  homeTeamId: string,
  awayTeamId: string,
  leg: number = 1,
  stageName: string = 'Match'
) {
  const admin = createAdminClient()
  const { data: existingMatches } = await admin
    .from('match_schedule')
    .select('scheduled_order')
    .eq('booking_id', bookingId)

  const maxOrder = existingMatches?.reduce((max, m) => Math.max(max, m.scheduled_order || 0), 0) || 0

  await admin.from('match_schedule').insert({
    booking_id: bookingId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    match_number: maxOrder + 1,
    leg: leg || 1,
    scheduled_order: maxOrder + 1,
    stage_name: stageName,
    status: 'scheduled'
  })

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function updateMatchScoreAction(
  groupId: string,
  bookingId: string,
  matchScheduleId: string,
  homeScore: number,
  awayScore: number,
  status: string,
  goalEvents: any[],
  fantasyData?: {
    dnpPlayerIds?: string[]
    dnpGuestNames?: string[]
    motmPlayerId?: string | null
    motmGuestName?: string | null
  }
) {
  const supabase = createClient()
  
  await supabase.from('match_schedule').update({
    home_score: homeScore,
    away_score: awayScore,
    status,
    dnp_player_ids: fantasyData?.dnpPlayerIds || [],
    dnp_guest_names: fantasyData?.dnpGuestNames || [],
    motm_player_id: fantasyData?.motmPlayerId || null,
    mvp_player_id: fantasyData?.motmPlayerId || null,
    motm_guest_name: fantasyData?.motmGuestName || null
  }).eq('id', matchScheduleId)

  // Clear previous goal events for this match before re-inserting if updated
  await supabase.from('goal_events').delete().eq('match_schedule_id', matchScheduleId)

  // Insert goal events if any
  if (goalEvents && goalEvents.length > 0) {
    const formattedGoals = goalEvents.map(g => ({
      match_schedule_id: matchScheduleId,
      scorer_id: g.scorerId,
      assist_id: g.assistId || null,
      team_id: g.teamId,
      is_own_goal: g.isOwnGoal || false,
      minute: g.minute || null
    }))
    await supabase.from('goal_events').insert(formattedGoals)
  }

  // Check if all matches in schedule are completed, then complete booking
  const { data: schedule } = await supabase.from('match_schedule').select('status').eq('booking_id', bookingId)
  const allCompleted = schedule?.every(s => s.status === 'completed')
  if (allCompleted) {
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId)
  } else if (status === 'ongoing') {
    await supabase.from('bookings').update({ status: 'ongoing' }).eq('id', bookingId)
  }

  // Auto-populate knockout progression (e.g. Semi-Final winners -> Final)
  const admin = createAdminClient()
  const { checkAndAutoPopulateKnockoutProgression } = await import('@/lib/knockoutProgression')
  await checkAndAutoPopulateKnockoutProgression(admin, bookingId)

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function adminAddRsvpAction(bookingId: string, groupId: string, playerIdOrIds: string | string[], maxPlayers: number, selectedPositions?: Record<string, string>) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify caller is admin
  const { data: callerMembership } = await admin
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('player_id', user.id)
    .single()

  if (callerMembership?.role !== 'admin') throw new Error('Only admins can add players')

  const playerIds = Array.isArray(playerIdOrIds) ? playerIdOrIds : [playerIdOrIds]

  // Filter out suspended profiles
  const { data: suspendedProfiles } = await admin.from('profiles').select('id').in('id', playerIds).eq('is_suspended', true)
  const suspendedIds = new Set((suspendedProfiles || []).map((p: any) => p.id))
  const validPlayerIds = playerIds.filter((id: string) => !suspendedIds.has(id))

  if (validPlayerIds.length === 0) {
    throw new Error('Cannot add suspended player(s) to match')
  }

  for (const playerId of validPlayerIds) {
    // Fetch current RSVPs
    const { data: currentRsvps } = await admin.from('rsvps').select('*').eq('booking_id', bookingId)
    const inCount = currentRsvps?.filter((r: any) => r.status === 'in').length || 0
    const existingRsvp = currentRsvps?.find((r: any) => r.player_id === playerId)

    let finalStatus = 'in'
    let waitlistPosition = null

    if (inCount >= maxPlayers) {
      if (!existingRsvp || existingRsvp.status !== 'in') {
        finalStatus = 'waitlist'
        const waitlistCount = currentRsvps?.filter((r: any) => r.status === 'waitlist').length || 0
        waitlistPosition = waitlistCount + 1
      }
    }

    const payload: any = {
      status: finalStatus,
      waitlist_position: waitlistPosition,
      responded_at: new Date().toISOString()
    }

    if (selectedPositions && selectedPositions[playerId]) {
      payload.selected_position = selectedPositions[playerId]
    }

    if (existingRsvp) {
      let { error } = await admin.from('rsvps').update(payload).eq('id', existingRsvp.id)
      if (error && error.message?.includes('selected_position')) {
        delete payload.selected_position
        await admin.from('rsvps').update(payload).eq('id', existingRsvp.id)
      }
    } else {
      payload.booking_id = bookingId
      payload.player_id = playerId
      let { error } = await admin.from('rsvps').insert(payload)
      if (error && error.message?.includes('selected_position')) {
        delete payload.selected_position
        await admin.from('rsvps').insert(payload)
      }
    }
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateRsvpPositionAction(rsvpId: string, bookingId: string, groupId: string, selectedPosition: string) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await admin.from('rsvps').update({ selected_position: selectedPosition }).eq('id', rsvpId)
  if (error && error.message?.includes('selected_position')) {
    throw new Error("Please run SQL migration in Supabase to enable selected_position column: ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS selected_position TEXT;")
  } else if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function addGuestAction(bookingId: string, groupId: string, guestName: string, position: string) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: callerMembership } = await admin
    .from('group_members').select('role')
    .eq('group_id', groupId).eq('player_id', user.id).single()
  if (callerMembership?.role !== 'admin') throw new Error('Only admins can add guests')

  await admin.from('rsvps').insert({
    booking_id: bookingId,
    player_id: null,
    status: 'in',
    guest_name: guestName,
    guest_position: position,
    responded_at: new Date().toISOString()
  })

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateMaxPlayersAction(bookingId: string, groupId: string, maxPlayers: number) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: callerMembership } = await admin
    .from('group_members').select('role')
    .eq('group_id', groupId).eq('player_id', user.id).single()
  if (callerMembership?.role !== 'admin') throw new Error('Only admins can edit max players')

  await admin.from('bookings').update({ max_players: maxPlayers }).eq('id', bookingId)

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function assignPlayerToTeamAction(bookingId: string, groupId: string, playerId: string | null, guestName: string | null, rsvpId: string, newTeamId: string | null) {
  const admin = createAdminClient()
  
  // First, remove player/guest from any existing teams for this booking
  const { data: teams } = await admin.from('teams').select('id, guest_members').eq('booking_id', bookingId)
  
  if (playerId) {
    const teamIds = teams?.map(t => t.id) || []
    if (teamIds.length > 0) {
      await admin.from('team_players').delete().eq('player_id', playerId).in('team_id', teamIds)
    }
  } else if (guestName && rsvpId) {
    for (const t of teams || []) {
      const guests = t.guest_members || []
      const updatedGuests = guests.filter((g: string) => g !== rsvpId && !g.includes(rsvpId))
      if (guests.length !== updatedGuests.length) {
        await admin.from('teams').update({ guest_members: updatedGuests.length > 0 ? updatedGuests : null }).eq('id', t.id)
      }
    }
  }

  // Add to new team if specified
  if (newTeamId) {
    if (playerId) {
      await admin.from('team_players').insert({ team_id: newTeamId, player_id: playerId })
      notifyPlayerOfTeamAssignment(admin, bookingId, groupId, playerId, newTeamId)
    } else if (guestName && rsvpId) {
      const { data: newTeamData } = await admin.from('teams').select('guest_members').eq('id', newTeamId).single()
      const currentGuests = newTeamData?.guest_members || []
      // We will store the rsvpId to uniquely identify the guest in the DB.
      await admin.from('teams').update({ guest_members: [...currentGuests, rsvpId] }).eq('id', newTeamId)
    }
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function rescheduleMatchesAction(bookingId: string, groupId: string) {
  const admin = createAdminClient()
  
  // Delete all goal events related to this schedule first (cascade might not be set up)
  const { data: schedule } = await admin.from('match_schedule').select('id').eq('booking_id', bookingId)
  const scheduleIds = schedule?.map(s => s.id) || []
  if (scheduleIds.length > 0) {
    await admin.from('goal_events').delete().in('match_schedule_id', scheduleIds)
  }

  // Delete existing match_schedule
  await admin.from('match_schedule').delete().eq('booking_id', bookingId)

  // Reset booking status to upcoming if it was ongoing or completed
  await admin.from('bookings').update({ status: 'upcoming' }).eq('id', bookingId)

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function adminRemoveRsvpAction(bookingId: string, groupId: string, rsvpId: string) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: callerMembership } = await admin
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('player_id', user.id)
    .single()

  if (callerMembership?.role !== 'admin') throw new Error('Only admins can remove players')

  const { data: targetRsvp } = await admin.from('rsvps').select('*').eq('id', rsvpId).single()
  if (!targetRsvp) throw new Error('RSVP not found')

  const wasStatus = targetRsvp.status

  // Remove player/guest from any existing teams for this booking
  const { data: teams } = await admin.from('teams').select('id, guest_members').eq('booking_id', bookingId)
  
  if (targetRsvp.player_id) {
    const teamIds = teams?.map(t => t.id) || []
    if (teamIds.length > 0) {
      await admin.from('team_players').delete().eq('player_id', targetRsvp.player_id).in('team_id', teamIds)
    }
  } else if (targetRsvp.guest_name) {
    for (const t of teams || []) {
      const guests = t.guest_members || []
      const updatedGuests = guests.filter((g: string) => g !== rsvpId && !g.includes(rsvpId))
      if (guests.length !== updatedGuests.length) {
        await admin.from('teams').update({ guest_members: updatedGuests.length > 0 ? updatedGuests : null }).eq('id', t.id)
      }
    }
  }

  // Delete guest or update registered player to 'out'
  if (targetRsvp.player_id === null) {
    await admin.from('rsvps').delete().eq('id', rsvpId)
  } else {
    await admin.from('rsvps').update({
      status: 'out',
      waitlist_position: null,
      responded_at: new Date().toISOString()
    }).eq('id', rsvpId)
  }

  // Promote from waitlist if needed
  if (wasStatus === 'in') {
    const { data: currentRsvps } = await admin.from('rsvps').select('*').eq('booking_id', bookingId)
    const waitlisters = currentRsvps?.filter((r: any) => r.status === 'waitlist').sort((a: any, b: any) => (a.waitlist_position || 0) - (b.waitlist_position || 0))
    if (waitlisters && waitlisters.length > 0) {
      const nextInLine = waitlisters[0]
      await admin.from('rsvps').update({ status: 'in', waitlist_position: null }).eq('id', nextInLine.id)
      
      const { data: remainingRsvps } = await admin.from('rsvps').select('*').eq('booking_id', bookingId)
      const remainingWaitlisters = remainingRsvps?.filter((r: any) => r.status === 'waitlist').sort((a: any, b: any) => (a.waitlist_position || 0) - (b.waitlist_position || 0)) || []
      for (let i = 0; i < remainingWaitlisters.length; i++) {
        await admin.from('rsvps').update({ waitlist_position: i + 1 }).eq('id', remainingWaitlisters[i].id)
      }
    }
  } else if (wasStatus === 'waitlist') {
    const { data: currentRsvps } = await admin.from('rsvps').select('*').eq('booking_id', bookingId)
    const waitlisters = currentRsvps?.filter((r: any) => r.status === 'waitlist').sort((a: any, b: any) => (a.waitlist_position || 0) - (b.waitlist_position || 0)) || []
    for (let i = 0; i < waitlisters.length; i++) {
      await admin.from('rsvps').update({ waitlist_position: i + 1 }).eq('id', waitlisters[i].id)
    }
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

async function notifyPlayerOfTeamAssignment(
  admin: any,
  bookingId: string,
  groupId: string,
  playerId: string,
  teamId: string
) {
  try {
    const { data: teamData } = await admin.from('teams').select('name').eq('id', teamId).single()
    const teamName = teamData?.name || 'a team'

    const { data: bookingData } = await admin
      .from('bookings')
      .select('match_date, match_time, groups(name)')
      .eq('id', bookingId)
      .single()

    const { data: profile } = await admin
      .from('profiles')
      .select('push_notif_enabled')
      .eq('id', playerId)
      .single()

    if (profile && profile.push_notif_enabled !== false) {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('id, subscription_json')
        .eq('user_id', playerId)

      if (subs && subs.length > 0) {
        const { sendPushNotification } = await import('@/lib/push/send')
        const { format, parseISO } = await import('date-fns')
        const groupName = (bookingData?.groups as any)?.name || 'Match'
        const dateStr = bookingData?.match_date ? format(parseISO(bookingData.match_date), 'MMM d') : ''
        const timeStr = bookingData?.match_time ? bookingData.match_time.slice(0, 5) : ''
        const matchTimeLabel = dateStr ? ` on ${dateStr} at ${timeStr}` : ''

        await Promise.all(
          subs.map((sub: any) =>
            sendPushNotification(sub.id, sub.subscription_json, {
              title: `👕 Squad Assignment — ${groupName}`,
              body: `You've been assigned to ${teamName}${matchTimeLabel}! Check your lineup.`,
              url: `/groups/${groupId}/match/${bookingId}`
            })
          )
        )
      }
    }
  } catch (err) {
    console.error('Failed to notify player of team assignment:', err)
  }
}

export async function reorderMatchesAction(bookingId: string, groupId: string, matchIdsInOrder: string[]) {
  const admin = createAdminClient()
  
  for (let i = 0; i < matchIdsInOrder.length; i++) {
    await admin
      .from('match_schedule')
      .update({ scheduled_order: i + 1 })
      .eq('id', matchIdsInOrder[i])
      .eq('booking_id', bookingId)
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}
