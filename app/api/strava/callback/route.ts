import { NextResponse } from 'next/server'
import { exchangeStravaCode } from '@/lib/strava'
import { safeStravaNext } from '@/lib/dare/strava-oauth'
import { saveStravaConnection } from '@/lib/dare/strava-store'
import { currentUser } from '@/lib/dare/http'
import { readOAuthCookie } from '../start/route'

function done(origin: string, next: string, query: string) {
  const path = safeStravaNext(next)
  const join = path.includes('?') ? '&' : '?'
  const response = NextResponse.redirect(new URL(`${path}${join}${query}`, origin))
  response.cookies.set('strava_oauth_state', '', { path: '/', maxAge: 0 })
  response.cookies.set('strava_oauth_user', '', { path: '/', maxAge: 0 })
  response.cookies.set('strava_oauth_next', '', { path: '/', maxAge: 0 })
  return response
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const state = url.searchParams.get('state') ?? ''
  const pending = await readOAuthCookie()
  if (error || !code || !state || state !== pending.state || !pending.userId) {
    return done(url.origin, pending.next, 'strava=error&reason=missing_params')
  }
  const session = await currentUser()
  if (!session || session.id !== pending.userId) {
    return done(url.origin, pending.next, 'strava=error&reason=auth')
  }
  try {
    const tokens = await exchangeStravaCode(code)
    await saveStravaConnection({
      userId: session.id,
      athleteId: String(tokens.athlete?.id ?? ''),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expires_at * 1000).toISOString(),
      scope: tokens.scope || 'activity:read_all',
      demo: false,
    })
  } catch {
    return done(url.origin, pending.next, 'strava=error&reason=token')
  }
  return done(url.origin, pending.next, 'strava=connected')
}
