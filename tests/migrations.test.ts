import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb, errorOf, type TestDb } from './db'

let db: TestDb
let alice: string
let bob: string

beforeAll(async () => {
  db = await createTestDb()
  const a = await db.query<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ('a@x.com', '{"full_name":"Alice"}') returning id`)
  const b = await db.query<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ('b@x.com', '{"full_name":"Bob"}') returning id`)
  alice = a.rows[0].id
  bob = b.rows[0].id
  // The signup trigger may not fill every column the same way in tests; make sure both profiles exist.
  await db.query(`insert into public.profiles (id, full_name, email) values ($1, 'Alice', 'a@x.com'), ($2, 'Bob', 'b@x.com') on conflict (id) do nothing`, [alice, bob])
  await db.query(`update public.profiles set security_answer = 'dhaka' where id = $1`, [alice])
})

describe('migrations on top of the production baseline', () => {
  it('apply cleanly and create user_security', async () => {
    const r = await db.query(`select to_regclass('public.user_security') as t`)
    expect(r.rows[0]).toEqual({ t: 'user_security' })
  })

  it('users can still read their own profile but nobody else’s', async () => {
    expect(await asUser(db, alice, `select id from public.profiles`)).toEqual([{ id: alice }])
  })

  it('users can no longer edit their own profile directly (e.g. make themselves site admin)', async () => {
    const err = await errorOf(() => asUser(db, alice, `update public.profiles set is_site_admin = true where id = $1`, [alice]))
    expect(err).toMatch(/permission denied/)
    const r = await db.query<{ is_site_admin: boolean }>(`select is_site_admin from public.profiles where id = $1`, [alice])
    expect(r.rows[0].is_site_admin).toBe(false)
  })

  it('clients cannot write match tables directly', async () => {
    for (const sql of [
      `insert into public.teams (name) values ('x')`,
      `insert into public.match_events (match_schedule_id, event_type) values (gen_random_uuid(), 'goal')`,
      `insert into public.goal_events (minute) values (1)`,
      `delete from public.team_players`,
    ]) {
      expect(await errorOf(() => asUser(db, bob, sql))).toMatch(/permission denied/)
    }
  })

  it('user_security is invisible to clients', async () => {
    expect(await errorOf(() => asUser(db, alice, `select * from public.user_security`))).toMatch(/permission denied/)
  })

  it('players can still manage their own RSVPs (dashboard writes them directly)', async () => {
    const err = await errorOf(() =>
      asUser(db, bob, `insert into public.rsvps (player_id, status) values ($1, 'in')`, [bob]),
    )
    expect(err).toBeNull()
  })

  it('creates every index from 0003', async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from pg_indexes where schemaname = 'public' and indexname like '%_idx'`)
    expect(r.rows[0].n).toBe(22)
  })
})
