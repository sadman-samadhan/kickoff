/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireSiteAdmin } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'

/**
 * Toggle User Suspension Status (Suspend or Unsuspend user).
 * Inserts in-app notification and attempts email dispatch.
 */
export async function toggleUserSuspensionAction(
  targetUserId: string,
  suspend: boolean,
  reason?: string
) {
  const supabase = createClient()
  const supabaseAdmin = createAdminClient()
  await requireSiteAdmin(supabase, supabaseAdmin)

  // 1. Update is_suspended column on profiles
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_suspended: suspend })
    .eq('id', targetUserId)

  if (error) throw new Error(`Failed to update user suspension: ${error.message}`)

  // 2. Insert In-App Notification for target user
  const notifMessage = suspend
    ? `⚠️ Your account has been suspended by Site Administration.${reason ? ` Reason: ${reason}` : ''}`
    : `✅ Your account suspension has been lifted by Site Administration.`

  await supabaseAdmin.from('notifications').insert({
    player_id: targetUserId,
    message: notifMessage,
    is_read: false
  })

  // 3. Attempt email notification if Resend / email system is available
  try {
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', targetUserId)
      .single()

    if (targetProfile?.email && process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'KhelaHobe Admin <notifications@khelahbe.vercel.app>',
        to: targetProfile.email,
        subject: suspend ? 'Account Suspended - KhelaHobe' : 'Account Reinstated - KhelaHobe',
        html: `<p>Hello ${targetProfile.full_name || 'Player'},</p><p>${notifMessage}</p><p>Regards,<br>KhelaHobe Team</p>`
      })
    }
  } catch (e) {
    console.error('Email notification failed (non-fatal):', e)
  }

  revalidatePath('/admin')
  return { success: true }
}

/**
 * Create a Platform-Wide System Broadcast.
 * Posts announcement and sends notifications to all users.
 */
export async function createSystemBroadcastAction(title: string, message: string) {
  const supabase = createClient()
  const supabaseAdmin = createAdminClient()
  const user = await requireSiteAdmin(supabase, supabaseAdmin)

  if (!title.trim() || !message.trim()) {
    throw new Error('Title and message are required')
  }

  // 1. Insert into system_broadcasts table
  const { data: broadcast, error } = await supabaseAdmin
    .from('system_broadcasts')
    .insert({
      title: title.trim(),
      message: message.trim(),
      created_by: user.id
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create broadcast: ${error.message}`)

  // 2. Insert notification into notifications table for all users
  const { data: allUsers } = await supabaseAdmin.from('profiles').select('id')
  if (allUsers && allUsers.length > 0) {
    const notifications = allUsers.map((u: any) => ({
      player_id: u.id,
      message: `📢 ANNOUNCEMENT: ${title.trim()} - ${message.trim()}`,
      is_read: false
    }))
    await supabaseAdmin.from('notifications').insert(notifications)
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { success: true, broadcast }
}

/**
 * Record user dismissal of a system broadcast popup banner.
 */
export async function dismissBroadcastAction(broadcastId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const supabaseAdmin = createAdminClient()
  await supabaseAdmin.from('broadcast_dismissals').upsert({
    user_id: user.id,
    broadcast_id: broadcastId
  }, { onConflict: 'user_id,broadcast_id' })

  return { success: true }
}

/**
 * Save or Update a Turf Field.
 */
export async function saveFieldAction(fieldData: {
  id?: string
  name: string
  google_maps_url?: string | null
}) {
  const supabase = createClient()
  const supabaseAdmin = createAdminClient()
  const user = await requireSiteAdmin(supabase, supabaseAdmin)

  if (!fieldData.name.trim()) throw new Error('Field name is required')

  if (fieldData.id) {
    const { error } = await supabaseAdmin
      .from('fields')
      .update({
        name: fieldData.name.trim(),
        google_maps_url: fieldData.google_maps_url ? fieldData.google_maps_url.trim() : null
      })
      .eq('id', fieldData.id)

    if (error) throw new Error(`Failed to update field: ${error.message}`)
  } else {
    const { error } = await supabaseAdmin
      .from('fields')
      .insert({
        name: fieldData.name.trim(),
        google_maps_url: fieldData.google_maps_url ? fieldData.google_maps_url.trim() : null,
        created_by: user.id
      })

    if (error) throw new Error(`Failed to create field: ${error.message}`)
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Delete a Turf Field.
 */
export async function deleteFieldAction(fieldId: string) {
  const supabase = createClient()
  const supabaseAdmin = createAdminClient()
  await requireSiteAdmin(supabase, supabaseAdmin)

  const { error } = await supabaseAdmin
    .from('fields')
    .delete()
    .eq('id', fieldId)

  if (error) throw new Error(`Failed to delete field: ${error.message}`)

  revalidatePath('/admin')
  return { success: true }
}
