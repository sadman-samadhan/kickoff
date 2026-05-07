/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroupsClient from './GroupsClient'

export default async function GroupsPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userGroupsData } = await supabase
    .from('group_members')
    .select('group_id, role, groups(*)')
    .eq('player_id', user.id)

  const groupIds = userGroupsData?.map(g => g.group_id) || []

  let memberCounts: Record<string, number> = {}
  let allBookings: any[] = []

  if (groupIds.length > 0) {
    const { data: allMembers } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds)
      
    allMembers?.forEach(gm => {
      memberCounts[gm.group_id] = (memberCounts[gm.group_id] || 0) + 1
    })

    const { data: bData } = await supabase
      .from('bookings')
      .select('*, rsvps(*)')
      .in('group_id', groupIds)
      .eq('status', 'upcoming')
      .order('match_date', { ascending: true })
      
    allBookings = bData || []
  }

  const groupsPayload = (userGroupsData || []).map((ug: any) => {
    const group = ug.groups
    const groupBookings = allBookings.filter(b => b.group_id === group.id)
    const nextMatch = groupBookings[0] || null
    let rsvpStatus = 'none'
    
    if (nextMatch) {
      const myRsvp = nextMatch.rsvps.find((r: any) => r.player_id === user.id)
      rsvpStatus = myRsvp ? myRsvp.status : 'none'
    }

    return {
      ...group,
      role: ug.role,
      memberCount: memberCounts[group.id] || 0,
      nextMatch: nextMatch ? {
        id: nextMatch.id,
        date: nextMatch.match_date,
        time: nextMatch.match_time,
        rsvp: rsvpStatus
      } : null
    }
  })

  // Sort groups: admin first, then by name
  groupsPayload.sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1
    if (a.role !== 'admin' && b.role === 'admin') return 1
    return a.name.localeCompare(b.name)
  })

  return <GroupsClient initialGroups={groupsPayload} />
}
