import { isUser, json, requireUser } from '@/lib/dare/http'
import { adminCancelDare } from '@/lib/dare/moderation'
import { getRepo, getStripe } from '@/lib/dare/runtime'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!isUser(user)) return user
  const { id } = await context.params
  const body = await request.json().catch(() => ({})) as { reason?: string }
  let stripe
  try {
    stripe = getStripe()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe is not configured'
    return json({ error: message }, 503)
  }
  const result = await adminCancelDare({ dareId: id, admin: user, reason: body.reason ?? '', repo: getRepo(), stripe })
  if (!result.ok) return json({ error: result.error }, result.status)
  return json(result.data)
}
