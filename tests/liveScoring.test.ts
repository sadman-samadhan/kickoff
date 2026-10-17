import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { asUser, createTestDb, errorOf, type TestDb } from './db'

let db: TestDb
let ids: Awaited<ReturnType<typeof seedMatch>>

const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]

async function makeUser(name: string) {
  const u = await one<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [`${name}@test.local`])
  await db.query(`insert into public.profiles (id, full_name, email) values ($1, $2, $3) on conflict (id) do update set full_name = excluded.full_name`, [u.id, name, `${name}@test.local`])
  return u.id
}

/** A matchday with two teams of two registered players plus one guest each, and one fixture. */
async function seedMatch() {
  const admin = await makeUser('admin')
  const group = await one<{ id: string }>(`insert into public.groups (name, created_by) values ('G', $1) returning id`, [admin])
  const booking = await one<{ id: string }>(
    `insert into public.bookings (group_id, created_by, match_date, match_time, field_name, max_players) values ($1, $2, '2026-10-17', '20:00', 'Turf', 20) returning id`,
    [group.id, admin],
  )
  const [h1, h2, a1, a2] = [await makeUser('h1'), await makeUser('h2'), await makeUser('a1'), await makeUser('a2')]
  const guest = async (name: string) =>
    (await one<{ id: string }>(`insert into public.rsvps (booking_id, status, guest_name) values ($1, 'in', $2) returning id`, [booking.id, name])).id
  const [hg, ag] = [await guest('Home Guest'), await guest('Away Guest')]
  const home = await one<{ id: string }>(
    `insert into public.teams (booking_id, name, captain_id, guest_members) values ($1, 'Red', $2, $3) returning id`,
    [booking.id, h1, JSON.stringify([`${hg} (C)`])],
  )
  const away = await one<{ id: string }>(
    `insert into public.teams (booking_id, name, captain_id, guest_members) values ($1, 'Blue', $2, $3) returning id`,
    [booking.id, a1, JSON.stringify([ag])],
  )
  for (const [t, p] of [[home.id, h1], [home.id, h2], [away.id, a1], [away.id, a2]]) {
    await db.query(`insert into public.team_players (team_id, player_id) values ($1, $2)`, [t, p])
  }
  const match = await one<{ id: string }>(
    `insert into public.match_schedule (booking_id, home_team_id, away_team_id, match_number, scheduled_order) values ($1, $2, $3, 1, 1) returning id`,
    [booking.id, home.id, away.id],
  )
  return { admin, booking: booking.id, home: home.id, away: away.id, h1, h2, a1, a2, hg, ag, match: match.id }
}

type Opts = { id?: string; type?: string; team?: string; player?: string | null; guest?: string | null; secondary?: string | null; details?: object; by?: string }
function log(o: Opts = {}) {
  return one<{ r: { event: { id: string }; possible_duplicate: string | null } }>(
    `select public.log_match_event($1, $2, $3, $4, $5, $6, $7, null, 5, $8, $9) r`,
    [o.id ?? randomUUID(), ids.match, o.type ?? 'goal', o.team ?? ids.home, o.player === undefined ? ids.h1 : o.player, o.guest ?? null,
      o.secondary ?? null, JSON.stringify(o.details ?? {}), o.by ?? ids.admin],
  ).then((x) => x.r)
}
const score = () => one<{ home_score: number; away_score: number }>(`select home_score, away_score from public.match_schedule where id = $1`, [ids.match])
const legacyGoals = async () => Number((await one<{ n: string }>(`select count(*) n from public.goal_events where match_schedule_id = $1`, [ids.match])).n)

beforeEach(async () => {
  db = await createTestDb()
  ids = await seedMatch()
})

describe('log_match_event', () => {
  it('logs a goal and recomputes the score and goal_events', async () => {
    await log()
    await log({ team: ids.away, player: ids.a1 })
    await log({ team: ids.away, player: ids.a2 })
    expect(await score()).toEqual({ home_score: 1, away_score: 2 })
    expect(await legacyGoals()).toBe(3)
  })

  it('is idempotent on the client id (retry / double tap)', async () => {
    const id = randomUUID()
    await log({ id })
    await log({ id })
    expect(await score()).toEqual({ home_score: 1, away_score: 0 })
    expect(Number((await one<{ n: string }>(`select count(*) n from public.match_events`)).n)).toBe(1)
  })

  it('counts own goals for the other side', async () => {
    await log({ details: { is_own_goal: true } })
    expect(await score()).toEqual({ home_score: 0, away_score: 1 })
  })

  it('allows a goal with an unknown scorer', async () => {
    await log({ player: null })
    expect(await score()).toEqual({ home_score: 1, away_score: 0 })
  })

  it('logs guests by RSVP id and keeps the legacy details key', async () => {
    const r = await log({ player: null, guest: ids.hg })
    const ev = await one<{ guest_rsvp_id: string; details_json: Record<string, string> }>(`select guest_rsvp_id, details_json from public.match_events where id = $1`, [r.event.id])
    expect(ev.guest_rsvp_id).toBe(ids.hg)
    expect(ev.details_json.guest_player_id).toBe(`guest_${ids.hg}`)
    const g = await one<{ guest_scorer_name: string }>(`select guest_scorer_name from public.goal_events where match_schedule_id = $1`, [ids.match])
    expect(g.guest_scorer_name).toBe('Home Guest')
  })

  it('rejects a team that is not in the match, or a player from the other team', async () => {
    const other = await one<{ id: string }>(`insert into public.teams (booking_id, name) values ($1, 'Green') returning id`, [ids.booking])
    expect(await errorOf(() => log({ team: other.id }))).toMatch(/not playing/)
    expect(await errorOf(() => log({ player: ids.a1 }))).toMatch(/not on this team/)
    expect(await errorOf(() => log({ player: null, guest: ids.ag }))).toMatch(/not on this team/)
    expect(await errorOf(() => log({ secondary: ids.a2 }))).toMatch(/not on this team/)
    expect(await errorOf(() => log({ type: 'card', player: null }))).toMatch(/Pick a player/)
  })

  it('flags the same goal logged by someone else seconds ago', async () => {
    const first = await log({ by: ids.h1 })
    const second = await log({ by: ids.a1 })
    expect(second.possible_duplicate).toBe(first.event.id)
    const third = await log({ by: ids.a1 })
    expect(third.possible_duplicate).toBe(first.event.id)
    const own = await log({ by: ids.h1, player: ids.h2 })
    expect(own.possible_duplicate).toBeNull()
  })

  it('is not callable by signed-in users directly', async () => {
    const err = await errorOf(() =>
      asUser(db, ids.h1, `select public.log_match_event($1, $2, 'goal', $3, $4, null, null, null, 1, '{}', $4)`, [randomUUID(), ids.match, ids.home, ids.h1]),
    )
    expect(err).toMatch(/permission denied/)
  })
})

describe('edit and void', () => {
  it('voiding a goal takes it off the score; editing changes the scorer', async () => {
    const a = await log()
    const b = await log({ player: null })
    await db.query(`select public.void_match_event($1, $2)`, [a.event.id, ids.match])
    expect(await score()).toEqual({ home_score: 1, away_score: 0 })
    expect(await legacyGoals()).toBe(1)

    await db.query(`select public.update_match_event($1, $2, $3, null, $4, null, 9, '{}')`, [b.event.id, ids.match, ids.h2, ids.h1])
    const ev = await one<{ player_id: string; secondary_player_id: string; minute: number; updated_at: string }>(
      `select player_id, secondary_player_id, minute, updated_at from public.match_events where id = $1`, [b.event.id])
    expect(ev).toMatchObject({ player_id: ids.h2, secondary_player_id: ids.h1, minute: 9 })
    expect(ev.updated_at).not.toBeNull()
    expect(await errorOf(() => db.query(`select public.update_match_event($1, $2, $3, null, null, null, 9, '{}')`, [b.event.id, ids.match, ids.a1]))).toMatch(/not on this team/)
  })

  it('voiding every goal resets the score to 0-0', async () => {
    const a = await log()
    await db.query(`select public.void_match_event($1, $2)`, [a.event.id, ids.match])
    expect(await score()).toEqual({ home_score: 0, away_score: 0 })
  })

  it('leaves matches whose goals only exist in legacy goal_events alone', async () => {
    await db.query(`update public.match_schedule set home_score = 2, away_score = 1 where id = $1`, [ids.match])
    await db.query(`insert into public.goal_events (match_schedule_id, scorer_id, team_id) values ($1, $2, $3)`, [ids.match, ids.h1, ids.home])
    await log({ type: 'card', details: { card_type: 'yellow' } })
    await db.query(`select public.complete_match($1)`, [ids.match])
    expect(await score()).toEqual({ home_score: 2, away_score: 1 })
    expect(await legacyGoals()).toBe(1)
  })

  it('deleting a profile keeps the goal (scorer becomes unknown)', async () => {
    await log({ player: ids.h2 })
    await db.query(`delete from public.team_players where player_id = $1`, [ids.h2])
    await db.query(`delete from public.goal_events where scorer_id = $1`, [ids.h2])
    await db.query(`delete from public.profiles where id = $1`, [ids.h2])
    expect(Number((await one<{ n: string }>(`select count(*) n from public.match_events where player_id is null`)).n)).toBe(1)
  })
})

describe('complete_match', () => {
  it('writes clean sheets for the side that conceded nothing, minus DNP, and completes the matchday', async () => {
    await log()
    await db.query(`update public.match_schedule set dnp_player_ids = $2 where id = $1`, [ids.match, `{${ids.h2}}`])
    const m = await one<{ status: string; period: string }>(`select * from public.complete_match($1)`, [ids.match])
    expect(m).toMatchObject({ status: 'completed', period: 'completed' })
    const sheets = (await db.query<{ player_id: string }>(`select player_id from public.clean_sheets where match_schedule_id = $1`, [ids.match])).rows
    expect(sheets.map((s) => s.player_id)).toEqual([ids.h1])
    expect((await one<{ status: string }>(`select status from public.bookings where id = $1`, [ids.booking])).status).toBe('completed')

    // Re-completing after a correction rewrites clean sheets instead of duplicating them.
    await log({ team: ids.away, player: ids.a1 })
    await db.query(`select public.complete_match($1)`, [ids.match])
    expect(Number((await one<{ n: string }>(`select count(*) n from public.clean_sheets where match_schedule_id = $1`, [ids.match])).n)).toBe(0)
  })

  it('leaves the matchday open while other fixtures remain', async () => {
    await db.query(`insert into public.match_schedule (booking_id, home_team_id, away_team_id, match_number) values ($1, $2, $3, 2)`, [ids.booking, ids.away, ids.home])
    await db.query(`select public.complete_match($1)`, [ids.match])
    expect((await one<{ status: string }>(`select status from public.bookings where id = $1`, [ids.booking])).status).toBe('upcoming')
  })

  it('stops the shared clock and banks the elapsed time', async () => {
    await db.query(`update public.match_schedule set clock_running = true, clock_started_at = now() - interval '90 seconds', clock_elapsed_ms = 1000 where id = $1`, [ids.match])
    await db.query(`select public.complete_match($1)`, [ids.match])
    const c = await one<{ clock_running: boolean; clock_elapsed_ms: string }>(`select clock_running, clock_elapsed_ms from public.match_schedule where id = $1`, [ids.match])
    expect(c.clock_running).toBe(false)
    expect(Number(c.clock_elapsed_ms)).toBeGreaterThanOrEqual(91000)
  })
})

describe('corrections after full time', () => {
  it('re-scores and rewrites clean sheets when a finished match is corrected', async () => {
    await db.query(`select public.complete_match($1)`, [ids.match])
    expect(Number((await one<{ n: string }>(`select count(*) n from public.clean_sheets where match_schedule_id = $1`, [ids.match])).n)).toBe(4)
    const g = await log({ team: ids.away, player: ids.a1 })
    expect(await score()).toEqual({ home_score: 0, away_score: 1 })
    expect(Number((await one<{ n: string }>(`select count(*) n from public.clean_sheets where match_schedule_id = $1`, [ids.match])).n)).toBe(2)
    await db.query(`select public.void_match_event($1, $2)`, [g.event.id, ids.match])
    expect(Number((await one<{ n: string }>(`select count(*) n from public.clean_sheets where match_schedule_id = $1`, [ids.match])).n)).toBe(4)
  })
})

describe('match_clock', () => {
  const clock = (cmd: string, extra: unknown[] = [null, null, 0]) => db.query(`select public.match_clock($1, $2, $3, $4, $5)`, [ids.match, cmd, ...extra])
  const state = () => one<{ status: string; period: string; clock_running: boolean; clock_elapsed_ms: string; duration_minutes: number; half_minutes: number }>(
    `select status, period, clock_running, clock_elapsed_ms, duration_minutes, half_minutes from public.match_schedule where id = $1`, [ids.match])

  it('runs a two-half match', async () => {
    expect(await errorOf(() => clock('pause'))).toMatch(/Start the match/)
    await clock('start', ['halves', 12, 0])
    expect(await state()).toMatchObject({ status: 'ongoing', period: '1st_half', clock_running: true, duration_minutes: 24, half_minutes: 12 })
    await db.query(`update public.match_schedule set clock_started_at = now() - interval '5 minutes' where id = $1`, [ids.match])
    await clock('pause')
    const paused = await state()
    expect(paused.clock_running).toBe(false)
    expect(Number(paused.clock_elapsed_ms)).toBeGreaterThanOrEqual(300000)
    await clock('adjust', [null, null, -60000])
    expect(Number((await state()).clock_elapsed_ms)).toBeLessThan(paused.clock_elapsed_ms as unknown as number)
    await clock('resume')
    expect(await errorOf(() => clock('second_half'))).toMatch(/Not at half-time/)
    await clock('half_time')
    expect(await state()).toMatchObject({ period: 'half_time', clock_running: false })
    expect(await errorOf(() => clock('resume'))).toMatch(/only runs during a half/)
    await clock('second_half')
    expect(await state()).toMatchObject({ period: '2nd_half', clock_running: true })
    await db.query(`select public.complete_match($1)`, [ids.match])
    expect(await errorOf(() => clock('reset'))).toMatch(/already finished/)
  })

  it('continuous matches have no half-time; reset goes back to scheduled', async () => {
    await clock('start', ['continuous', 20, 0])
    expect((await state()).duration_minutes).toBe(20)
    expect(await errorOf(() => clock('half_time'))).toMatch(/Not in the first half/)
    await clock('reset')
    expect(await state()).toMatchObject({ status: 'scheduled', period: null, clock_running: false })
  })
})
