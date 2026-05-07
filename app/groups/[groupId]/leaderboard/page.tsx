import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeaderboardClient from './LeaderboardClient'

export default async function LeaderboardPage({ params }: { params: { groupId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verify group membership
  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', params.groupId)
    .eq('player_id', user.id)
    .single()

  if (!member) redirect('/dashboard')

  // Fetch group name
  const { data: group } = await supabase
    .from('groups')
    .select('name')
    .eq('id', params.groupId)
    .single()

  return (
    <LeaderboardClient groupId={params.groupId} groupName={group?.name || 'Group'} />
  )
}
