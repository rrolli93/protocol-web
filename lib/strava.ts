// Strava OAuth helpers — secret is server-side only

export const STRAVA_CLIENT_ID = '223306';
const REDIRECT_URI = 'https://protocol-web-theta.vercel.app/api/strava/callback';

export function buildStravaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  start_date: string;
}

export async function getRecentActivities(accessToken: string, perPage = 30): Promise<StravaActivity[]> {
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Strava fetch failed: ${res.status}`);
  return res.json();
}

export function metresToKm(m: number): number {
  return Math.round((m / 1000) * 100) / 100;
}
