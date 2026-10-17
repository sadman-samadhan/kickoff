import { describe, expect, it } from 'vitest'
import type { LiveEvent, LiveMatchState } from '@/lib/live/types'
import { editedEvent, mergeEvents, onPitch, scoreOf, tallies } from '@/components/live/derive'
import { clockMs, matchMinute } from '@/components/live/useLiveMatch'
import { kit } from '@/components/live/kit'
import { calculateMatchPlayerPitchTime, calculateTournamentPlayerPoints, countHatTricksAndWins } from '@/lib/tournamentScoring'

let n = 0
const ev = (o: Partial<LiveEvent>): LiveEvent => ({
  id: `e${++n}`, match_schedule_id: 'm', event_type: 'goal', team_id: 'H', player_id: null, secondary_player_id: null,
  minute: 1, details_json: {}, created_at: new Date(2026, 9, 17, 20, 0, n).toISOString(), created_by: 'u', ...o,
})

const state = (o: Partial<LiveMatchState['match']> = {}): LiveMatchState => ({
  serverNow: 0,
  match: {
    id: 'm', booking_id: 'b', match_number: 1, stage_name: null, status: 'ongoing', period: '1st_half', home_score: 0, away_score: 0,
    timing_mode: 'halves', half_minutes: 15, duration_minutes: 30, clock_running: false, clock_started_at: null, clock_elapsed_ms: 0,
    starting_player_ids: null, mvp_player_id: null, motm_guest_name: null, ...o,
  },
  home: { id: 'H', name: 'Red', jersey_color: '#ef4444', captain_id: null, players: [{ id: 'h1', full_name: 'A' }, { id: 'h2', full_name: 'B' }, { id: 'guest_g1', full_name: 'G', is_guest: true }] },
  away: { id: 'A', name: 'Blue', jersey_color: '#3b82f6', captain_id: null, players: [{ id: 'a1', full_name: 'C' }] },
  events: [],
})

describe('live scoring derivations', () => {
  it('scores from events, own goals for the other side, stored score for legacy matches', () => {
    const s = state({ home_score: 4, away_score: 2 })
    expect(scoreOf(s, [])).toEqual({ home: 4, away: 2 })
    expect(scoreOf(s, [ev({ player_id: 'h1' }), ev({ team_id: 'A', player_id: 'a1' }), ev({ team_id: 'A', player_id: 'a1', details_json: { is_own_goal: true } })])).toEqual({ home: 2, away: 1 })
  })

  it('tallies goals, assists, cards and who has been subbed off', () => {
    const t = tallies([
      ev({ player_id: 'h1', secondary_player_id: 'h2' }),
      ev({ details_json: { guest_player_id: 'guest_g1' } }),
      ev({ event_type: 'card', player_id: 'h2', details_json: { card_type: 'yellow' } }),
      ev({ event_type: 'sub', player_id: 'h1', details_json: { guest_secondary_player_id: 'guest_g1' }, minute: 10 }),
    ])
    expect(t.get('h1')).toMatchObject({ goals: 1, subbedOff: true })
    expect(t.get('h2')).toMatchObject({ assists: 1, yellow: 1 })
    expect(t.get('guest_g1')).toMatchObject({ goals: 1, subbedOff: false })
  })

  it('works out the bench from the starting lineup and subs', () => {
    const players = state().home!.players
    expect(onPitch(players, null, []).bench).toEqual([])
    const r = onPitch(players, ['h1', 'h2'], [ev({ event_type: 'sub', player_id: 'h1', details_json: { guest_secondary_player_id: 'guest_g1' } })])
    expect(r.pitch.map((p) => p.id)).toEqual(['h2', 'guest_g1'])
    expect(r.bench.map((p) => p.id)).toEqual(['h1'])
  })

  it('merges pending, hidden and edited events', () => {
    const a = ev({ player_id: 'h1' })
    const b = ev({ player_id: 'h2' })
    const p = ev({ player_id: null, pending: true })
    const merged = mergeEvents([a, b], [p, { ...a, pending: true }], new Set([b.id]), { [p.id]: editedEvent(p, 'guest_g1', 'h1', 7) })
    expect(merged.map((e) => e.id)).toEqual([a.id, p.id])
    expect(merged[1]).toMatchObject({ player_id: null, secondary_player_id: 'h1', minute: 7, details_json: { guest_player_id: 'guest_g1' } })
    // Clearing a guest assist drops its key instead of leaving it behind.
    const g = ev({ details_json: { guest_secondary_player_id: 'guest_g1', is_own_goal: false } })
    expect(editedEvent(g, 'h1', null, 3).details_json).toEqual({ is_own_goal: false })
  })

  it('shared clock: banked time plus running time; 2nd half continues from the half length', () => {
    const start = Date.UTC(2026, 9, 17, 14, 0, 0)
    const m = state({ clock_running: true, clock_started_at: new Date(start).toISOString(), clock_elapsed_ms: 30000 }).match
    expect(clockMs(m, start + 60000)).toBe(90000)
    expect(matchMinute(m, start + 60000)).toBe(2)
    expect(matchMinute({ ...m, period: '2nd_half' }, start + 60000)).toBe(17)
    expect(matchMinute({ ...m, status: 'scheduled' }, start)).toBe(0)
  })

  it('kit colours pick readable text', () => {
    expect(kit('#ffffff').ink).toBe('#111111')
    expect(kit('#eab308').ink).toBe('#111111')
    expect(kit('#1e3a8a').ink).toBe('#ffffff')
    expect(kit('red').base).toBe('#ef4444')
    expect(kit('not-a-colour', '#2563eb').base).toBe('#2563eb')
  })
})

describe('stats fixes', () => {
  it('goals conceded follow the event team, not the scorer (guests / unknown scorers)', () => {
    const goals = [ev({ team_id: 'A', details_json: { guest_player_id: 'guest_x' } }), ev({ team_id: 'A', player_id: null })]
    const r = calculateMatchPlayerPitchTime(goals as never, 30, ['h1'], ['a1'], ['h1', 'a1'], 'H')
    expect(r.goalsConcededOnPitch).toEqual({ h1: 2, a1: 0 })
    // Voided goals never count.
    const voided = calculateMatchPlayerPitchTime([{ ...goals[0], voided_at: '2026-10-17' }] as never, 30, ['h1'], ['a1'], ['h1', 'a1'], 'H')
    expect(voided.goalsConcededOnPitch).toEqual({ h1: 0, a1: 0 })
  })

  it('hat-tricks and wins (DNP excluded) earn their bonus points', () => {
    const { hatTricks, wins } = countHatTricksAndWins(
      [
        { id: 'm1', status: 'completed', home_team_id: 'H', away_team_id: 'A', home_score: 3, away_score: 1, dnp_player_ids: ['h2'] },
        { id: 'm2', status: 'completed', home_team_id: 'H', away_team_id: 'A', home_score: 1, away_score: 1 },
      ],
      [1, 2, 3].map(() => ({ match_schedule_id: 'm1', scorer: 'h1' })).concat([{ match_schedule_id: 'm1', scorer: 'a1', is_own_goal: true } as never]),
      (t) => (t === 'H' ? ['h1', 'h2'] : ['a1']),
    )
    expect(hatTricks).toEqual({ h1: 1 })
    expect(wins).toEqual({ h1: 1 })
    const base = calculateTournamentPlayerPoints('ATT', { goals: 3 }).totalPoints
    const withBonus = calculateTournamentPlayerPoints('ATT', { goals: 3, hatTricks: 1, matchWins: 1 })
    expect(withBonus.totalPoints - base).toBe(3)
    expect(withBonus.breakdown.hatTrickPts.total).toBe(2)
  })
})
