import type { DareRepo } from './repo'
import { fail, ok, type Result } from './types'

export interface StripeEventEnvelope {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

export async function handleStripeEvent(event: StripeEventEnvelope, repo: DareRepo): Promise<Result<{ duplicate: boolean }>> {
  if (!event.id || !event.id.startsWith('evt_')) return fail(400, 'Invalid Stripe event id')
  const claim = await repo.claimWebhook(event.id, event.type)
  if (claim !== 'fresh') return ok({ duplicate: true })
  try {
    await applyEvent(event, repo)
    await repo.completeWebhook(event.id)
    return ok({ duplicate: false })
  } catch (error) {
    await repo.releaseWebhook(event.id)
    throw error
  }
}

async function applyEvent(event: StripeEventEnvelope, repo: DareRepo): Promise<void> {
  const object = event.data.object
  switch (event.type) {
    case 'checkout.session.completed': {
      const fundingId = metadataString(object, 'funding_id')
      const funding = fundingId
        ? await repo.getFunding(fundingId)
        : await repo.getFundingBySession(stringField(object, 'id') ?? '')
      if (!funding) return
      const paymentIntent = stringField(object, 'payment_intent')
      const paymentStatus = stringField(object, 'payment_status')
      if (!paymentIntent) return
      if (paymentStatus === 'paid') {
        await repo.markFundingCaptured(funding.id, paymentIntent, stringField(object, 'charge'))
      } else {
        await repo.markFundingAuthorized(funding.id, paymentIntent)
      }
      return
    }
    case 'charge.refunded': {
      const paymentIntent = stringField(object, 'payment_intent')
      if (!paymentIntent) return
      const funding = await repo.getFundingByPaymentIntent(paymentIntent)
      if (!funding || funding.status === 'refunded') return
      const refundId = stringField(object, 'refund_id') ?? `evt_${event.id}`
      await repo.markFundingRefunded(funding.id, refundId)
      return
    }
    case 'charge.dispute.created': {
      const paymentIntent = stringField(object, 'payment_intent')
      const funding = paymentIntent ? await repo.getFundingByPaymentIntent(paymentIntent) : null
      const dareId = funding?.dareId ?? metadataString(object, 'dare_id')
      if (!dareId) return
      await repo.logEvent(dareId, 'charge_dispute', { eventId: event.id, paymentIntent })
      const dare = await repo.getDare(dareId)
      if (dare?.status === 'completed') {
        await repo.transition(dareId, 'in_review', ['completed'])
      }
      return
    }
    case 'account.updated': {
      const accountId = stringField(object, 'id')
      if (!accountId) return
      const enabled = object.payouts_enabled === true
      await repo.setPayoutsEnabledByAccount(accountId, enabled)
      await repo.logEvent(null, 'account_updated', { accountId, payoutsEnabled: enabled })
      return
    }
    case 'transfer.reversed': {
      await repo.logEvent(null, 'transfer_reversed', { transferId: stringField(object, 'id'), eventId: event.id })
      return
    }
    default:
      return
  }
}

function stringField(object: Record<string, unknown>, key: string): string | null {
  const value = object[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function metadataString(object: Record<string, unknown>, key: string): string | null {
  const metadata = object.metadata
  if (!metadata || typeof metadata !== 'object') return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}
