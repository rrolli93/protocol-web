import type { DareRepo } from './repo'
import type { Dare, User } from './types'

/** Visual progress for a dare card. Not a payment state. */
export function dareProgress(status: string): number {
  switch (status) {
    case 'draft': return 8
    case 'open': return 22
    case 'accepted': return 42
    case 'proof_submitted': return 64
    case 'in_review': return 76
    case 'completed': return 90
    case 'paid_out':
    case 'failed':
    case 'refunded':
    case 'cancelled':
      return 100
    default: return 0
  }
}

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
    failOutcome: dare.failOutcome,
    framing: dare.proofRequirements.framing,
    creatorId: dare.creatorId,
    doerId: dare.doerId,
    disputeWindowEndsAt: dare.disputeWindowEndsAt,
    codeWord: isDoer ? dare.codeWord : null,
    gesture: isDoer ? dare.gesture : null,
    proofKind: dare.proofKind,
    acceptedAt: dare.acceptedAt,
    strava: dare.strava,
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
      kind: proof.kind ?? 'video',
      capturedAt: proof.capturedAt ?? proof.submittedAt,
      latitude: proof.latitude ?? null,
      longitude: proof.longitude ?? null,
      stravaActivityId: proof.stravaActivityId ?? null,
      stravaName: proof.stravaName ?? null,
      stravaDistanceM: proof.stravaDistanceM ?? null,
      stravaMovingTimeS: proof.stravaMovingTimeS ?? null,
      stravaElevationM: proof.stravaElevationM ?? null,
      stravaPolyline: proof.stravaPolyline ?? null,
      stravaDeviceName: proof.stravaDeviceName ?? null,
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
