'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/groupAuth'
import { INVITE_CODE } from './invite'

/** Joins the signed-in user to the group behind an invite link (after they confirm). */
export async function joinGroupByInvite(code: string): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
  const user = await getAuthUser()
  if (!user) return { ok: false, error: 'Please sign in first' }
  if (!INVITE_CODE.test(code)) return { ok: false, error: 'This invite link is not valid' }

  const admin = createAdminClient()
  const [{ data: group }, { data: profile }] = await Promise.all([
    admin.from('groups').select('id').eq('invite_code', code).maybeSingle(),
    admin.from('profiles').select('is_suspended').eq('id', user.id).maybeSingle(),
  ])
  if (!group) return { ok: false, error: 'This invite link is no longer valid. Ask for a new one.' }
  if (profile?.is_suspended) return { ok: false, error: 'Your account is suspended, so you can’t join groups right now.' }

  const { error } = await admin.from('group_members').insert({ group_id: group.id, player_id: user.id, role: 'member' })
  // 23505 = already a member: that's fine, just take them to the group.
  if (error && error.code !== '23505') return { ok: false, error: 'Could not join the group. Please try again.' }

  revalidatePath('/groups')
  revalidatePath('/dashboard')
  return { ok: true, groupId: group.id }
}
