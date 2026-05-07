'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function joinGroupAction(inviteCode: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  // Clean the invite code
  let code = inviteCode.trim()
  if (code.includes('/')) {
    code = code.split('/').pop() || code
  }

  // Look up group using admin client to bypass RLS
  const { data: group, error: groupError } = await supabaseAdmin
    .from('groups')
    .select('id')
    .eq('invite_code', code)
    .single()

  if (groupError || !group) {
    throw new Error('Invalid or expired invite code')
  }

  // Insert member using regular client
  const { error: joinError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      player_id: user.id,
      role: 'member'
    })

  if (joinError && joinError.code !== '23505') { // Ignore unique constraint if already member
    throw new Error(joinError.message || 'Failed to join group')
  }

  return { success: true, groupId: group.id }
}

export async function createGroupAction(name: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name,
      created_by: user.id
    })
    .select()
    .single()

  if (groupError) throw new Error(groupError.message)

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      player_id: user.id,
      role: 'admin'
    })

  if (memberError) throw new Error(memberError.message)

  return { success: true, group }
}
