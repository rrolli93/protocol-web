import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { connectDemoStrava, newOAuthState, safeStravaNext, stravaAuthorizeUrl } from '@/lib/dare/strava-oauth'
import { stravaConfigured } from '@/lib/dare/strava-store'
import { devStoreEnabled } from '@/lib/dare/flags'
import { currentUser } from '@/lib/dare/http'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = safeStravaNext(url.searchParams.get('next'))
  const user = await currentUser()
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/strava/start?next=${encodeURIComponent(next)}`)}`, url.origin))
  }
  if (devStoreEnabled()) {
    await connectDemoStrava(user.id)
    const join = next.includes('?') ? '&' : '?'
    return NextResponse.redirect(new URL(`${next}${join}strava=connected`, url.origin))
  }
  if (!stravaConfigured()) {
    const join = next.includes('?') ? '&' : '?'
    return NextResponse.redirect(new URL(`${next}${join}strava=error&reason=not_configured`, url.origin))
  }
  const state = newOAuthState()
  const authorize = stravaAuthorizeUrl(state)
  if (!authorize) {
    return NextResponse.redirect(new URL(`${next}?strava=error&reason=not_configured`, url.origin))
  }
  const response = NextResponse.redirect(authorize)
  const cookie = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 10 * 60 }
  response.cookies.set('strava_oauth_state', state, cookie)
  response.cookies.set('strava_oauth_user', user.id, cookie)
  response.cookies.set('strava_oauth_next', next, cookie)
  return response
}

export async function readOAuthCookie() {
  const jar = await cookies()
  return {
    state: jar.get('strava_oauth_state')?.value ?? '',
    userId: jar.get('strava_oauth_user')?.value ?? '',
    next: jar.get('strava_oauth_next')?.value ?? '/profile',
  }
}
