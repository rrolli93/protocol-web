import { startCheckout } from '@/lib/dare/checkout'
import { paidModeEnabled } from '@/lib/dare/flags'
import { appOrigin, isUser, json, requireUser } from '@/lib/dare/http'
import { createRateLimiter } from '@/lib/dare/rate-limit'
import { getRepo, getStripe } from '@/lib/dare/runtime'

const limit = createRateLimiter(10, 60_000)

export async function POST(request: Request) {
  const user = await requireUser()
  if (!isUser(user)) return user
  if (!limit(`checkout:${user.id}`)) return json({ error: 'Too many checkout attempts' }, 429)
  const body = await request.json().catch(() => ({})) as { dareId?: string; amountCents?: number }
  if (!body.dareId || !Number.isInteger(body.amountCents)) return json({ error: 'dareId and amountCents are required' }, 400)
  let stripe
  try {
    stripe = getStripe()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe is not configured'
    return json({ error: message }, 503)
  }
  const origin = appOrigin(request)
  const result = await startCheckout({
    dareId: body.dareId,
    amountCents: body.amountCents as number,
    user,
    paidMode: paidModeEnabled(),
    successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/checkout/cancel?dare=${body.dareId}`,
  }, getRepo(), stripe)
  if (!result.ok) return json({ error: result.error }, result.status)
  return json(result.data)
}
