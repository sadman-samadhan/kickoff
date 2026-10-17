import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isLinkPreviewBot, matchdayIdFromPath } from '@/lib/share/linkPreview'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session cookie and reads the signed-in user from the access token.
  // With asymmetric JWT signing keys enabled in Supabase this is checked locally (no network call);
  // otherwise it falls back to asking Supabase Auth, same as before.
  const { data } = await supabase.auth.getClaims()
  const isSignedIn = !!data?.claims?.sub

  // ─── Public routes: magic link RSVP ───
  if (pathname.startsWith('/rsvp')) {
    return supabaseResponse
  }

  // ─── Redirect logged-in users from landing page to dashboard ───
  if (pathname === '/' && isSignedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ─── Protected routes ───
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/groups') ||
    pathname.startsWith('/match-history') ||
    pathname.startsWith('/profile')

  if (isProtectedRoute && !isSignedIn) {
    // Link previews (WhatsApp etc.) of a matchday get the public preview page instead of the login page.
    const bookingId = matchdayIdFromPath(pathname)
    if (bookingId && isLinkPreviewBot(request.headers.get('user-agent'))) {
      const url = request.nextUrl.clone()
      url.pathname = `/share/matchday/${bookingId}`
      url.search = ''
      return NextResponse.rewrite(url)
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ─── Redirect logged-in users away from auth pages ───
  const isAuthRoute = pathname === '/login' || pathname === '/register'

  if (isAuthRoute && isSignedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip API routes (they check auth themselves), static files, the service worker and its chunks.
    '/((?!api/|_next/static|_next/image|favicon.ico|icons/|images/|manifest.json|sw.js|workbox-|worker-|swe-worker-|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?|map)$).*)',
  ],
}
