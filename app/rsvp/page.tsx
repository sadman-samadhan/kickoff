import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { generateRsvpToken } from '@/lib/utils'
import { sendEmail } from '@/lib/email/resend'
import { waitlistPromotionEmail } from '@/lib/email/templates'
import Link from 'next/link'
import { CheckCircle2, XCircle, AlertCircle, Activity } from 'lucide-react'

export default async function RsvpPage({
  searchParams
}: {
  searchParams: { booking: string, player: string, status: string, token: string }
}) {
  const { booking: bookingId, player: playerId, status, token } = searchParams

  if (!bookingId || !playerId || !status || !token) {
    return <ErrorState message="Invalid or missing link parameters." />
  }

  // Verify HMAC token
  const expectedToken = generateRsvpToken(playerId, bookingId)
  if (token !== expectedToken) {
    return <ErrorState message="This link has expired or is invalid." />
  }

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get booking info
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, group_id, max_players, match_date, match_time, field_name, groups(name)')
    .eq('id', bookingId)
    .single()

  if (!booking) return <ErrorState message="Booking not found." />

  // Process RSVP Logic
  const { data: currentRsvp } = await supabaseAdmin
    .from('rsvps')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('player_id', playerId)
    .single()

  const wasIn = currentRsvp?.status === 'in'

  const { data: confirmedRsvps } = await supabaseAdmin
    .from('rsvps')
    .select('*')
    .eq('booking_id', bookingId)
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
        .eq('booking_id', bookingId)
        .eq('status', 'waitlist')
        .order('waitlist_position', { ascending: false })
        .limit(1)
      waitlistPosition = (wlRsvps?.[0]?.waitlist_position || 0) + 1
    }
  }

  // Waitlist Promotion Logic
  if (status === 'out' && wasIn) {
    const { data: firstWaitlist } = await supabaseAdmin
      .from('rsvps')
      .select('player_id, waitlist_position, profiles(full_name, email)')
      .eq('booking_id', bookingId)
      .eq('status', 'waitlist')
      .order('waitlist_position', { ascending: true })
      .limit(1)

    if (firstWaitlist && firstWaitlist.length > 0) {
      const promoted = firstWaitlist[0]

      await supabaseAdmin
        .from('rsvps')
        .update({ status: 'in', waitlist_position: null })
        .eq('booking_id', bookingId)
        .eq('player_id', promoted.player_id)

      if (promoted.profiles?.email && !promoted.profiles.email.endsWith('@kickoff.local')) {
        await sendEmail({
          to: promoted.profiles.email,
          subject: `🎉 You're In! A spot opened up — ${booking.groups?.name}`,
          html: waitlistPromotionEmail({
            playerName: promoted.profiles.full_name?.split(' ')[0] || 'Player',
            groupName: booking.groups?.name,
            matchDate: booking.match_date,
            matchTime: booking.match_time.slice(0, 5),
            fieldName: booking.field_name
          })
        })
      }

      await supabaseAdmin.from('notifications').insert({
        player_id: promoted.player_id,
        booking_id: bookingId,
        group_id: booking.group_id,
        message: `🎉 A spot opened up! You've been added to the squad for ${booking.groups?.name} on ${booking.match_date}`,
        is_read: false
      })
    }
  }

  // Upsert
  await supabaseAdmin
    .from('rsvps')
    .upsert({
      booking_id: bookingId,
      player_id: playerId,
      status: finalStatus,
      waitlist_position: waitlistPosition
    }, { onConflict: 'booking_id,player_id' })


  // Render Success Page
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100 max-w-sm w-full text-center">
        {finalStatus === 'in' ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-black text-neutral-900 mb-2">You&apos;re In!</h1>
            <p className="text-sm text-neutral-600 mb-6">You are officially confirmed for {booking.groups?.name} on {booking.match_date}.</p>
          </>
        ) : finalStatus === 'waitlist' ? (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-xl font-black text-neutral-900 mb-2">You&apos;re on the Waitlist</h1>
            <p className="text-sm text-neutral-600 mb-6">The match is currently full. We&apos;ll email you if a spot opens up! (Position #{waitlistPosition})</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-neutral-600" />
            </div>
            <h1 className="text-xl font-black text-neutral-900 mb-2">Got it!</h1>
            <p className="text-sm text-neutral-600 mb-6">We&apos;ve marked you as unavailable for this match. Maybe next time!</p>
          </>
        )}

        <div className="flex flex-col gap-3">
          <Link href={`/groups/${booking.group_id}/match/${bookingId}`} className="w-full bg-green-600 text-white rounded-xl py-3 font-bold shadow-sm hover:bg-green-700 block">
            View Match Details
          </Link>
          <Link href="/login" className="w-full bg-white border border-neutral-200 text-neutral-700 rounded-xl py-3 font-bold hover:bg-neutral-50 block">
            Login to KickOff
          </Link>
        </div>
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-red-100 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-black text-neutral-900 mb-2">Oops!</h1>
        <p className="text-sm text-neutral-600">{message}</p>
      </div>
    </div>
  )
}
