/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all groups the user is a member of
  const { data: memberships, error: memberError } = await supabase
    .from('group_members')
    .select('group_id, groups(id, name, invite_code)')
    .eq('player_id', user.id)

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  // Build group list with member counts
  const groups = await Promise.all(
    (memberships || []).map(async (m: any) => {
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', m.group_id)
      
      const groupData = Array.isArray(m.groups) ? m.groups[0] : m.groups
      return {
        id: groupData?.id || m.group_id,
        name: groupData?.name || 'Unknown Group',
        member_count: count || 0,
      }
    })
  )

  return NextResponse.json(groups)
}
