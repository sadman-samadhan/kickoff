/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireSiteAdmin } from '@/lib/adminAuth'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = createClient()
  const supabaseAdmin = createAdminClient()

  // Guard: Must be site admin
  const user = await requireSiteAdmin(supabase, supabaseAdmin)

  // 1. Fetch Users
  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // 2. Fetch Groups
  const { data: groups } = await supabaseAdmin
    .from('groups')
    .select('*, group_members(id)')
    .order('created_at', { ascending: false })

  // 3. Fetch Match Bookings
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('id')

  // 4. Fetch Turf Fields
  const { data: fields } = await supabaseAdmin
    .from('fields')
    .select('*')
    .order('name', { ascending: true })

  // 5. Fetch System Broadcasts
  const { data: broadcasts } = await supabaseAdmin
    .from('system_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })

  const stats = {
    totalUsers: users?.length || 0,
    totalGroups: groups?.length || 0,
    totalBookings: bookings?.length || 0,
    totalFields: fields?.length || 0,
  }

  return (
    <AdminClient
      stats={stats}
      users={users || []}
      groups={groups || []}
      fields={fields || []}
      broadcasts={broadcasts || []}
      currentUserId={user.id}
    />
  )
}
