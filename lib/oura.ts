// Oura Ring OAuth helpers
const OURA_CLIENT_ID = process.env.NEXT_PUBLIC_OURA_CLIENT_ID ?? process.env.OURA_CLIENT_ID ?? ''
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://protocol-web-theta.vercel.app'}/api/oura/callback`

export function buildOuraAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: OURA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'daily heartrate workout session spo2 tag',
    state: userId,
  })
  return `https://cloud.ouraring.com/oauth/authorize?${params.toString()}`
}

export interface OuraSleepData {
  id: string
  day: string
  score?: number
  total_sleep_duration?: number   // seconds
  deep_sleep_duration?: number    // seconds
  rem_sleep_duration?: number     // seconds
  light_sleep_duration?: number   // seconds
  latency?: number                // seconds
  efficiency?: number             // 0-100
  average_hrv?: number
  average_heart_rate?: number
  lowest_heart_rate?: number
  restless_periods?: number
}

export interface OuraActivityData {
  id: string
  day: string
  score?: number
  steps?: number
  active_calories?: number
  total_calories?: number
  met?: { average?: number }
  sessions?: Array<{ sport: string; calories?: number; duration_seconds?: number }>
}

export interface OuraReadinessData {
  id: string
  day: string
  score?: number
  temperature_deviation?: number
  hrv_balance_score?: number
  recovery_index_score?: number
  resting_heart_rate_score?: number
  activity_balance_score?: number
  sleep_balance_score?: number
}
