import { doerMayFund } from './authz'
import { validateFundingAmount, validateMonthlyCap } from './money'
import { newId, type DareRepo } from './repo'
import type { StripePort } from './stripe-port'
import { daysUntil } from './validation'
import { isAtLeast18 } from './validation'
import { fail, ok, type Funding, type Result, type User } from './types'

export interface CheckoutRequest {
  dareId: string
  amountCents: number
  user: User
  successUrl: string
  cancelUrl: string
  paidMode: boolean
  now?: Date
}

export async function startCheckout(input: CheckoutRequest, repo: DareRepo, stripe: StripePort): Promise<Result<{ url: string; sessionId: string; fundingId: string }>> {
  if (!input.paidMode) return fail(403, 'Paid mode is off')
  if (!input.user.ageConfirmed || !isAtLeast18(input.user.dob, input.now)) {
    return fail(403, 'You need to confirm you are 18 or older')
  }
  const dare = await repo.getDare(input.dareId)
  if (!dare) return fail(404, 'Dare not found')
  if (dare.status !== 'open' && dare.status !== 'accepted') {
    return fail(409, 'This dare is not open for payment')
  }
  if (dare.mode === 'funded' && !doerMayFund(dare.doerId, input.user.id)) {
    return fail(403, 'The doer does not put money in')
  }
  if (dare.mode === 'funded' && dare.creatorId === input.user.id && dare.doerId === input.user.id) {
    return fail(403, 'The doer does not put money in')
  }
  if (dare.mode === 'solo' && dare.doerId !== input.user.id && dare.creatorId !== input.user.id) {
    return fail(403, 'Only the person who set the solo dare can pledge')
  }
  const now = input.now ?? new Date()
  const committed = await repo.sumCommitted(dare.id)
  const amountError = validateFundingAmount(input.amountCents, dare.mode === 'solo' ? 0 : committed)
  if (amountError) return fail(400, amountError)
  if (dare.mode === 'solo') {
    const existing = await repo.listFundings(dare.id)
    if (existing.some((row) => row.status === 'pending' || row.status === 'captured')) {
      return fail(409, 'This solo dare already has a pledge')
    }
  }
  const monthError = validateMonthlyCap(await repo.sumFunderMonth(input.user.id, now), input.amountCents)
  if (monthError) return fail(400, monthError)

  const manual = dare.mode === 'solo' && daysUntil(dare.deadlineAt, now) <= 7
  const funding: Funding = {
    id: newId(),
    dareId: dare.id,
    funderId: input.user.id,
    amountCents: input.amountCents,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeChargeId: null,
    captureMethod: manual ? 'manual' : 'automatic',
    status: 'pending',
    refundId: null,
    createdAt: now.toISOString(),
  }
  await repo.createFunding(funding)
  const session = await stripe.createCheckout({
    amountCents: input.amountCents,
    dareId: dare.id,
    fundingId: funding.id,
    productName: dare.mode === 'solo' ? `Solo pledge: ${dare.title}` : `Dare bounty: ${dare.title}`,
    mode: dare.mode,
    captureMethod: funding.captureMethod,
    idempotencyKey: `checkout:${funding.id}`,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  })
  await repo.attachCheckoutSession(funding.id, session.id)
  await repo.logEvent(dare.id, 'checkout_started', { fundingId: funding.id, amountCents: input.amountCents, captureMethod: funding.captureMethod })
  return ok({ url: session.url, sessionId: session.id, fundingId: funding.id })
}
