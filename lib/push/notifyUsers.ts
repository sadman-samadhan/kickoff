/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Sends a web push (and an in-app notification) to a set of users, honouring their push setting.
 * Waits for delivery so a serverless function doesn't stop mid-send.
 */
export async function notifyUsers(
  userIds: string[],
  message: { title: string; body: string; url: string },
  inApp?: { groupId: string; bookingId?: string },
) {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return
  const admin = createAdminClient()

  if (inApp) {
    await admin.from('notifications').insert(
      ids.map((pid) => ({
        player_id: pid,
        group_id: inApp.groupId,
        booking_id: inApp.bookingId ?? null,
        message: `${message.title} — ${message.body}`,
        is_read: false,
      })),
    )
  }

  const { data: profiles } = await admin.from('profiles').select('id, push_notif_enabled').in('id', ids)
  const pushIds = (profiles || []).filter((p: any) => p.push_notif_enabled !== false).map((p: any) => p.id)
  if (pushIds.length === 0) return
  const { data: subs } = await admin.from('push_subscriptions').select('id, subscription_json').in('user_id', pushIds)
  if (!subs?.length) return
  const { sendPushNotification } = await import('@/lib/push/send')
  await Promise.allSettled(subs.map((s: any) => sendPushNotification(s.id, s.subscription_json, message)))
}
