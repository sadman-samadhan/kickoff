/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { bookingNotificationEmail } from '@/lib/email/templates'
import { generateRsvpToken } from '@/lib/tokens'
import { appUrl } from '@/lib/utils'

/**
 * Tells every group member (except the creator) about a new match: in-app notification, email with
 * one-tap RSVP links, and web push. Called directly from server code — there is no public endpoint.
 */
export async function notifyNewBooking({
  groupId,
  bookingId,
  excludePlayerId,
}: {
  groupId: string
  bookingId: string
  excludePlayerId?: string
}) {
  const admin = createAdminClient()

  const [{ data: members }, { data: booking }] = await Promise.all([
    admin.from('group_members').select('player_id').eq('group_id', groupId),
    admin.from('bookings').select('match_date, match_time, field_name, group_id, groups(name)').eq('id', bookingId).single(),
  ])
  if (!members || !booking || booking.group_id !== groupId) return

  const playerIds = members.map((m: any) => m.player_id).filter((id: string) => id !== excludePlayerId)
  if (playerIds.length === 0) return

  await admin.from('notifications').insert(
    playerIds.map((pid: string) => ({
      player_id: pid,
      booking_id: bookingId,
      group_id: groupId,
      message: 'You have a new match coming up!',
      is_read: false,
    })),
  )

  const groupName = (booking.groups as any)?.name || 'Group'
  const matchTime = String(booking.match_time || '').slice(0, 5)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email, email_notifications, push_notif_enabled')
    .in('id', playerIds)

  const emails = (profiles || [])
    .filter((p: any) => p.email && !p.email.endsWith('@khelahobe.local') && p.email_notifications !== false)
    .map((p: any) => {
      const token = generateRsvpToken(p.id, bookingId)
      return sendEmail({
        to: p.email,
        subject: `⚽ New Match Added — ${groupName}`,
        html: bookingNotificationEmail({
          playerName: p.full_name?.split(' ')[0] || 'Player',
          groupName,
          matchDate: booking.match_date,
          matchTime,
          fieldName: booking.field_name,
          inUrl: appUrl(`/rsvp?booking=${bookingId}&player=${p.id}&status=in&token=${token}`),
          outUrl: appUrl(`/rsvp?booking=${bookingId}&player=${p.id}&status=out&token=${token}`),
        }),
      })
    })

  const pushIds = (profiles || []).filter((p: any) => p.push_notif_enabled !== false).map((p: any) => p.id)
  const pushes = (async () => {
    if (pushIds.length === 0) return
    const { data: subs } = await admin.from('push_subscriptions').select('id, subscription_json').in('user_id', pushIds)
    if (!subs?.length) return
    const { sendPushNotification } = await import('@/lib/push/send')
    await Promise.all(
      subs.map((sub: any) =>
        sendPushNotification(sub.id, sub.subscription_json, {
          title: `⚽ New Match — ${groupName}`,
          body: `Match scheduled on ${booking.match_date} at ${matchTime} (${booking.field_name}). RSVP now!`,
          url: `/groups/${groupId}`,
        }),
      ),
    )
  })()

  // Wait for delivery so a serverless function doesn't stop mid-send.
  const results = await Promise.allSettled([...emails, pushes])
  results.filter((r) => r.status === 'rejected').forEach((r) => console.error('Booking notification failed:', (r as PromiseRejectedResult).reason))
}
