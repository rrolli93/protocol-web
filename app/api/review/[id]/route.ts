import { applyReview, type ReviewAction } from '@/lib/dare/review'
import { isUser, json, requireUser } from '@/lib/dare/http'
import { createRateLimiter } from '@/lib/dare/rate-limit'
import { getRepo, getStripe } from '@/lib/dare/runtime'
import { MockStripe, type StripePort } from '@/lib/dare/stripe-port'

const limit = createRateLimiter(30, 60_000)

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!isUser(user)) return user
  if (!limit(`review:${user.id}`)) return json({ error: 'Too many review actions' }, 429)
  const { id } = await context.params
  const body = await request.json().catch(() => ({})) as { action?: ReviewAction }
  if (body.action !== 'approve' && body.action !== 'reject' && body.action !== 'retake') {
    return json({ error: 'action must be approve, reject, or retake' }, 400)
  }
  let stripe: StripePort
  if (body.action === 'reject') {
    try {
      stripe = getStripe()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe is not configured'
      return json({ error: message }, 503)
    }
  } else {
    stripe = new MockStripe()
  }
  const result = await applyReview({ proofId: id, action: body.action, reviewer: user, repo: getRepo(), stripe })
  if (!result.ok) return json({ error: result.error }, result.status)
  return json(result.data)
}
