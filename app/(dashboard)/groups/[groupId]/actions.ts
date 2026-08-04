/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addBookingAction(groupId: string, data: any) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Insert booking
  const { data: booking, error } = await supabase.from('bookings').insert({
    group_id: groupId,
    created_by: user.id,
    match_date: data.matchDate,
    match_time: data.matchTime,
    field_name: data.fieldName,
    google_maps_url: data.googleMapsUrl || null,
    max_players: data.maxPlayers || 21,
    status: 'upcoming'
  }).select().single()

  if (error) throw new Error(error.message)

  // Fetch all group members to notify
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://khelahbe.vercel.app/'
  fetch(`${baseUrl}/api/notifications/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      group_id: groupId,
      booking_id: booking.id,
      exclude_player_id: user.id
    })
  }).catch(console.error)

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/groups')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function rsvpAction(bookingId: string, groupId: string, status: string, maxPlayers: number, selectedPosition?: string) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch caller role
  const { data: callerMembership } = await admin
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('player_id', user.id)
    .maybeSingle()
  const isCallerAdmin = callerMembership?.role === 'admin'

  // Fetch current RSVPs with admin client
  const { data: currentRsvps } = await admin.from('rsvps').select('*').eq('booking_id', bookingId)
  
  const inCount = currentRsvps?.filter(r => r.status === 'in').length || 0
  const myRsvp = currentRsvps?.find(r => r.player_id === user.id)

  let finalStatus = status
  let waitlistPosition = null

  if (status === 'in' && inCount >= maxPlayers) {
    if (!myRsvp || myRsvp.status !== 'in') {
      finalStatus = 'waitlist'
      const waitlistCount = currentRsvps?.filter(r => r.status === 'waitlist').length || 0
      waitlistPosition = waitlistCount + 1
    }
  }

  if (status === 'out') {
    // Check if player is assigned to a team in this booking
    const { data: bookingTeams } = await admin.from('teams').select('id, name, captain_id, team_players(*)').eq('booking_id', bookingId)
    if (bookingTeams && bookingTeams.length > 0) {
      const assignedTeam = bookingTeams.find(t => t.team_players?.some((tp: any) => tp.player_id === user.id))
      if (assignedTeam && !isCallerAdmin) {
        throw new Error(`You are already assigned to ${assignedTeam.name}. Please contact your Group Admin to opt out.`)
      }
      if (assignedTeam && isCallerAdmin) {
        // Admin unassigning player from team
        await admin.from('team_players').delete().eq('team_id', assignedTeam.id).eq('player_id', user.id)
        if (assignedTeam.captain_id === user.id) {
          await admin.from('teams').update({ captain_id: null }).eq('id', assignedTeam.id)
        }
      }
    }

    // If I was 'in', move someone from waitlist to 'in'
    if (myRsvp?.status === 'in') {
      const waitlisters = currentRsvps?.filter(r => r.status === 'waitlist').sort((a, b) => (a.waitlist_position || 0) - (b.waitlist_position || 0))
      if (waitlisters && waitlisters.length > 0) {
        const nextInLine = waitlisters[0]
        await admin.from('rsvps').update({ status: 'in', waitlist_position: null }).eq('id', nextInLine.id)
      }
    }
  }

  const payload: any = {
    status: finalStatus,
    waitlist_position: waitlistPosition,
    responded_at: new Date().toISOString()
  }

  if (selectedPosition) {
    payload.selected_position = selectedPosition
  }

  if (myRsvp) {
    let { error } = await admin.from('rsvps').update(payload).eq('id', myRsvp.id)
    if (error && error.message?.includes('selected_position')) {
      delete payload.selected_position
      const retry = await admin.from('rsvps').update(payload).eq('id', myRsvp.id)
      error = retry.error
    }
    if (error) throw new Error(error.message)
  } else {
    payload.booking_id = bookingId
    payload.player_id = user.id
    let { error } = await admin.from('rsvps').insert(payload)
    if (error && error.message?.includes('selected_position')) {
      delete payload.selected_position
      const retry = await admin.from('rsvps').insert(payload)
      error = retry.error
    }
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/groups/${groupId}`)
  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  revalidatePath('/groups')
  revalidatePath('/dashboard')
  return { status: finalStatus, waitlistPosition }
}

export async function makeAdminAction(groupId: string, playerId: string) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify caller is admin (use admin client to bypass RLS)
  const { data: callerMembership } = await admin
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('player_id', user.id)
    .single()

  if (callerMembership?.role !== 'admin') throw new Error('Only admins can promote members')

  const { error } = await admin
    .from('group_members')
    .update({ role: 'admin' })
    .eq('group_id', groupId)
    .eq('player_id', playerId)

  if (error) throw new Error(error.message)

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/groups')
  return { success: true }
}

export async function removeAdminAction(groupId: string, playerId: string) {
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

  if (callerMembership?.role !== 'admin') throw new Error('Only admins can demote members')

  // Cannot demote yourself
  if (playerId === user.id) throw new Error('You cannot remove your own admin role')

  const { error } = await admin
    .from('group_members')
    .update({ role: 'member' })
    .eq('group_id', groupId)
    .eq('player_id', playerId)

  if (error) throw new Error(error.message)

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/groups')
  return { success: true }
}

export async function removeMemberAction(groupId: string, playerId: string) {
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

  if (callerMembership?.role !== 'admin') throw new Error('Only admins can remove members')

  // Cannot remove yourself
  if (playerId === user.id) throw new Error('You cannot remove yourself from the group')

  const { error } = await admin
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('player_id', playerId)

  if (error) throw new Error(error.message)

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/groups')
  return { success: true }
}

export async function leaveGroupAction(groupId: string) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Prevent leaving if last admin — use admin client to get accurate member list
  const { data: members } = await admin
    .from('group_members')
    .select('role, player_id')
    .eq('group_id', groupId)

  const me = members?.find(m => m.player_id === user.id)
  if (!me) throw new Error('Not a member')

  if (me.role === 'admin') {
    const otherAdmins = members?.filter(m => m.role === 'admin' && m.player_id !== user.id)
    if (!otherAdmins || otherAdmins.length === 0) {
      throw new Error('You must make someone else an admin before leaving')
    }
  }

  const { error } = await admin
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('player_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath('/groups')
  return { success: true }
}

export async function deleteGroupAction(groupId: string) {
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

  if (callerMembership?.role !== 'admin') throw new Error('Only admins can delete the group')

  // Delete all related data first (cascading may not be set up)
  await admin.from('group_members').delete().eq('group_id', groupId)
  await admin.from('bookings').delete().eq('group_id', groupId)
  await admin.from('notifications').delete().eq('group_id', groupId)

  const { error } = await admin
    .from('groups')
    .delete()
    .eq('id', groupId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath('/groups')
  return { success: true }
}

export async function updateGroupScoringSettingsAction(groupId: string, settings: any) {
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

  if (callerMembership?.role !== 'admin') throw new Error('Only admins can edit scoring settings')

  const { error } = await admin
    .from('groups')
    .update({ custom_scoring_settings: settings })
    .eq('id', groupId)

  if (error) throw new Error(error.message)

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/dashboard')
  return { success: true }
}
