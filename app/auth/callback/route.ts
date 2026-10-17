import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NEXT_COOKIE, safeNext } from '@/lib/safeNext'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Where to land: ?next=, else the cookie the sign-in page set before Google, else the dashboard.
  // Only paths inside this app (safeNext).
  const cookieNext = request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${NEXT_COOKIE}=([^;]*)`))?.[1]
  const next = safeNext(searchParams.get('next') ?? cookieNext ?? null)

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      const base = isLocalEnv || !forwardedHost ? origin : `https://${forwardedHost}`
      const res = NextResponse.redirect(`${base}${next}`)
      res.cookies.set(NEXT_COOKIE, '', { path: '/', maxAge: 0 })
      return res
    }
  }

  // return the user to login page with an error parameter
  return NextResponse.redirect(`${origin}/login?error=Google authentication failed. Please try again.`)
}
