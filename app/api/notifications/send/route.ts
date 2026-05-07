/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { bookingNotificationEmail } from '@/lib/email/templates'
import { generateRsvpToken } from '@/lib/utils'

export async function POST(req: Request) {
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json()
  const { group_id, booking_id, exclude_player_id } = body

  if (!group_id || !booking_id) {
    return NextResponse.json({ error: 'group_id and booking_id are required' }, { status: 400 })
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from('group_members')
    .select('player_id')
    .eq('group_id', group_id)

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })

  const insertData = members
    .filter(m => m.player_id !== exclude_player_id)
    .map(m => ({
      player_id: m.player_id,
      booking_id: booking_id,
      group_id: group_id,
      message: "You have a new match coming up!",
      is_read: false
    }))

  if (insertData.length === 0) {
    return NextResponse.json({ success: true, count: 0 })
  }

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert(insertData)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch Booking and Group Info for Email
  const { data: bookingData } = await supabaseAdmin
    .from('bookings')
    .select('match_date, match_time, field_name, groups(name)')
    .eq('id', booking_id)
    .single()

  if (bookingData) {
    const groupName = (bookingData.groups as any)?.name || 'Group'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const playerIds = insertData.map(d => d.player_id)
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, email_notifications')
      .in('id', playerIds)

    if (profiles) {
      Promise.all(profiles.map(async (p) => {
        if (p.email && !p.email.endsWith('@kickoff.local') && p.email_notifications !== false) {
          const token = generateRsvpToken(p.id, booking_id)
          const inUrl = `${appUrl}/rsvp?booking=${booking_id}&player=${p.id}&status=in&token=${token}`
          const outUrl = `${appUrl}/rsvp?booking=${booking_id}&player=${p.id}&status=out&token=${token}`

          await sendEmail({
            to: p.email,
            subject: `⚽ New Match Added — ${groupName}`,
            html: bookingNotificationEmail({
              playerName: p.full_name?.split(' ')[0] || 'Player',
              groupName,
              matchDate: bookingData.match_date,
              matchTime: bookingData.match_time.slice(0, 5),
              fieldName: bookingData.field_name,
              inUrl,
              outUrl
            })
          })
        }
      }))
    }
  }

  return NextResponse.json({ success: true, count: data.length })
}
