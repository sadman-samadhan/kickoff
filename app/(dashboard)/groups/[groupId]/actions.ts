/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
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
  const { data: members } = await supabase.from('group_members').select('player_id').eq('group_id', groupId)
  
  if (members) {
    const notifications = members
      .filter(m => m.player_id !== user.id)
      .map(m => ({
        player_id: m.player_id,
        booking_id: booking.id,
        group_id: groupId,
        message: `New match scheduled at ${data.fieldName} on ${data.matchDate}`
      }))
    
    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications)
    }
  }

  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}

export async function rsvpAction(bookingId: string, groupId: string, status: string, maxPlayers: number) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch current RSVPs
  const { data: currentRsvps } = await supabase.from('rsvps').select('*').eq('booking_id', bookingId)
  
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
    // If I was 'in', move someone from waitlist to 'in'
    if (myRsvp?.status === 'in') {
      const waitlisters = currentRsvps?.filter(r => r.status === 'waitlist').sort((a, b) => (a.waitlist_position || 0) - (b.waitlist_position || 0))
      if (waitlisters && waitlisters.length > 0) {
        const nextInLine = waitlisters[0]
        await supabase.from('rsvps').update({ status: 'in', waitlist_position: null }).eq('id', nextInLine.id)
      }
    }
  }

  if (myRsvp) {
    await supabase.from('rsvps').update({ 
      status: finalStatus, 
      waitlist_position: waitlistPosition, 
      responded_at: new Date().toISOString() 
    }).eq('id', myRsvp.id)
  } else {
    await supabase.from('rsvps').insert({
      booking_id: bookingId,
      player_id: user.id,
      status: finalStatus,
      waitlist_position: waitlistPosition,
      responded_at: new Date().toISOString()
    })
  }

  revalidatePath(`/groups/${groupId}`)
  return { status: finalStatus, waitlistPosition }
}
