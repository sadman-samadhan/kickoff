/**
 * Where to send someone after signing in/up: a path inside this app, or the dashboard.
 * Rejects anything that could leave the site ("//evil.com", "/\evil.com", "https://…", "@evil.com").
 */
export function safeNext(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback
  let v = raw
  try {
    v = decodeURIComponent(raw)
  } catch {
    return fallback
  }
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || /[\u0000-\u001f]/.test(v)) return fallback
  if (v.startsWith('/login') || v.startsWith('/register') || v.startsWith('/auth/')) return fallback
  return v
}

/** Cookie that carries the place to come back to through Google sign-in (the OAuth redirect URL stays fixed,
 *  so it keeps matching Supabase's allowed redirect list). Read once by /auth/callback. */
export const NEXT_COOKIE = 'kh_next'

export function rememberNextForOAuth(next: string | null | undefined) {
  const n = safeNext(next, '')
  document.cookie = n ? `${NEXT_COOKIE}=${encodeURIComponent(n)}; path=/; max-age=600; samesite=lax` : `${NEXT_COOKIE}=; path=/; max-age=0`
}

/** "/login?next=…" (or /register) keeping the place to come back to. */
export function withNext(path: '/login' | '/register', next: string | null | undefined) {
  const n = safeNext(next, '')
  return n ? `${path}?next=${encodeURIComponent(n)}` : path
}
