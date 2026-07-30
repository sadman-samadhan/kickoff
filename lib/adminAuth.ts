/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation'

/**
 * Checks whether a given user is a site admin.
 */
export async function isSiteAdminUser(supabaseAdmin: any, userId: string): Promise<boolean> {
  if (!userId) return false
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_site_admin')
    .eq('id', userId)
    .single()

  return profile?.is_site_admin === true
}

/**
 * Server guard that enforces site admin access.
 * Redirects non-site-admins to /dashboard.
 */
export async function requireSiteAdmin(supabase: any, supabaseAdmin: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = await isSiteAdminUser(supabaseAdmin, user.id)
  if (!isAdmin) redirect('/dashboard')

  return user
}
