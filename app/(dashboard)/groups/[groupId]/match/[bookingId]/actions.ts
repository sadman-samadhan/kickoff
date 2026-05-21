/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveTeamsAction(bookingId: string, groupId: string, teamsData: any[]) {
  const admin = createAdminClient()
  
  for (const team of teamsData) {
    const realCaptainId = (team.captainId && !team.captainId.startsWith('guest_')) ? team.captainId : null
    const guestNames = (team.playerIds || [])
      .filter((id: string) => id.startsWith('guest_'))
      .map((id: string) => {
        const rsvpId = id.replace('guest_', '')
        return team.captainId === id ? `${team.guestNames?.[rsvpId] || id} (C)` : (team.guestNames?.[rsvpId] || rsvpId)
      })

    const { data: newTeam, error: teamError } = await admin.from('teams').insert({
      booking_id: bookingId,
      name: team.name || 'Team',
      jersey_color: team.jerseyColor || '#ffffff',
      captain_id: realCaptainId,
      guest_members: guestNames.length > 0 ? guestNames : null
    }).select().single()

    if (teamError) throw new Error(teamError.message)

    const playerIds = new Set<string>()
    if (realCaptainId) playerIds.add(realCaptainId)
    ;(team.playerIds || []).filter((id: string) => !id.startsWith('guest_')).forEach((id: string) => playerIds.add(id))

    if (playerIds.size > 0) {
      await admin.from('team_players').insert(Array.from(playerIds).map(pid => ({ team_id: newTeam.id, player_id: pid })))
    }
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function updateTeamAction(teamId: string, bookingId: string, groupId: string, data: { name: string, jerseyColor: string, captainId: string, playerIds: string[], guestNames?: Record<string, string> }) {
  const admin = createAdminClient()
  const realCaptainId = (data.captainId && !data.captainId.startsWith('guest_')) ? data.captainId : null
  const guestNames = (data.playerIds || [])
    .filter((id: string) => id.startsWith('guest_'))
    .map((id: string) => {
      const rsvpId = id.replace('guest_', '')
      return data.guestNames?.[rsvpId] || rsvpId
    })

  await admin.from('teams').update({
    name: data.name,
    jersey_color: data.jerseyColor,
    captain_id: realCaptainId,
    guest_members: guestNames.length > 0 ? guestNames : null
  }).eq('id', teamId)

  await admin.from('team_players').delete().eq('team_id', teamId)
  const realPlayerIds = new Set<string>()
  if (realCaptainId) realPlayerIds.add(realCaptainId)
  ;(data.playerIds || []).filter((id: string) => !id.startsWith('guest_')).forEach((id: string) => realPlayerIds.add(id))
  if (realPlayerIds.size > 0) {
    await admin.from('team_players').insert(Array.from(realPlayerIds).map(pid => ({ team_id: teamId, player_id: pid })))
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

  let matches = []
  let order = 1
  const is2Leg = scheduleType.includes('2-Leg') || scheduleType.includes('2-leg');

  if (teams.length === 2) {
    matches.push({ home_team_id: teams[0].id, away_team_id: teams[1].id, scheduled_order: order++, leg: 1 });
    if (is2Leg) matches.push({ home_team_id: teams[1].id, away_team_id: teams[0].id, scheduled_order: order++, leg: 2 });
  } else if (teams.length === 3) {
    // 1v2, 1v3, 2v3
    matches.push({ home_team_id: teams[0].id, away_team_id: teams[1].id, scheduled_order: order++, leg: 1 });
    matches.push({ home_team_id: teams[0].id, away_team_id: teams[2].id, scheduled_order: order++, leg: 1 });
    matches.push({ home_team_id: teams[1].id, away_team_id: teams[2].id, scheduled_order: order++, leg: 1 });
    if (is2Leg) {
      // 2v1, 3v1, 3v2
      matches.push({ home_team_id: teams[1].id, away_team_id: teams[0].id, scheduled_order: order++, leg: 2 });
      matches.push({ home_team_id: teams[2].id, away_team_id: teams[0].id, scheduled_order: order++, leg: 2 });
      matches.push({ home_team_id: teams[2].id, away_team_id: teams[1].id, scheduled_order: order++, leg: 2 });
    }
  } else if (teams.length === 4) {
    // 1v2, 3v4, 1v3, 2v4, 1v4, 2v3
    matches.push({ home_team_id: teams[0].id, away_team_id: teams[1].id, scheduled_order: order++, leg: 1 });
    matches.push({ home_team_id: teams[2].id, away_team_id: teams[3].id, scheduled_order: order++, leg: 1 });
    matches.push({ home_team_id: teams[0].id, away_team_id: teams[2].id, scheduled_order: order++, leg: 1 });
    matches.push({ home_team_id: teams[1].id, away_team_id: teams[3].id, scheduled_order: order++, leg: 1 });
    matches.push({ home_team_id: teams[0].id, away_team_id: teams[3].id, scheduled_order: order++, leg: 1 });
    matches.push({ home_team_id: teams[1].id, away_team_id: teams[2].id, scheduled_order: order++, leg: 1 });
    if (is2Leg) {
      // 2v1, 4v3, 3v1, 4v2, 4v1, 3v2
      matches.push({ home_team_id: teams[1].id, away_team_id: teams[0].id, scheduled_order: order++, leg: 2 });
      matches.push({ home_team_id: teams[3].id, away_team_id: teams[2].id, scheduled_order: order++, leg: 2 });
      matches.push({ home_team_id: teams[2].id, away_team_id: teams[0].id, scheduled_order: order++, leg: 2 });
      matches.push({ home_team_id: teams[3].id, away_team_id: teams[1].id, scheduled_order: order++, leg: 2 });
      matches.push({ home_team_id: teams[3].id, away_team_id: teams[0].id, scheduled_order: order++, leg: 2 });
      matches.push({ home_team_id: teams[2].id, away_team_id: teams[1].id, scheduled_order: order++, leg: 2 });
    }
  } else {
    for (let i=0; i<teams.length; i++) {
      for (let j=i+1; j<teams.length; j++) {
        matches.push({ home_team_id: teams[i].id, away_team_id: teams[j].id, scheduled_order: order++, leg: 1 });
      }
    }
    if (is2Leg) {
      for (let i=0; i<teams.length; i++) {
        for (let j=i+1; j<teams.length; j++) {
          matches.push({ home_team_id: teams[j].id, away_team_id: teams[i].id, scheduled_order: order++, leg: 2 });
        }
      }
    }
  }

  for (const match of matches) {
    await supabase.from('match_schedule').insert({
      booking_id: bookingId,
      ...match,
      status: 'scheduled'
    })
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function updateMatchScoreAction(groupId: string, bookingId: string, matchScheduleId: string, homeScore: number, awayScore: number, status: string, goalEvents: any[]) {
  const supabase = createClient()
  
  await supabase.from('match_schedule').update({
    home_score: homeScore,
    away_score: awayScore,
    status
  }).eq('id', matchScheduleId)

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

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function adminAddRsvpAction(bookingId: string, groupId: string, playerId: string, maxPlayers: number) {
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

  if (existingRsvp) {
    await admin.from('rsvps').update({ 
      status: finalStatus, 
      waitlist_position: waitlistPosition, 
      responded_at: new Date().toISOString() 
    }).eq('id', existingRsvp.id)
  } else {
    await admin.from('rsvps').insert({
      booking_id: bookingId,
      player_id: playerId,
      status: finalStatus,
      waitlist_position: waitlistPosition,
      responded_at: new Date().toISOString()
    })
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
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
  return { success: true }
}
