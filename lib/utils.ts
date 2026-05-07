import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from 'crypto'

export function generateRsvpToken(playerId: string, bookingId: string): string {
  const secret = process.env.RSVP_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default_secret'
  return crypto.createHmac('sha256', secret)
    .update(playerId + bookingId)
    .digest('hex')
    .slice(0, 16)
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
