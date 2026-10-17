/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { requireBookingAdmin } from '@/lib/groupAuth'
import { assertNoOpenAuction } from '@/lib/auction/guards'
import { computeRatings, BASE_RATING, type MatchResult } from '@/lib/teamBalance/rating'
import { balanceTeams, type BalancePlayer } from '@/lib/teamBalance/balance'

export type AutoTeamPlayer = { id: string; name: string; position: string | null; strength: number; matches: number; isGuest: boolean }
export type AutoTeamsProposal = {
  teams: { players: AutoTeamPlayer[]; avgStrength: number }[]
  spread: number
  matchesUsed: number
  ratedPlayers: number
}

const normPos = (p: string | null | undefined) => (p && ['GK', 'DEF', 'MID', 'ATT'].includes(p) ? p : null)

/**
 * Suggests balanced teams for a matchday from the confirmed players. Strength comes from a rating learned
 * from this group's finished matches (lib/teamBalance/rating.ts); new players and guests start at average.
 * Nothing is saved — the admin reviews, swaps and then saves with saveTeamsAction.
 */
export async function proposeAutoTeams(bookingId: string, groupId: string, numTeams: number, seed: number): Promise<{ ok: true; data: AutoTeamsProposal } | { ok: false; error: string }> {
  try {
    const { admin } = await requireBookingAdmin(bookingId, groupId)
    await assertNoOpenAuction(admin, bookingId)

    const [{ data: rsvps }, { data: bookings }] = await Promise.all([
      admin
        .from('rsvps')
        .select('id, player_id, guest_name, guest_position, selected_position, profiles(full_name, preferred_position, is_suspended)')
        .eq('booking_id', bookingId)
        .eq('status', 'in'),
      admin.from('bookings').select('id, match_date').eq('group_id', groupId),
    ])
    const confirmed = (rsvps || []).filter((r: any) => !r.profiles?.is_suspended)
    if (confirmed.length < 2) return { ok: false, error: 'Not enough confirmed players yet' }
    const teams = Math.max(2, Math.min(8, Math.floor(numTeams)))
    if (confirmed.length < teams) return { ok: false, error: `Only ${confirmed.length} players for ${teams} teams` }

    // ── This group's finished matches → ratings ──
    const dateOf = new Map((bookings || []).map((b: any) => [b.id, b.match_date as string]))
    const bookingIds = Array.from(dateOf.keys())
    const { data: schedule } = bookingIds.length
      ? await admin
          .from('match_schedule')
          .select('id, booking_id, scheduled_order, home_team_id, away_team_id, home_score, away_score, dnp_player_ids')
          .in('booking_id', bookingIds)
          .eq('status', 'completed')
      : { data: [] as any[] }
    const done = (schedule || []).filter((m: any) => m.home_team_id && m.away_team_id)
    const teamIds = Array.from(new Set(done.flatMap((m: any) => [m.home_team_id, m.away_team_id])))
    const matchIds = done.map((m: any) => m.id)
    const [{ data: tps }, { data: goalEvents }, { data: legacyGoals }] = await Promise.all([
      teamIds.length ? admin.from('team_players').select('team_id, player_id').in('team_id', teamIds) : Promise.resolve({ data: [] as any[] }),
      matchIds.length
        ? admin.from('match_events').select('match_schedule_id, player_id, secondary_player_id').eq('event_type', 'goal').in('match_schedule_id', matchIds)
        : Promise.resolve({ data: [] as any[] }),
      matchIds.length ? admin.from('goal_events').select('match_schedule_id, scorer_id, assist_id').in('match_schedule_id', matchIds) : Promise.resolve({ data: [] as any[] }),
    ])
    const playersOf = new Map<string, string[]>()
    for (const tp of tps || []) playersOf.set(tp.team_id, [...(playersOf.get(tp.team_id) || []), tp.player_id])

    const results: MatchResult[] = done.map((m: any) => {
      const dnp = new Set<string>(m.dnp_player_ids || [])
      return {
        id: m.id,
        order: `${dateOf.get(m.booking_id)}-${String(m.scheduled_order ?? 0).padStart(3, '0')}`,
        home: (playersOf.get(m.home_team_id) || []).filter((p) => !dnp.has(p)),
        away: (playersOf.get(m.away_team_id) || []).filter((p) => !dnp.has(p)),
        homeScore: m.home_score ?? 0,
        awayScore: m.away_score ?? 0,
      }
    })

    // Goal involvement: new match_events where a match has them, legacy goal_events otherwise.
    const involvement = new Map<string, number>()
    const withEvents = new Set((goalEvents || []).map((g: any) => g.match_schedule_id))
    const bump = (id?: string | null) => id && involvement.set(id, (involvement.get(id) ?? 0) + 1)
    for (const g of goalEvents || []) { bump(g.player_id); bump(g.secondary_player_id) }
    for (const g of legacyGoals || []) if (!withEvents.has(g.match_schedule_id)) { bump(g.scorer_id); bump(g.assist_id) }

    const ratings = computeRatings(results, involvement)

    // ── Confirmed players → balance ──
    const pool: (BalancePlayer & { matches: number; isGuest: boolean })[] = confirmed.map((r: any) => {
      const rating = r.player_id ? ratings.get(r.player_id) : undefined
      return {
        id: r.player_id || `guest_${r.id}`,
        name: (r.player_id ? r.profiles?.full_name : r.guest_name) || 'Player',
        position: normPos(r.selected_position || r.guest_position || r.profiles?.preferred_position),
        strength: rating?.strength ?? BASE_RATING,
        matches: rating?.matches ?? 0,
        isGuest: !r.player_id,
      }
    })
    const extra = new Map(pool.map((p) => [p.id, p]))
    const result = balanceTeams(pool, teams, seed)

    return {
      ok: true,
      data: {
        teams: result.teams.map((t) => ({
          avgStrength: Math.round(t.avgStrength),
          players: t.players.map((p) => ({ ...p, matches: extra.get(p.id)!.matches, isGuest: extra.get(p.id)!.isGuest })),
        })),
        spread: Math.round(result.spread),
        matchesUsed: results.length,
        ratedPlayers: pool.filter((p) => p.matches > 0).length,
      },
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Could not suggest teams' }
  }
}
