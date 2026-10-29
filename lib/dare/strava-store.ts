import { devStoreEnabled } from './flags'
import type { StravaSport } from './types'

export interface StravaConnection {
  userId: string
  athleteId: string
  accessToken: string
  refreshToken: string
  expiresAt: string
  scope: string
  demo: boolean
}

const memory = new Map<string, StravaConnection>()

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, key }
}

export async function saveStravaConnection(connection: StravaConnection): Promise<void> {
  if (devStoreEnabled() || !admin()) {
    memory.set(connection.userId, connection)
    return
  }
  const { createClient } = await import('@supabase/supabase-js')
  const env = admin()
  if (!env) return
  const db = createClient(env.url, env.key)
  const { error } = await db.from('strava_connections').upsert({
    user_id: connection.userId,
    athlete_id: connection.athleteId,
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expires_at: connection.expiresAt,
    scope: connection.scope,
    demo: connection.demo,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function getStravaConnection(userId: string): Promise<StravaConnection | null> {
  if (devStoreEnabled() || !admin()) return memory.get(userId) ?? null
  const { createClient } = await import('@supabase/supabase-js')
  const env = admin()
  if (!env) return null
  const db = createClient(env.url, env.key)
  const { data, error } = await db.from('strava_connections').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as Record<string, unknown>
  return {
    userId: String(row.user_id),
    athleteId: String(row.athlete_id),
    accessToken: String(row.access_token),
    refreshToken: String(row.refresh_token),
    expiresAt: String(row.expires_at),
    scope: String(row.scope ?? ''),
    demo: row.demo === true,
  }
}

export async function getStravaConnectionByAthlete(athleteId: string): Promise<StravaConnection | null> {
  if (devStoreEnabled() || !admin()) {
    return [...memory.values()].find((row) => row.athleteId === athleteId) ?? null
  }
  const { createClient } = await import('@supabase/supabase-js')
  const env = admin()
  if (!env) return null
  const db = createClient(env.url, env.key)
  const { data, error } = await db.from('strava_connections').select('*').eq('athlete_id', athleteId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as Record<string, unknown>
  return {
    userId: String(row.user_id),
    athleteId: String(row.athlete_id),
    accessToken: String(row.access_token),
    refreshToken: String(row.refresh_token),
    expiresAt: String(row.expires_at),
    scope: String(row.scope ?? ''),
    demo: row.demo === true,
  }
}

export function stravaScope(): string {
  // activity:read misses followers-only and private activities. A dare proof is usually private.
  return 'activity:read_all'
}

export function stravaConfigured(): boolean {
  return Boolean((process.env.STRAVA_CLIENT_ID || process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID) && process.env.STRAVA_CLIENT_SECRET)
}

export function sportLabel(sport: StravaSport): string {
  if (sport === 'ride') return 'Ride'
  if (sport === 'walk') return 'Walk or hike'
  if (sport === 'swim') return 'Swim'
  return 'Run'
}
