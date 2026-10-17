// In-memory Postgres (PGlite) with the production schema baseline + every migration applied.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'

// Just enough of Supabase for the baseline to load.
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text) $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create publication supabase_realtime;
  grant usage on schema public, auth to anon, authenticated, service_role;
`

export async function createTestDb() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  const dir = path.join(__dirname, '..', 'supabase', 'migrations')
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(dir, f), 'utf8'))
    if (f.startsWith('0000_')) {
      // The baseline records production's grants as comments; give client roles the same table rights.
      await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
    }
  }
  return db
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>

/** Runs SQL as a signed-in Supabase user (role authenticated, auth.uid() = userId). */
export async function asUser<T = Record<string, unknown>>(db: TestDb, userId: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false)`, [userId])
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec(`reset role`)
    await db.query(`select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)`)
  }
}

export async function errorOf(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return (e as Error).message
  }
}
