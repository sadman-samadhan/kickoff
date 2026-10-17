import crypto from 'crypto'
import { describe, expect, it, vi } from 'vitest'

// lib/securityAnswers imports the Supabase server client; it isn't used by the pure helpers tested here.
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({}), createClient: () => ({}) }))

import { generateRsvpToken, verifyRsvpToken } from '@/lib/tokens'
import { answerMatches, hashAnswer, normalizeAnswer } from '@/lib/securityAnswers'

describe('RSVP tokens', () => {
  it('match the old algorithm so links already emailed keep working', () => {
    process.env.RSVP_TOKEN_SECRET = 'test-secret'
    const old = crypto.createHmac('sha256', 'test-secret').update('player-1' + 'booking-1').digest('hex').slice(0, 16)
    expect(generateRsvpToken('player-1', 'booking-1')).toBe(old)
    expect(verifyRsvpToken('player-1', 'booking-1', old)).toBe(true)
  })
  it('reject tampered or foreign tokens', () => {
    process.env.RSVP_TOKEN_SECRET = 'test-secret'
    const t = generateRsvpToken('player-1', 'booking-1')
    expect(verifyRsvpToken('player-2', 'booking-1', t)).toBe(false)
    expect(verifyRsvpToken('player-1', 'booking-1', t.slice(0, 15) + '0')).toBe(t.endsWith('0'))
    expect(verifyRsvpToken('player-1', 'booking-1', '')).toBe(false)
  })
})

describe('security answers', () => {
  it('compare trimmed and case-insensitive, like the old plain-text check', async () => {
    const stored = await hashAnswer('  Dhaka ')
    expect(stored).not.toContain('dhaka')
    expect(await answerMatches('dhaka', stored)).toBe(true)
    expect(await answerMatches('DHAKA  ', stored)).toBe(true)
    expect(await answerMatches('Khulna', stored)).toBe(false)
  })
  it('salts each hash', async () => {
    expect(await hashAnswer('same')).not.toBe(await hashAnswer('same'))
    expect(normalizeAnswer('  MiXeD ')).toBe('mixed')
  })
})
