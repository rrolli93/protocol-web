import { json } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'
import { getStravaConnectionByAthlete } from '@/lib/dare/strava-store'
import { verifyDareFromStrava } from '@/lib/dare/strava-verify'

function expectedToken(): string {
  return process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || process.env.CRON_SECRET || ''
}

/** Strava subscription handshake. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const challenge = url.searchParams.get('hub.challenge')
  const token = url.searchParams.get('hub.verify_token')
  if (mode === 'subscribe' && challenge && expectedToken() && token === expectedToken()) {
    return json({ 'hub.challenge': challenge })
  }
  return json({ error: 'forbidden' }, 403)
}

/** Activity create events. Strava expects a fast 200. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    object_type?: string
    aspect_type?: string
    owner_id?: number
  } | null
  if (body?.object_type === 'activity' && body.aspect_type === 'create' && body.owner_id != null) {
    const connection = await getStravaConnectionByAthlete(String(body.owner_id))
    if (connection) {
      const repo = getRepo()
      const dares = (await repo.listStravaOpen()).filter((dare) => dare.doerId === connection.userId)
      for (const dare of dares) {
        await verifyDareFromStrava({ dare, repo }).catch(() => {})
      }
    }
  }
  return json({ ok: true })
}
