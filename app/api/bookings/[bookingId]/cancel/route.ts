/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { matchCancellationEmail } from '@/lib/email/templates'
import { AuthError, requireBookingAdminOrCreator } from '@/lib/groupAuth'

export async function POST(req: Request, { params }: { params: { bookingId: string } }) {
  const body = await req.json().catch(() => ({}))
  const { reason } = body
  const { bookingId } = params

  // Only admins or the match creator may cancel. The group comes from the booking row, not the request.
  let supabaseAdmin: any
  let groupId: string
  try {
    const auth = await requireBookingAdminOrCreator(bookingId, body.groupId || undefined)
    supabaseAdmin = auth.admin
    groupId = auth.groupId
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500
    return NextResponse.json({ error: (e as Error).message }, { status })
  }

  const cancelReason = reason || 'No reason provided'

  // Update booking status to cancelled
  // Assuming the user has added cancellation_reason column to bookings table
  let { data: booking, error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled', cancellation_reason: cancelReason } as any)
    .eq('id', bookingId)
    .select('*, groups(name)')
    .single()

  if (updateError) {
    // Fallback if the column doesn't exist yet
    const fallback = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .select('*, groups(name)')
      .single()
    booking = fallback.data
    updateError = fallback.error
  }

  if (updateError || !booking) {
    return NextResponse.json({ error: updateError?.message || 'Failed to cancel booking' }, { status: 500 })
  }

  // Fetch all members of the group
  const { data: members, error: membersError } = await supabaseAdmin
    .from('group_members')
    .select('player_id')
    .eq('group_id', groupId)

  if (membersError || !members) {
    return NextResponse.json({ error: membersError?.message || 'Failed to fetch members' }, { status: 500 })
  }

  // Insert notifications
  const insertData = members.map((m: any) => ({
    player_id: m.player_id,
    booking_id: bookingId,
    group_id: groupId,
    message: `The match scheduled at ${booking.field_name} on ${booking.match_date} has been cancelled. Reason: ${cancelReason}`,
    is_read: false
  }))

  if (insertData.length > 0) {
    await supabaseAdmin.from('notifications').insert(insertData)
  }

  // Send Emails
  const playerIds = members.map((m: any) => m.player_id)
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, email_notifications')
    .in('id', playerIds)

  const groupName = (booking.groups as any)?.name || 'Group'

  if (profiles) {
    Promise.all(profiles.map(async (p: any) => {
      if (p.email && !p.email.endsWith('@khelahobe.local') && p.email_notifications !== false) {
        await sendEmail({
          to: p.email,
          subject: `❌ Match Cancelled — ${groupName}`,
          html: matchCancellationEmail({
            playerName: p.full_name?.split(' ')[0] || 'Player',
            groupName,
            matchDate: booking.match_date,
            matchTime: booking.match_time.slice(0, 5),
            fieldName: booking.field_name,
            reason: cancelReason
          })
        })
      }
    }))
  }

  return NextResponse.json({ success: true })
}
