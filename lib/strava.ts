/** Strava OAuth helpers. The client secret never leaves the server. */

export function stravaClientId(): string {
  return process.env.STRAVA_CLIENT_ID || process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || ''
}

/** Must match the domain registered in the Strava app: protocol-web-theta.vercel.app */
export function stravaCallbackUrl(): string {
  if (process.env.STRAVA_REDIRECT_URI) return process.env.STRAVA_REDIRECT_URI
  const app = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (app) return `${app}/api/strava/callback`
  return 'https://protocol-web-theta.vercel.app/api/strava/callback'
}

export interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: { id?: number }
  scope?: string
}

export async function exchangeStravaCode(code: string, fetchImpl: typeof fetch = fetch): Promise<StravaTokenResponse> {
  const clientId = stravaClientId()
  const secret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !secret) throw new Error('Strava client is not configured')
  const response = await fetchImpl('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: secret,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) throw new Error(`Strava token exchange failed (${response.status})`)
  return response.json() as Promise<StravaTokenResponse>
}

export async function refreshStravaToken(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<StravaTokenResponse> {
  const clientId = stravaClientId()
  const secret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !secret) throw new Error('Strava client is not configured')
  const response = await fetchImpl('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: secret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!response.ok) throw new Error(`Strava refresh failed (${response.status})`)
  return response.json() as Promise<StravaTokenResponse>
}

export async function fetchStravaActivities(accessToken: string, afterUnix: number, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(
    `https://www.strava.com/api/v3/athlete/activities?after=${afterUnix}&per_page=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!response.ok) throw new Error(`Strava activities failed (${response.status})`)
  return response.json()
}
