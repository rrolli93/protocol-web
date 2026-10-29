import { describe, expect, it } from 'vitest'
import { applyReview } from '@/lib/dare/review'
import { issueProofChallenge, submitProof } from '@/lib/dare/proof-service'
import { MockProofChecker } from '@/lib/dare/ai'
import { randomPhrase } from '@/lib/dare/phrase'
import { refundDare, releasePayout, settleSoloMiss, settleSoloSuccess } from '@/lib/dare/settlement'
import { runExpireJob, runReleaseJob } from '@/lib/dare/jobs'
import { MockStripe } from '@/lib/dare/stripe-port'
import { idempotencyTransfer } from '@/lib/dare/money'
import { adult, CHARITY_ID, createFundedDare, fresh, NOW, payBounty, seedPair } from './helpers'
import { createDareForUser } from '@/lib/dare/create-dare'
import { startCheckout } from '@/lib/dare/checkout'
import { handleStripeEvent } from '@/lib/dare/webhook'
import { daysFromNow } from './helpers'

describe('settlement', () => {
  it('pays 90% once and ignores a second run', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const dare = await createFundedDare(repo, funder)
    expect(await repo.setDoer(dare.id, doer.id)).toBe(true)
    await payBounty(repo, stripe, dare.id, funder, 4_000)
    const phrase = randomPhrase(() => 0)
    const issued = await issueProofChallenge(dare.id, doer, repo, phrase)
    if (!issued.ok) throw new Error(issued.error)
    const submitted = await submitProof({
      dareId: dare.id,
      user: doer,
      bytes: Uint8Array.from([1, 2, 3, 4]),
      durationS: 40,
      spokenCodeWord: issued.data.codeWord,
      repo,
      checker: new MockProofChecker(),
      now: NOW,
      fixture: 'pass',
      allowFixtures: true,
    })
    if (!submitted.ok) throw new Error(submitted.error)
    expect(submitted.data.outcome).toBe('auto_pass')

    const early = await releasePayout(dare.id, repo, stripe, NOW)
    expect(early.ok).toBe(false)

    const later = new Date(NOW.getTime() + 25 * 60 * 60 * 1000)
    const first = await releasePayout(dare.id, repo, stripe, later)
    const second = await releasePayout(dare.id, repo, stripe, later)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.data.netCents).toBe(3_600)
      expect(first.data.feeCents).toBe(400)
      expect(second.data.idempotent).toBe(true)
      expect(first.data.transferIds[0]).toBe(second.data.transferIds[0])
    }
    expect(stripe.transfers).toHaveLength(1)
    expect(stripe.transfers[0].idempotencyKey).toBe(idempotencyTransfer(dare.id))
    expect(stripe.transfers[0].amountCents).toBe(3_600)
    expect(stripe.transfers[0].destination).toBe('acct_test_doer')
    expect((await repo.getDare(dare.id))?.status).toBe('paid_out')
  })

  it('creates one transfer when two payouts run together', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const dare = await createFundedDare(repo, funder)
    await repo.setDoer(dare.id, doer.id)
    await payBounty(repo, stripe, dare.id, funder, 4_000)
    await repo.transition(dare.id, 'proof_submitted', ['accepted'])
    await repo.transition(dare.id, 'completed', ['proof_submitted'])
    await repo.setDisputeWindow(dare.id, new Date(NOW.getTime() - 1000).toISOString())

    let releaseGate: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve
    })
    let entered = 0
    const original = stripe.createTransfer.bind(stripe)
    stripe.createTransfer = async (args) => {
      entered += 1
      await gate
      return original(args)
    }

    const pending = Promise.all([
      releasePayout(dare.id, repo, stripe, NOW),
      releasePayout(dare.id, repo, stripe, NOW),
    ])
    await new Promise((resolve) => setTimeout(resolve, 20))
    releaseGate()
    const [left, right] = await pending
    expect(left.ok || right.ok).toBe(true)
    const ids = new Set([
      ...(left.ok ? left.data.transferIds : []),
      ...(right.ok ? right.data.transferIds : []),
    ].filter(Boolean))
    expect(stripe.uniqueTransferIds()).toHaveLength(1)
    expect(ids.size).toBeLessThanOrEqual(1)
    expect(entered).toBeGreaterThan(0)
    const payout = await repo.getPayout(dare.id)
    expect(payout?.netCents).toBe(3_600)
    expect(payout?.stripeTransferId).toBe(stripe.uniqueTransferIds()[0])
  })

  it('refunds the funder in full once when review rejects', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const admin = adult({ handle: 'reviewer', isAdmin: true, email: 'review@example.com' })
    await repo.upsertUser(admin)
    const dare = await createFundedDare(repo, funder)
    await repo.setDoer(dare.id, doer.id)
    await payBounty(repo, stripe, dare.id, funder, 2_500)
    const phrase = randomPhrase(() => 0.2)
    const issued = await issueProofChallenge(dare.id, doer, repo, phrase)
    if (!issued.ok) throw new Error(issued.error)
    const submitted = await submitProof({
      dareId: dare.id,
      user: doer,
      bytes: Uint8Array.from([9, 9, 9]),
      durationS: 30,
      spokenCodeWord: issued.data.codeWord,
      repo,
      checker: new MockProofChecker(),
      now: NOW,
    })
    if (!submitted.ok) throw new Error(submitted.error)
    expect(submitted.data.outcome).toBe('queue')

    const rejected = await applyReview({
      proofId: submitted.data.proof.id,
      action: 'reject',
      reviewer: admin,
      repo,
      stripe,
      now: NOW,
    })
    expect(rejected.ok).toBe(true)
    const again = await refundDare(dare.id, repo, stripe)
    expect(again.ok).toBe(true)
    if (again.ok) expect(again.data.idempotent).toBe(true)
    expect(stripe.refunds).toHaveLength(1)
    expect(stripe.refunds[0].amountCents).toBe(2_500)
    expect(stripe.transfers).toHaveLength(0)
    expect((await repo.getFunding((await repo.listFundings(dare.id))[0].id))?.status).toBe('refunded')
    const events = await repo.listEvents(dare.id)
    expect(events.some((event) => event.type === 'review_rejected')).toBe(true)
  })

  it('refunds concurrently once per funding', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const dare = await createFundedDare(repo, funder)
    await repo.setDoer(dare.id, doer.id)
    await payBounty(repo, stripe, dare.id, funder, 3_000)
    await repo.transition(dare.id, 'failed', ['accepted'])
    await Promise.all([
      refundDare(dare.id, repo, stripe),
      refundDare(dare.id, repo, stripe),
    ])
    expect(stripe.uniqueRefundIds()).toHaveLength(1)
    expect(stripe.transfers).toHaveLength(0)
    expect((await repo.getDare(dare.id))?.status).toBe('refunded')
  })

  it('returns a solo pledge on success and donates a miss, never to the doer', async () => {
    const { repo, stripe } = fresh()
    const person = adult({ handle: 'solo' })
    await repo.upsertUser(person)
    const success = await createDareForUser({
      title: 'Read 20 pages',
      rules: 'Read 20 pages of a paper book out loud.',
      category: 'habits',
      mode: 'solo',
      deadlineAt: daysFromNow(3),
      charityId: CHARITY_ID,
    }, person, repo, NOW)
    if (!success.ok) throw new Error(success.error)
    const pledge = await startCheckout({
      dareId: success.data.id,
      amountCents: 1_500,
      user: person,
      successUrl: 'http://localhost/ok',
      cancelUrl: 'http://localhost/no',
      paidMode: true,
      now: NOW,
    }, repo, stripe)
    if (!pledge.ok) throw new Error(pledge.error)
    expect(stripe.checkouts[0].captureMethod).toBe('manual')
    await handleStripeEvent({
      id: 'evt_solo_auth',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: pledge.data.sessionId,
          payment_intent: 'pi_solo_auth',
          payment_status: 'unpaid',
          metadata: { funding_id: pledge.data.fundingId },
        },
      },
    }, repo)
    await repo.transition(success.data.id, 'proof_submitted', ['accepted'])
    await repo.transition(success.data.id, 'completed', ['proof_submitted'])
    const returned = await settleSoloSuccess(success.data.id, repo, stripe)
    expect(returned.ok).toBe(true)
    expect(stripe.voidCount()).toBe(1)
    expect(stripe.transfers).toHaveLength(0)
    expect(stripe.refunds).toHaveLength(0)

    const miss = await createDareForUser({
      title: 'Practice scales',
      rules: 'Play the C major scale five times slowly.',
      category: 'skills',
      mode: 'solo',
      deadlineAt: daysFromNow(2),
      charityId: CHARITY_ID,
    }, person, repo, NOW)
    if (!miss.ok) throw new Error(miss.error)
    const second = await startCheckout({
      dareId: miss.data.id,
      amountCents: 2_000,
      user: person,
      successUrl: 'http://localhost/ok',
      cancelUrl: 'http://localhost/no',
      paidMode: true,
      now: NOW,
    }, repo, stripe)
    if (!second.ok) throw new Error(second.error)
    await handleStripeEvent({
      id: 'evt_solo_miss',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: second.data.sessionId,
          payment_intent: 'pi_solo_miss',
          payment_status: 'unpaid',
          metadata: { funding_id: second.data.fundingId },
        },
      },
    }, repo)
    const donated = await settleSoloMiss(miss.data.id, repo, stripe)
    expect(donated.ok).toBe(true)
    expect(stripe.captureCount()).toBe(1)
    expect(stripe.transfers).toHaveLength(0)
    const funding = await repo.getFunding(second.data.fundingId)
    expect(funding?.status).toBe('donated')
    expect((await repo.getDare(miss.data.id))?.status).toBe('failed')
  })

  it('retries a payout after Stripe fails and still pays once', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const dare = await createFundedDare(repo, funder)
    await repo.setDoer(dare.id, doer.id)
    await payBounty(repo, stripe, dare.id, funder, 2_000)
    await repo.transition(dare.id, 'proof_submitted', ['accepted'])
    await repo.transition(dare.id, 'completed', ['proof_submitted'])
    await repo.setDisputeWindow(dare.id, new Date(NOW.getTime() - 1000).toISOString())
    stripe.createTransfer = async () => {
      throw new Error('stripe down')
    }
    await expect(releasePayout(dare.id, repo, stripe, NOW)).rejects.toThrow('stripe down')
    expect((await repo.getDare(dare.id))?.status).toBe('paid_out')
    expect((await repo.getPayout(dare.id))?.stripeTransferId).toBeNull()

    const healthy = new MockStripe()
    const retried = await runReleaseJob(repo, healthy, NOW)
    expect(retried.some((result) => result.ok)).toBe(true)
    expect(healthy.uniqueTransferIds()).toHaveLength(1)
    const again = await runReleaseJob(repo, healthy, NOW)
    expect(again).toHaveLength(0)
    expect(healthy.uniqueTransferIds()).toHaveLength(1)
    expect((await repo.getPayout(dare.id))?.netCents).toBe(1_800)
  })

  it('expires an unproved dare into one refund', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const dare = await createFundedDare(repo, funder, { deadlineAt: daysFromNow(2) })
    await repo.setDoer(dare.id, doer.id)
    await payBounty(repo, stripe, dare.id, funder, 2_000)
    const before = await runExpireJob(repo, stripe, NOW)
    expect(before).toHaveLength(0)
    const afterDeadline = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000)
    const expired = await runExpireJob(repo, stripe, afterDeadline)
    expect(expired).toHaveLength(1)
    expect(expired[0].ok).toBe(true)
    const again = await runExpireJob(repo, stripe, afterDeadline)
    expect(again).toHaveLength(0)
    expect(stripe.uniqueRefundIds()).toHaveLength(1)
    expect((await repo.getDare(dare.id))?.status).toBe('refunded')
    const released = await runReleaseJob(repo, stripe, afterDeadline)
    expect(released).toHaveLength(0)
  })
})
