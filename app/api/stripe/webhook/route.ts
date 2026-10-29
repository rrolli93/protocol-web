import { constructStripeEvent } from '@/lib/dare/stripe-live'
import { assertStripeTestKey } from '@/lib/dare/stripe-port'
import { json } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'
import { handleStripeEvent, type StripeEventEnvelope } from '@/lib/dare/webhook'

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const key = process.env.STRIPE_SECRET_KEY
  if (!secret || !key) return json({ error: 'Stripe webhook is not configured' }, 500)
  try {
    assertStripeTestKey(key)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refusing Stripe key'
    return json({ error: message }, 500)
  }
  const signature = request.headers.get('stripe-signature')
  if (!signature) return json({ error: 'Missing Stripe signature' }, 400)
  const raw = await request.text()
  let event
  try {
    event = constructStripeEvent(raw, signature, secret, key)
  } catch {
    return json({ error: 'Invalid Stripe signature' }, 400)
  }
  const envelope: StripeEventEnvelope = {
    id: event.id,
    type: event.type,
    data: { object: event.data.object as unknown as Record<string, unknown> },
  }
  try {
    const result = await handleStripeEvent(envelope, getRepo())
    if (!result.ok) return json({ error: result.error }, result.status)
    return json({ received: true, duplicate: result.data.duplicate })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook failed'
    return json({ error: message }, 500)
  }
}
