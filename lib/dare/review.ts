import { notify } from './notify'
import { refundDare } from './settlement'
import type { DareRepo } from './repo'
import type { StripePort } from './stripe-port'
import { fail, ok, type Result, type User } from './types'

export type ReviewAction = 'approve' | 'reject' | 'retake'

export async function applyReview(args: {
  proofId: string
  action: ReviewAction
  reviewer: User
  repo: DareRepo
  stripe: StripePort
  now?: Date
}): Promise<Result<{ status: string }>> {
  if (!args.reviewer.isAdmin) return fail(403, 'Review is limited to admins')
  const proof = await args.repo.getProof(args.proofId)
  if (!proof) return fail(404, 'Proof not found')
  if (proof.reviewStatus !== 'pending') return fail(409, 'This proof is not waiting for review')
  const dare = await args.repo.getDare(proof.dareId)
  if (!dare) return fail(404, 'Dare not found')
  const now = args.now ?? new Date()
  const beforeDeadline = new Date(dare.deadlineAt).getTime() > now.getTime()

  if (args.action === 'approve') {
    await args.repo.updateProof(proof.id, {
      reviewStatus: 'approved',
      reviewerId: args.reviewer.id,
      reviewedAt: now.toISOString(),
    })
    await args.repo.setDisputeWindow(dare.id, now.toISOString())
    const moved = await args.repo.transition(dare.id, 'completed', ['in_review', 'proof_submitted'])
    if (!moved && (await args.repo.getDare(dare.id))?.status !== 'completed') {
      return fail(409, 'Could not approve this dare')
    }
    await args.repo.logEvent(dare.id, 'review_approved', { proofId: proof.id, reviewerId: args.reviewer.id })
    await notifyOutcome(args.repo, dare.id, dare.creatorId, dare.doerId, 'approved', `“${dare.title}” was approved.`)
    return ok({ status: 'completed' })
  }

  if (args.action === 'retake') {
    if (!beforeDeadline) return fail(409, 'The deadline has passed, so a retake is not possible')
    await args.repo.updateProof(proof.id, {
      reviewStatus: 'rejected',
      reviewerId: args.reviewer.id,
      reviewedAt: now.toISOString(),
      aiRationale: proof.aiRationale,
    })
    const moved = await args.repo.transition(dare.id, 'accepted', ['in_review', 'proof_submitted'])
    if (!moved) return fail(409, 'Could not reopen the dare for a retake')
    await args.repo.logEvent(dare.id, 'review_retake', { proofId: proof.id, reviewerId: args.reviewer.id })
    return ok({ status: 'accepted' })
  }

  await args.repo.updateProof(proof.id, {
    reviewStatus: 'rejected',
    reviewerId: args.reviewer.id,
    reviewedAt: now.toISOString(),
  })
  const moved = await args.repo.transition(dare.id, 'failed', ['in_review', 'proof_submitted', 'accepted'])
  if (!moved && (await args.repo.getDare(dare.id))?.status !== 'failed') {
    return fail(409, 'Could not reject this dare')
  }
  await args.repo.logEvent(dare.id, 'review_rejected', { proofId: proof.id, reviewerId: args.reviewer.id })
  await notifyOutcome(args.repo, dare.id, dare.creatorId, dare.doerId, 'rejected', `“${dare.title}” was rejected.`)
  if (dare.mode === 'funded') {
    const refund = await refundDare(dare.id, args.repo, args.stripe)
    if (!refund.ok) return refund
  } else {
    const { settleSoloMiss } = await import('./settlement')
    const donated = await settleSoloMiss(dare.id, args.repo, args.stripe)
    if (!donated.ok) return donated
  }
  return ok({ status: 'failed' })
}

async function notifyOutcome(repo: Parameters<typeof notify>[0], dareId: string, creatorId: string, doerId: string | null, type: string, body: string) {
  const creator = await repo.getUser(creatorId)
  const doer = doerId ? await repo.getUser(doerId) : null
  const fundings = await repo.listFundings(dareId)
  const people = [creator, doer]
  for (const funding of fundings) people.push(await repo.getUser(funding.funderId))
  await notify(repo, people, { dareId, type, title: type === 'approved' ? 'Proof approved' : 'Proof rejected', body })
}
