import { describe, expect, it } from 'vitest'
import { createDareForUser } from '@/lib/dare/create-dare'
import { startCheckout } from '@/lib/dare/checkout'
import { feeConfig, priceBounty, validateFundingAmount, type FeeConfig } from '@/lib/dare/money'
import { refundDare, releasePayout } from '@/lib/dare/settlement'
import { CHARITY_ID, NOW, adult, createFundedDare, daysFromNow, fresh, payBounty, seedPair } from './helpers'

const surcharge: FeeConfig = {
  model: 'surcharge',
  percentBps: 1_000,
  surchargeFixedCents: 200,
  surchargeBps: 500,
  minBountyCents: 2_000,
  maxBountyCents: 10_000,
}

describe('fee model', () => {
  it('defaults to 10% taken from the bounty and a CHF 20 minimum', () => {
    expect(feeConfig({}).model).toBe('percent')
    expect(feeConfig({}).minBountyCents).toBe(2_000)
    expect(feeConfig({ DARE_FEE_MODEL: 'surcharge', DARE_SURCHARGE_FIXED_CENTS: '250', DARE_MIN_BOUNTY_CENTS: '3000' })).toMatchObject({
      model: 'surcharge',
      surchargeFixedCents: 250,
      minBountyCents: 3_000,
    })
    const quote = priceBounty(4_000)
    expect(quote.feeCents).toBe(400)
    expect(quote.chargeCents).toBe(4_000)
    expect(quote.doerReceivesCents).toBe(3_600)
    expect(quote.lines.join(' ')).toMatch(/You pay/)
    expect(validateFundingAmount(1_500, 0)).toMatch(/CHF 20/)
    expect(validateFundingAmount(1_500, 0, { ...feeConfig({}), minBountyCents: 1_000 })).toBeNull()
  })

  it('lets the funder pay a configurable fee on top so the doer receives the full bounty', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const dare = await createFundedDare(repo, funder)
    await repo.setDoer(dare.id, doer.id)
    const checkout = await startCheckout({
      dareId: dare.id,
      amountCents: 2_000,
      user: funder,
      successUrl: 'http://localhost/ok',
      cancelUrl: 'http://localhost/no',
      paidMode: true,
      fees: surcharge,
      now: NOW,
    }, repo, stripe)
    if (!checkout.ok) throw new Error(checkout.error)
    expect(checkout.data.quote.feeCents).toBe(300)
    expect(checkout.data.quote.chargeCents).toBe(2_300)
    expect(checkout.data.quote.doerReceivesCents).toBe(2_000)
    expect(stripe.checkouts[0].amountCents).toBe(2_300)
    expect(checkout.data.quote.lines.some((line) => line.includes('not refunded'))).toBe(true)

    const { handleStripeEvent } = await import('@/lib/dare/webhook')
    await handleStripeEvent({
      id: 'evt_surcharge_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: checkout.data.sessionId,
          payment_intent: 'pi_surcharge_1',
          payment_status: 'paid',
          metadata: { funding_id: checkout.data.fundingId },
        },
      },
    }, repo)
    await repo.transition(dare.id, 'proof_submitted', ['accepted'])
    await repo.transition(dare.id, 'completed', ['proof_submitted'])
    await repo.setDisputeWindow(dare.id, new Date(NOW.getTime() - 1000).toISOString())
    const paid = await releasePayout(dare.id, repo, stripe, NOW)
    expect(paid.ok).toBe(true)
    if (paid.ok) {
      expect(paid.data.netCents).toBe(2_000)
      expect(paid.data.feeCents).toBe(0)
    }
    expect(stripe.transfers[0].amountCents).toBe(2_000)
  })

  it('refunds only the bounty when the fee was paid on top', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const dare = await createFundedDare(repo, funder)
    await repo.setDoer(dare.id, doer.id)
    const checkout = await startCheckout({
      dareId: dare.id,
      amountCents: 2_000,
      user: funder,
      successUrl: 'http://localhost/ok',
      cancelUrl: 'http://localhost/no',
      paidMode: true,
      fees: surcharge,
      now: NOW,
    }, repo, stripe)
    if (!checkout.ok) throw new Error(checkout.error)
    const { handleStripeEvent } = await import('@/lib/dare/webhook')
    await handleStripeEvent({
      id: 'evt_surcharge_refund',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: checkout.data.sessionId,
          payment_intent: 'pi_surcharge_refund',
          payment_status: 'paid',
          metadata: { funding_id: checkout.data.fundingId },
        },
      },
    }, repo)
    await repo.transition(dare.id, 'failed', ['accepted'])
    const refunded = await refundDare(dare.id, repo, stripe)
    expect(refunded.ok).toBe(true)
    expect(stripe.refunds).toHaveLength(1)
    expect(stripe.refunds[0].amountCents).toBe(2_000)
    expect(stripe.transfers).toHaveLength(0)
  })

  it('sends a missed bounty to charity when the funder chose that', async () => {
    const { repo, stripe } = fresh()
    const funder = adult({ handle: 'giver' })
    await repo.upsertUser(funder)
    const created = await createDareForUser({
      title: 'Swim 1 km',
      rules: 'Swim one kilometre without stopping, filmed in one take.',
      category: 'fitness',
      mode: 'funded',
      deadlineAt: daysFromNow(10),
      creatorIsDoer: false,
      failOutcome: 'charity',
      charityId: CHARITY_ID,
    }, funder, repo, NOW)
    if (!created.ok) throw new Error(created.error)
    await payBounty(repo, stripe, created.data.id, funder, 2_500)
    await repo.transition(created.data.id, 'failed', ['open'])
    const result = await refundDare(created.data.id, repo, stripe)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.action).toBe('donate')
    expect(stripe.refunds).toHaveLength(0)
    expect(stripe.transfers).toHaveLength(0)
    const funding = (await repo.listFundings(created.data.id))[0]
    expect(funding.status).toBe('donated')
    expect(funding.failOutcome).toBe('charity')
    expect((await repo.getDare(created.data.id))?.status).toBe('failed')
  })
})
