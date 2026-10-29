import { describe, expect, it } from 'vitest'
import { MockProofChecker } from '@/lib/dare/ai'
import { openDispute } from '@/lib/dare/disputes'
import { applyReview } from '@/lib/dare/review'
import { issueProofChallenge, submitProof } from '@/lib/dare/proof-service'
import { randomPhrase } from '@/lib/dare/phrase'
import { releasePayout } from '@/lib/dare/settlement'
import { adult, createFundedDare, fresh, NOW, payBounty, seedPair } from './helpers'

describe('funded dare flow', () => {
  it('shares a dare, takes a test payment, reviews proof, and pays out once', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const admin = adult({ handle: 'reviewer', isAdmin: true })
    await repo.upsertUser(admin)

    const dare = await createFundedDare(repo, funder)
    expect(dare.status).toBe('open')
    const link = `/dare/${dare.id}/invite`
    expect(link).toContain(dare.id)

    expect(await repo.setDoer(dare.id, doer.id)).toBe(true)
    expect(await repo.setDoer(dare.id, funder.id)).toBe(false)
    await payBounty(repo, stripe, dare.id, funder, 5_000)
    expect(await repo.sumCaptured(dare.id)).toBe(5_000)
    expect(stripe.checkouts[0].captureMethod).toBe('automatic')

    const blocked = await payBounty(repo, stripe, dare.id, doer, 2_000).catch((error: Error) => error)
    expect(blocked).toBeInstanceOf(Error)

    const phrase = randomPhrase(() => 0.4)
    const issued = await issueProofChallenge(dare.id, doer, repo, phrase)
    if (!issued.ok) throw new Error(issued.error)
    const hidden = await repo.getDare(dare.id)
    expect(hidden?.codeWord).toBe(issued.data.codeWord)

    const submitted = await submitProof({
      dareId: dare.id,
      user: doer,
      bytes: Uint8Array.from([7, 7, 7, 7]),
      durationS: 55,
      spokenCodeWord: issued.data.codeWord,
      repo,
      checker: new MockProofChecker(),
      now: NOW,
    })
    if (!submitted.ok) throw new Error(submitted.error)
    expect(submitted.data.outcome).toBe('queue')
    expect((await repo.listReviewQueue()).map((proof) => proof.id)).toContain(submitted.data.proof.id)

    const stranger = await applyReview({
      proofId: submitted.data.proof.id,
      action: 'approve',
      reviewer: funder,
      repo,
      stripe,
      now: NOW,
    })
    expect(stranger.ok).toBe(false)

    const approved = await applyReview({
      proofId: submitted.data.proof.id,
      action: 'approve',
      reviewer: admin,
      repo,
      stripe,
      now: NOW,
    })
    expect(approved.ok).toBe(true)

    const paid = await releasePayout(dare.id, repo, stripe, NOW)
    const paidAgain = await releasePayout(dare.id, repo, stripe, NOW)
    expect(paid.ok).toBe(true)
    expect(paidAgain.ok && paidAgain.data.idempotent).toBe(true)
    expect(stripe.uniqueTransferIds()).toHaveLength(1)
    if (paid.ok) expect(paid.data.netCents).toBe(4_500)
    expect((await repo.getDare(dare.id))?.status).toBe('paid_out')
  })

  it('lets a funder dispute an automatic pass inside 24 hours', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const dare = await createFundedDare(repo, funder)
    await repo.setDoer(dare.id, doer.id)
    await payBounty(repo, stripe, dare.id, funder, 2_000)
    const phrase = randomPhrase(() => 0.1)
    const issued = await issueProofChallenge(dare.id, doer, repo, phrase)
    if (!issued.ok) throw new Error(issued.error)
    const submitted = await submitProof({
      dareId: dare.id,
      user: doer,
      bytes: Uint8Array.from([4, 5, 6]),
      durationS: 20,
      spokenCodeWord: issued.data.codeWord,
      repo,
      checker: new MockProofChecker(),
      now: NOW,
      fixture: 'pass',
      allowFixtures: true,
    })
    if (!submitted.ok) throw new Error(submitted.error)
    const dispute = await openDispute({
      dareId: dare.id,
      user: funder,
      reason: 'The set was not unbroken.',
      repo,
      now: NOW,
    })
    expect(dispute.ok).toBe(true)
    expect((await repo.getDare(dare.id))?.status).toBe('in_review')
    const payout = await releasePayout(dare.id, repo, stripe, NOW)
    expect(payout.ok).toBe(false)
    expect(stripe.transfers).toHaveLength(0)
  })
})
