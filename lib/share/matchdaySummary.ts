/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'

export type MatchdaySummary = {
  bookingId: string
  groupId: string
  group: string
  date: string
  time: string | null
  venue: string | null
  status: string
  playersIn: number
  fixtures: { home: string; homeColor: string | null; away: string; awayColor: string | null; hs: number | null; as: number | null; status: string; stage: string | null }[]
  champion: string | null
  topScorer: { name: string; goals: number } | null
}

const isKnockout = (stage: string | null) => !!stage && /final|semi|quarter|qualifier|eliminator|playoff|3rd|knockout/i.test(stage)

/**
 * Public summary of a matchday for link previews: group, date, venue, team names, scores, champion and top
 * scorer. The same information the share cards show; no member details beyond those names.
 */
export const loadMatchdaySummary = cache(async (bookingId: string): Promise<MatchdaySummary | null> => {
  const admin = createAdminClient()
  const { data: b } = await admin
    .from('bookings')
    .select('id, group_id, match_date, match_time, field_name, status, groups(name)')
    .eq('id', bookingId)
    .maybeSingle()
  if (!b || b.status === 'cancelled') return null
  const [{ data: teams }, { data: schedule }, { count: playersIn }] = await Promise.all([
    admin.from('teams').select('id, name, jersey_color').eq('booking_id', bookingId),
    admin
      .from('match_schedule')
      .select('id, home_team_id, away_team_id, home_score, away_score, status, stage_name, scheduled_order')
      .eq('booking_id', bookingId)
      .order('scheduled_order', { ascending: true }),
    admin.from('rsvps').select('id', { count: 'exact', head: true }).eq('booking_id', bookingId).eq('status', 'in'),
  ])
  const team = new Map((teams || []).map((t: any) => [t.id, t]))
  const matchIds = (schedule || []).map((m: any) => m.id)
  const { data: goals } = matchIds.length
    ? await admin.from('goal_events').select('scorer_id, guest_scorer_name, is_own_goal, profiles!scorer_id(full_name)').in('match_schedule_id', matchIds)
    : { data: [] as any[] }

  // Champion: winner of a completed final, otherwise the league leader once every fixture is done.
  let champion: string | null = null
  const done = (schedule || []).filter((m: any) => m.status === 'completed')
  const final = done.find((m: any) => /^final$|grand final/i.test(m.stage_name || ''))
  if (final && final.home_score !== final.away_score) {
    champion = team.get(final.home_score > final.away_score ? final.home_team_id : final.away_team_id)?.name ?? null
  } else if (schedule?.length && done.length === schedule.length) {
    const table = new Map<string, { pts: number; gd: number; gf: number }>()
    for (const m of done.filter((x: any) => !isKnockout(x.stage_name))) {
      const sides: [string, number, number][] = [
        [m.home_team_id, m.home_score ?? 0, m.away_score ?? 0],
        [m.away_team_id, m.away_score ?? 0, m.home_score ?? 0],
      ]
      for (const [id, f, a] of sides) {
        const r = table.get(id) || { pts: 0, gd: 0, gf: 0 }
        r.pts += f > a ? 3 : f === a ? 1 : 0
        r.gd += f - a
        r.gf += f
        table.set(id, r)
      }
    }
    const best = Array.from(table).sort((x, y) => y[1].pts - x[1].pts || y[1].gd - x[1].gd || y[1].gf - x[1].gf)[0]
    if (best) champion = team.get(best[0])?.name ?? null
  }

  const tally = new Map<string, number>()
  for (const g of goals || []) {
    if (g.is_own_goal) continue
    const name = (g as any).profiles?.full_name || g.guest_scorer_name
    if (name) tally.set(name, (tally.get(name) || 0) + 1)
  }
  const top = Array.from(tally).sort((x, y) => y[1] - x[1])[0]

  return {
    bookingId: b.id,
    groupId: b.group_id,
    group: (b as any).groups?.name || 'KhelaHbe',
    date: b.match_date,
    time: b.match_time ? String(b.match_time).slice(0, 5) : null,
    venue: b.field_name,
    status: b.status,
    playersIn: playersIn ?? 0,
    fixtures: (schedule || []).map((m: any) => ({
      home: team.get(m.home_team_id)?.name || 'TBD',
      homeColor: team.get(m.home_team_id)?.jersey_color || null,
      away: team.get(m.away_team_id)?.name || 'TBD',
      awayColor: team.get(m.away_team_id)?.jersey_color || null,
      hs: m.status === 'scheduled' ? null : m.home_score ?? 0,
      as: m.status === 'scheduled' ? null : m.away_score ?? 0,
      status: m.status,
      stage: m.stage_name,
    })),
    champion,
    topScorer: top ? { name: top[0], goals: top[1] } : null,
  }
})

export { prettyDate, describeMatchday } from './format'
