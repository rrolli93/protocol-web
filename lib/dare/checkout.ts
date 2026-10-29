import { doerMayFund } from './authz'
import { feeConfig, priceBounty, validateFundingAmount, validateMonthlyCap, type FeeConfig } from './money'
import type { FailOutcome } from './types'
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
  /** Demo or explicit mock checkout. Does not charge a real card. */
  simulated?: boolean
  failOutcome?: FailOutcome
  fees?: FeeConfig
  now?: Date
}

export async function startCheckout(input: CheckoutRequest, repo: DareRepo, stripe: StripePort): Promise<Result<{ url: string; sessionId: string; fundingId: string; quote: ReturnType<typeof priceBounty> }>> {
  if (!input.paidMode && !input.simulated) return fail(403, 'Paid mode is off')
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
  const fees = input.fees ?? feeConfig()
  const committed = await repo.sumCommitted(dare.id)
  const amountError = validateFundingAmount(input.amountCents, dare.mode === 'solo' ? 0 : committed, fees)
  if (amountError) return fail(400, amountError)
  const requested: FailOutcome = input.failOutcome ?? dare.failOutcome ?? 'refund'
  const failOutcome: FailOutcome = dare.mode === 'solo' ? 'charity' : requested
  const charityId = failOutcome === 'charity' ? (dare.charityId) : null
  if (failOutcome === 'charity' && !charityId) return fail(400, 'Pick a charity for a missed dare')
  const quote = dare.mode === 'solo'
    ? { model: 'percent' as const, bountyCents: input.amountCents, feeCents: 0, chargeCents: input.amountCents, doerReceivesCents: 0, failOutcome, lines: [`Pledge ${input.amountCents / 100} CHF. Success returns it. A miss is marked for charity.`] }
    : priceBounty(input.amountCents, fees, failOutcome)
  if (dare.mode === 'solo') {
    const existing = await repo.listFundings(dare.id)
    if (existing.some((row) => row.status === 'pending' || row.status === 'captured')) {
      return fail(409, 'This solo dare already has a pledge')
    }
  }
  const monthError = validateMonthlyCap(await repo.sumFunderMonth(input.user.id, now), quote.chargeCents)
  if (monthError) return fail(400, monthError)

  const manual = dare.mode === 'solo' && daysUntil(dare.deadlineAt, now) <= 7
  const funding: Funding = {
    id: newId(),
    dareId: dare.id,
    funderId: input.user.id,
    amountCents: quote.bountyCents,
    chargeCents: quote.chargeCents,
    feeCents: quote.feeCents,
    feeModel: quote.model,
    failOutcome: quote.failOutcome,
    charityId,
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
    amountCents: quote.chargeCents,
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
  await repo.logEvent(dare.id, 'checkout_started', {
    fundingId: funding.id,
    bountyCents: quote.bountyCents,
    feeCents: quote.feeCents,
    chargeCents: quote.chargeCents,
    model: quote.model,
    failOutcome: quote.failOutcome,
    captureMethod: funding.captureMethod,
    simulated: input.simulated === true,
  })
  return ok({ url: session.url, sessionId: session.id, fundingId: funding.id, quote })
}
