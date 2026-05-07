/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MatchHistoryClient from './MatchHistoryClient'

export default async function MatchHistoryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: groups } = await supabase
    .from('group_members')
    .select('groups(id, name)')
    .eq('player_id', user.id)

  const groupOptions = groups?.map(g => g.groups).filter(g => g !== null) || []

  return (
    <div className="pb-24">
      <MatchHistoryClient userId={user.id} groupOptions={groupOptions as any[]} />
    </div>
  )
}
