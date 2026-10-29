import type { DareRepo } from './repo'
import type { Dare, User } from './types'

export async function presentDare(dare: Dare, repo: DareRepo, viewer: User | null) {
  const fundings = await repo.listFundings(dare.id)
  const bountyCents = fundings
    .filter((row) => row.status === 'captured' || row.status === 'transferred' || row.status === 'donated')
    .reduce((sum, row) => sum + row.amountCents, 0)
  const isDoer = viewer?.id === dare.doerId
  const isCreator = viewer?.id === dare.creatorId
  const isFunder = viewer ? fundings.some((row) => row.funderId === viewer.id) : false
  const isAdmin = viewer?.isAdmin === true
  const involved = isDoer || isCreator || isFunder || isAdmin
  const proofs = involved ? await repo.listProofs(dare.id) : []
  const charity = dare.charityId ? await repo.getCharity(dare.charityId) : null
  return {
    id: dare.id,
    title: dare.title,
    rules: dare.rules,
    category: dare.category,
    mode: dare.mode,
    status: dare.status,
    deadlineAt: dare.deadlineAt,
    currency: dare.currency,
    bountyCents,
    charity,
    framing: dare.proofRequirements.framing,
    creatorId: dare.creatorId,
    doerId: dare.doerId,
    disputeWindowEndsAt: dare.disputeWindowEndsAt,
    codeWord: isDoer ? dare.codeWord : null,
    gesture: isDoer ? dare.gesture : null,
    sharePath: `/dare/${dare.id}/invite`,
    viewer: { isDoer, isCreator, isFunder, isAdmin },
    proofs: proofs.map((proof) => ({
      id: proof.id,
      reviewStatus: proof.reviewStatus,
      aiVerdict: proof.aiVerdict,
      aiConfidence: proof.aiConfidence,
      aiRationale: proof.aiRationale,
      aiModel: proof.aiModel,
      submittedAt: proof.submittedAt,
      durationS: proof.durationS,
    })),
    fundings: involved
      ? fundings.map((row) => ({
          id: row.id,
          funderId: row.funderId,
          amountCents: row.amountCents,
          status: row.status,
          captureMethod: row.captureMethod,
        }))
      : [],
  }
}
