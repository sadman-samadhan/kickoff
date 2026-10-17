// One-off: hash every plain-text security answer into public.user_security, then blank profiles.security_answer.
// Run AFTER supabase/migrations/0001_user_security.sql is applied and the new code is deployed:
//   node --env-file=.env.local scripts/backfill-security-answers.mjs          (dry run: counts only)
//   node --env-file=.env.local scripts/backfill-security-answers.mjs --apply
import { createClient } from '@supabase/supabase-js'
import { randomBytes, scryptSync } from 'crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const apply = process.argv.includes('--apply')
const db = createClient(url, key, { auth: { persistSession: false } })

// Must match lib/securityAnswers.ts exactly.
const normalize = (a) => String(a ?? '').trim().toLowerCase()
function hash(answer) {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${scryptSync(normalize(answer), salt, 32).toString('hex')}`
}

const { data: rows, error } = await db.from('profiles').select('id, security_answer').not('security_answer', 'is', null)
if (error) throw error
const todo = rows.filter((r) => normalize(r.security_answer))
console.log(`${todo.length} plain-text answers found${apply ? '' : ' (dry run — pass --apply to migrate)'}`)
if (!apply) process.exit(0)

let done = 0
for (const r of todo) {
  const { error: upErr } = await db.from('user_security').upsert({
    user_id: r.id,
    answer_hash: hash(r.security_answer),
    failed_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  })
  if (upErr) {
    console.error(`skip ${r.id}: ${upErr.message}`)
    continue
  }
  const { error: clrErr } = await db.from('profiles').update({ security_answer: null }).eq('id', r.id)
  if (clrErr) console.error(`hashed but could not clear ${r.id}: ${clrErr.message}`)
  else done++
}
console.log(`Migrated ${done}/${todo.length}.`)
