/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { createAdminClient } from '@/lib/supabase/server'

// Security answers are stored only as scrypt hashes in public.user_security (no client access).
// Answers are compared trimmed and lower-cased, exactly as before.

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export const MAX_ATTEMPTS = 5
export const LOCK_MINUTES = 15

export function normalizeAnswer(answer: string): string {
  return String(answer ?? '').trim().toLowerCase()
}

export async function hashAnswer(answer: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(normalizeAnswer(answer), salt, 32)
  return `${salt.toString('hex')}:${key.toString('hex')}`
}

export async function answerMatches(answer: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(':')
  if (!saltHex || !keyHex) return false
  const key = await scrypt(normalizeAnswer(answer), Buffer.from(saltHex, 'hex'), 32)
  const expected = Buffer.from(keyHex, 'hex')
  return expected.length === key.length && timingSafeEqual(expected, key)
}

/** Saves a new hashed answer (and the question text on the profile). */
export async function setSecurityAnswer(userId: string, question: string, answer: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('user_security').upsert({
    user_id: userId,
    answer_hash: await hashAnswer(answer),
    failed_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  await admin.from('profiles').update({ security_question: question, security_answer: null }).eq('id', userId)
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'wrong' | 'locked' | 'not_set'; minutesLeft?: number }

/**
 * Checks an answer, counting failures and locking after MAX_ATTEMPTS.
 * During the transition, a user whose answer is still plain text in profiles is checked against it once,
 * then moved to a hash.
 */
export async function verifySecurityAnswer(userId: string, answer: string): Promise<VerifyResult> {
  const admin = createAdminClient()
  let { data: rec } = await admin
    .from('user_security')
    .select('answer_hash, failed_attempts, locked_until')
    .eq('user_id', userId)
    .maybeSingle()

  if (!rec) {
    const { data: legacy } = await admin.from('profiles').select('security_question, security_answer').eq('id', userId).maybeSingle()
    if (!legacy?.security_answer) return { ok: false, reason: 'not_set' }
    await setSecurityAnswer(userId, legacy.security_question || '', legacy.security_answer)
    const { data: fresh } = await admin
      .from('user_security')
      .select('answer_hash, failed_attempts, locked_until')
      .eq('user_id', userId)
      .single()
    rec = fresh
  }
  if (!rec) return { ok: false, reason: 'not_set' }

  if (rec.locked_until && new Date(rec.locked_until) > new Date()) {
    return { ok: false, reason: 'locked', minutesLeft: Math.ceil((new Date(rec.locked_until).getTime() - Date.now()) / 60000) }
  }

  if (await answerMatches(answer, rec.answer_hash)) {
    if (rec.failed_attempts) await admin.from('user_security').update({ failed_attempts: 0, locked_until: null }).eq('user_id', userId)
    return { ok: true }
  }

  const attempts = (rec.failed_attempts || 0) + 1
  const lock = attempts >= MAX_ATTEMPTS
  await admin
    .from('user_security')
    .update({
      failed_attempts: lock ? 0 : attempts,
      locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null,
    })
    .eq('user_id', userId)
  return lock ? { ok: false, reason: 'locked', minutesLeft: LOCK_MINUTES } : { ok: false, reason: 'wrong' }
}

export function verifyMessage(r: Exclude<VerifyResult, { ok: true }>): string {
  if (r.reason === 'locked') return `Too many wrong answers. Try again in ${r.minutesLeft} minutes.`
  if (r.reason === 'not_set') return 'Security question is not set up for this account.'
  return 'Incorrect answer to the security question.'
}
