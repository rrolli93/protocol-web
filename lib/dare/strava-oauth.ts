import { randomBytes } from 'crypto'
import { stravaCallbackUrl, stravaClientId } from '@/lib/strava'
import { devStoreEnabled } from './flags'
import { safeNextPath } from './auth-google'
import { saveStravaConnection, stravaScope } from './strava-store'

export function newOAuthState(): string {
  return randomBytes(16).toString('hex')
}

export function stravaAuthorizeUrl(state: string): string | null {
  const clientId = stravaClientId()
  if (!clientId) return null
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: stravaCallbackUrl(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: stravaScope(),
    state,
  })
  return `https://www.strava.com/oauth/authorize?${params.toString()}`
}

export async function connectDemoStrava(userId: string): Promise<void> {
  if (!devStoreEnabled()) throw new Error('Demo Strava connect is only available without Supabase')
  await saveStravaConnection({
    userId,
    athleteId: `demo-${userId.slice(0, 8)}`,
    accessToken: 'demo',
    refreshToken: 'demo',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    scope: stravaScope(),
    demo: true,
  })
}

export function safeStravaNext(input: string | null): string {
  return safeNextPath(input, '/profile')
}
