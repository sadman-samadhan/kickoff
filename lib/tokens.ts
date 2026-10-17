import 'server-only'
import crypto from 'crypto'

// Signed links (server only — never import this from a client component).

function rsvpSecret(): string {
  // Same secret chain as before, so RSVP links already sent keep working.
  // Set RSVP_TOKEN_SECRET explicitly before rotating the Supabase service-role key.
  const secret = process.env.RSVP_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('RSVP_TOKEN_SECRET is not configured')
  return secret
}

export function generateRsvpToken(playerId: string, bookingId: string): string {
  return crypto.createHmac('sha256', rsvpSecret()).update(playerId + bookingId).digest('hex').slice(0, 16)
}

export function verifyRsvpToken(playerId: string, bookingId: string, token: string): boolean {
  const expected = Buffer.from(generateRsvpToken(playerId, bookingId))
  const given = Buffer.from(String(token || ''))
  return given.length === expected.length && crypto.timingSafeEqual(given, expected)
}
