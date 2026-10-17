import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser, getGroupRole } from '@/lib/groupAuth'
import { loadLiveMatch } from '@/lib/live/state'
import LiveMatchClient from './LiveMatchClient'

export default async function GameDetailsPage({ params }: { params: { groupId: string; bookingId: string; matchId: string } }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const [role, state, { data: booking }] = await Promise.all([
    getGroupRole(params.groupId),
    loadLiveMatch(params.matchId),
    createAdminClient().from('bookings').select('group_id').eq('id', params.bookingId).maybeSingle(),
  ])
  if (!role) redirect('/dashboard')
  // The URL must describe one consistent group → booking → match chain.
  if (!booking || booking.group_id !== params.groupId) redirect(`/groups/${params.groupId}`)
  if (!state || state.match.booking_id !== params.bookingId) redirect(`/groups/${params.groupId}/match/${params.bookingId}`)

  const isAdmin = role === 'admin'
  const isCaptain = [state.home, state.away].some((t) => t?.captain_id === user.id)

  return (
    <LiveMatchClient
      groupId={params.groupId}
      bookingId={params.bookingId}
      initial={state}
      me={user.id}
      isAdmin={isAdmin}
      canLog={isAdmin || isCaptain}
    />
  )
}
