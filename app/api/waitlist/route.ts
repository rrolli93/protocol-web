import { json } from '@/lib/dare/http'
import { createRateLimiter } from '@/lib/dare/rate-limit'
import { getRepo } from '@/lib/dare/runtime'

const limit = createRateLimiter(8, 60_000)

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local'
  if (!limit(`waitlist:${ip}`)) return json({ error: 'Too many signups' }, 429)
  const body = await request.json().catch(() => ({})) as { email?: string; ageConfirmed?: boolean }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email' }, 400)
  if (body.ageConfirmed !== true) return json({ error: 'Dare is 18+ only' }, 400)
  const result = await getRepo().joinWaitlist(email)
  return json({ ok: true, status: result })
}
