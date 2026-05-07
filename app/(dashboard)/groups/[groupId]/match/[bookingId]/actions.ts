'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveTeamsAction(bookingId: string, groupId: string, teamsData: any[]) {
  const supabase = createClient()
  
  for (const team of teamsData) {
    const { data: newTeam, error: teamError } = await supabase.from('teams').insert({
      booking_id: bookingId,
      name: team.name || 'Team',
      jersey_color: team.jerseyColor || '#ffffff',
      captain_id: team.captainId || null
    }).select().single()

    if (teamError) throw new Error(teamError.message)

    if (team.captainId) {
      await supabase.from('team_players').insert({
        team_id: newTeam.id,
        player_id: team.captainId
      })
    }
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function generateScheduleAction(bookingId: string, groupId: string, teams: any[], scheduleType: string) {
  const supabase = createClient()

  let matches = []
  let order = 1

  if (teams.length >= 2) {
    matches.push({ home_team_id: teams[0].id, away_team_id: teams[1].id, scheduled_order: order++, leg: 1 })
    if (scheduleType.includes('2-Leg') || scheduleType.includes('2-leg')) {
      matches.push({ home_team_id: teams[1].id, away_team_id: teams[0].id, scheduled_order: order++, leg: 2 })
    }
    
    if (teams.length >= 3) {
      matches.push({ home_team_id: teams[1].id, away_team_id: teams[2].id, scheduled_order: order++, leg: 1 })
      matches.push({ home_team_id: teams[2].id, away_team_id: teams[0].id, scheduled_order: order++, leg: 1 })
      
      if (scheduleType.includes('2-Leg') || scheduleType.includes('2-leg')) {
        matches.push({ home_team_id: teams[2].id, away_team_id: teams[1].id, scheduled_order: order++, leg: 2 })
        matches.push({ home_team_id: teams[0].id, away_team_id: teams[2].id, scheduled_order: order++, leg: 2 })
      }
    }
  }

  for (const match of matches) {
    await supabase.from('match_schedule').insert({
      booking_id: bookingId,
      ...match,
      status: 'scheduled'
    })
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}

export async function updateMatchScoreAction(groupId: string, bookingId: string, matchScheduleId: string, homeScore: number, awayScore: number, status: string, goalEvents: any[]) {
  const supabase = createClient()
  
  await supabase.from('match_schedule').update({
    home_score: homeScore,
    away_score: awayScore,
    status
  }).eq('id', matchScheduleId)

  // Insert goal events if any
  if (goalEvents && goalEvents.length > 0) {
    const formattedGoals = goalEvents.map(g => ({
      match_schedule_id: matchScheduleId,
      scorer_id: g.scorerId,
      assist_id: g.assistId || null,
      team_id: g.teamId,
      is_own_goal: g.isOwnGoal || false,
      minute: g.minute || null
    }))
    await supabase.from('goal_events').insert(formattedGoals)
  }

  // Check if all matches in schedule are completed, then complete booking
  const { data: schedule } = await supabase.from('match_schedule').select('status').eq('booking_id', bookingId)
  const allCompleted = schedule?.every(s => s.status === 'completed')
  if (allCompleted) {
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId)
  } else if (status === 'ongoing') {
    await supabase.from('bookings').update({ status: 'ongoing' }).eq('id', bookingId)
  }

  revalidatePath(`/groups/${groupId}/match/${bookingId}`)
  return { success: true }
}
