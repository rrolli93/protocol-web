import { currentUser, json } from '@/lib/dare/http'
import { reportDare } from '@/lib/dare/moderation'
import { createRateLimiter } from '@/lib/dare/rate-limit'
import { getRepo } from '@/lib/dare/runtime'

const limit = createRateLimiter(10, 60_000)

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const user = await currentUser()
  const key = user?.id ?? request.headers.get('x-forwarded-for') ?? 'anon'
  if (!limit(`report:${key}`)) return json({ error: 'Too many reports' }, 429)
  const body = await request.json().catch(() => ({})) as { reason?: string }
  const result = await reportDare({ dareId: id, reporter: user, reason: body.reason ?? '', repo: getRepo() })
  if (!result.ok) return json({ error: result.error }, result.status)
  return json(result.data)
}
