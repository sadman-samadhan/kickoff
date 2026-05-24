/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { waitlistPromotionEmail } from '@/lib/email/templates'

export async function POST(req: Request) {
  const supabaseAuth = createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { booking_id, status } = await req.json()
  if (!booking_id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, group_id, max_players, match_date, match_time, field_name, groups(name)')
    .eq('id', booking_id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const { data: currentRsvp } = await supabaseAdmin
    .from('rsvps')
    .select('*')
    .eq('booking_id', booking_id)
    .eq('player_id', user.id)
    .single()

  const wasIn = currentRsvp?.status === 'in'

  const { data: confirmedRsvps } = await supabaseAdmin
    .from('rsvps')
    .select('*')
    .eq('booking_id', booking_id)
    .eq('status', 'in')

  const currentCount = confirmedRsvps?.length || 0
  const maxPlayers = booking.max_players

  let finalStatus = status
  let waitlistPosition = null

  if (status === 'in' && !wasIn) {
    if (currentCount >= maxPlayers) {
      finalStatus = 'waitlist'
      const { data: wlRsvps } = await supabaseAdmin
        .from('rsvps')
        .select('waitlist_position')
        .eq('booking_id', booking_id)
        .eq('status', 'waitlist')
        .order('waitlist_position', { ascending: false })
        .limit(1)
      waitlistPosition = (wlRsvps?.[0]?.waitlist_position || 0) + 1
    }
  }

  // Handle Drop Out -> Promote from waitlist
  if (status === 'out' && wasIn) {
    const { data: firstWaitlist } = await supabaseAdmin
      .from('rsvps')
      .select('player_id, waitlist_position, profiles(full_name, email, email_notifications)')
      .eq('booking_id', booking_id)
      .eq('status', 'waitlist')
      .order('waitlist_position', { ascending: true })
      .limit(1)

    if (firstWaitlist && firstWaitlist.length > 0) {
      const promoted = firstWaitlist[0]

      await supabaseAdmin
        .from('rsvps')
        .update({ status: 'in', waitlist_position: null })
        .eq('booking_id', booking_id)
        .eq('player_id', promoted.player_id)

      if ((promoted.profiles as any)?.email && !(promoted.profiles as any).email.endsWith('@khelahobe.local') && (promoted.profiles as any).email_notifications !== false) {
        await sendEmail({
          to: (promoted.profiles as any).email,
          subject: `🎉 You're In! A spot opened up — ${(booking.groups as any)?.name}`,
          html: waitlistPromotionEmail({
            playerName: (promoted.profiles as any).full_name?.split(' ')[0] || 'Player',
            groupName: (booking.groups as any)?.name,
            matchDate: booking.match_date,
            matchTime: booking.match_time.slice(0, 5),
            fieldName: booking.field_name
          })
        })
      }

      await supabaseAdmin.from('notifications').insert({
        player_id: promoted.player_id,
        booking_id: booking_id,
        group_id: booking.group_id,
        message: `🎉 A spot opened up! You've been added to the squad for ${(booking.groups as any)?.name} on ${booking.match_date}`,
        is_read: false
      })
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from('rsvps')
    .upsert({
      booking_id,
      player_id: user.id,
      status: finalStatus,
      waitlist_position: waitlistPosition
    }, { onConflict: 'booking_id,player_id' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: newConfirmed } = await supabaseAdmin
    .from('rsvps')
    .select('*')
    .eq('booking_id', booking_id)
    .eq('status', 'in')

  return NextResponse.json({ rsvp: updated[0], count: newConfirmed?.length || 0 })
}
