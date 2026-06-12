/* eslint-disable @typescript-eslint/no-explicit-any */
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'

let isConfigured = false

function configureWebPush() {
  if (isConfigured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    console.warn('VAPID keys are missing. Push notifications cannot be sent.')
    return
  }
  webpush.setVapidDetails(
    'mailto:sakib.samadhan@gmail.com',
    publicKey,
    privateKey
  )
  isConfigured = true
}

interface PushPayload {
  title: string
  body: string
  url?: string
}

export async function sendPushNotification(subscriptionId: string, subscriptionJson: any, payload: PushPayload) {
  configureWebPush()
  if (!isConfigured) return

  try {
    await webpush.sendNotification(
      subscriptionJson,
      JSON.stringify(payload)
    )
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Clean up invalid subscriptions
      const admin = createAdminClient()
      await admin.from('push_subscriptions').delete().eq('id', subscriptionId)
    } else {
      console.error('Failed to send push notification:', error)
    }
  }
}
