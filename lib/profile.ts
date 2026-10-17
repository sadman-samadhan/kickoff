/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/groupAuth'

/** Columns that must never be sent to a browser. */
const PRIVATE_COLUMNS = ['security_answer'] as const

export function withoutPrivateFields<T extends Record<string, any> | null>(profile: T): T {
  if (!profile) return profile
  const copy: Record<string, any> = { ...profile }
  for (const c of PRIVATE_COLUMNS) delete copy[c]
  return copy as T
}

/** The signed-in user's own profile, fetched once per request and safe to pass to client components. */
export const getMyProfile = cache(async () => {
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await createAdminClient().from('profiles').select('*').eq('id', user.id).maybeSingle()
  return withoutPrivateFields(data)
})
