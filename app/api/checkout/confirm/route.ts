import { stripeMockEnabled } from '@/lib/dare/flags'
import { isUser, json, requireUser } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'
import { handleStripeEvent } from '@/lib/dare/webhook'

/** Completes a mock Checkout session. Real test-mode payments arrive via the webhook. */
export async function POST(request: Request) {
  if (!stripeMockEnabled()) return json({ error: 'not found' }, 404)
  const user = await requireUser()
  if (!isUser(user)) return user
  const body = await request.json().catch(() => ({})) as { sessionId?: string }
  if (!body.sessionId) return json({ error: 'sessionId is required' }, 400)
  const repo = getRepo()
  const funding = await repo.getFundingBySession(body.sessionId)
  if (!funding || funding.funderId !== user.id) return json({ error: 'Session not found' }, 404)
  const result = await handleStripeEvent({
    id: `evt_mock_${body.sessionId}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: body.sessionId,
        payment_intent: `pi_mock_${funding.id.replace(/-/g, '')}`,
        payment_status: funding.captureMethod === 'manual' ? 'unpaid' : 'paid',
        metadata: { funding_id: funding.id, dare_id: funding.dareId },
      },
    },
  }, repo)
  if (!result.ok) return json({ error: result.error }, result.status)
  return json({ ...result.data, dareId: funding.dareId, status: funding.captureMethod === 'manual' ? 'authorized' : 'captured' })
}
