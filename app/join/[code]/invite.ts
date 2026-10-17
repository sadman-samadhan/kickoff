import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'

export const INVITE_CODE = /^[A-Za-z0-9]{4,32}$/

export type Invite = { id: string; name: string; members: number }

/** The group behind an invite code (name and member count only: this page is public). */
export const loadInvite = cache(async (code: string): Promise<Invite | null> => {
  if (!INVITE_CODE.test(code)) return null
  const admin = createAdminClient()
  const { data: g } = await admin.from('groups').select('id, name').eq('invite_code', code).maybeSingle()
  if (!g) return null
  const { count } = await admin.from('group_members').select('player_id', { count: 'exact', head: true }).eq('group_id', g.id)
  return { id: g.id, name: g.name, members: count ?? 0 }
})
