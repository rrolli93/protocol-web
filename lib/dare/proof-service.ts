import { createHash } from 'crypto'
import { notify } from './notify'
import { runProofPipeline, type ProofChecker, type ProofCheckInput } from './ai'
import { disputeWindowEnd } from './settlement'
import { newId, type DareRepo } from './repo'
import { fail, ok, type Proof, type Result, type User } from './types'

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function issueProofChallenge(dareId: string, user: User, repo: DareRepo, phrase: { codeWord: string; gesture: string }): Promise<Result<{ codeWord: string; gesture: string }>> {
  const dare = await repo.getDare(dareId)
  if (!dare) return fail(404, 'Dare not found')
  if (dare.doerId !== user.id) return fail(403, 'Only the doer can record proof')
  if (dare.status !== 'accepted') return fail(409, 'This dare is not ready for proof')
  const stored = await repo.setCodeWord(dareId, phrase.codeWord, phrase.gesture)
  if (!stored?.codeWord || !stored.gesture) return fail(500, 'Could not store the code word')
  return ok({ codeWord: stored.codeWord, gesture: stored.gesture })
}

export async function submitProof(args: {
  dareId: string
  user: User
  bytes: Uint8Array
  durationS: number
  spokenCodeWord: string
  repo: DareRepo
  checker: ProofChecker
  now?: Date
  fixture?: ProofCheckInput['fixture']
  allowFixtures?: boolean
  transcript?: string
}): Promise<Result<{ proof: Proof; outcome: string }>> {
  const now = args.now ?? new Date()
  const dare = await args.repo.getDare(args.dareId)
  if (!dare) return fail(404, 'Dare not found')
  if (dare.doerId !== args.user.id) return fail(403, 'Only the doer can submit proof')
  if (dare.status !== 'accepted') return fail(409, 'Proof is not open on this dare')
  if (new Date(dare.deadlineAt).getTime() < now.getTime()) return fail(409, 'The deadline has passed')
  if (!dare.codeWord || !dare.gesture) return fail(400, 'Start recording so a code word can be shown')
  if (args.spokenCodeWord.trim().toLowerCase() !== dare.codeWord.toLowerCase()) {
    return fail(400, 'The code word does not match the one shown at record start')
  }
  if (args.bytes.byteLength === 0) return fail(400, 'The video is empty')
  if (args.bytes.byteLength > 80 * 1024 * 1024) return fail(400, 'Videos are limited to 80 MB')
  if (args.durationS > 90) return fail(400, 'Clips are limited to 90 seconds')

  const hash = sha256(args.bytes)
  const duplicate = await args.repo.findProofByHash(hash)
  const proof: Proof = {
    id: newId(),
    dareId: dare.id,
    doerId: args.user.id,
    storagePath: `proofs/${dare.id}/${newId()}.webm`,
    durationS: args.durationS,
    sha256: hash,
    codeWord: dare.codeWord,
    submittedAt: now.toISOString(),
    aiVerdict: null,
    aiConfidence: null,
    aiRationale: null,
    aiModel: null,
    reviewStatus: 'none',
    reviewerId: null,
    reviewedAt: null,
    repCount: null,
    cutDetected: null,
  }
  await args.repo.createProof(proof)
  await args.repo.saveMedia(proof.id, args.bytes)
  const moved = await args.repo.transition(dare.id, 'proof_submitted', ['accepted'])
  if (!moved) return fail(409, 'Could not mark the dare as submitted')

  const bountyCents = await args.repo.sumCaptured(dare.id)
  const decision = await runProofPipeline({
    checker: args.checker,
    rules: dare.rules,
    codeWord: dare.codeWord,
    transcript: args.transcript,
    durationS: args.durationS,
    bountyCents,
    duplicateHash: Boolean(duplicate),
    beforeDeadline: true,
    fixture: args.fixture,
    allowFixtures: args.allowFixtures === true,
  })
  await args.repo.updateProof(proof.id, {
    aiVerdict: decision.verdict,
    aiConfidence: decision.confidence,
    aiRationale: decision.rationale,
    aiModel: decision.model,
    reviewStatus: decision.reviewStatus,
    repCount: decision.repCount,
    cutDetected: decision.cutDetected,
  })
  if (decision.outcome === 'auto_pass') {
    await args.repo.setDisputeWindow(dare.id, disputeWindowEnd(now))
    await args.repo.transition(dare.id, 'completed', ['proof_submitted'])
  } else if (decision.outcome === 'queue') {
    await args.repo.transition(dare.id, 'in_review', ['proof_submitted'])
  } else if (decision.retakeAllowed) {
    await args.repo.transition(dare.id, 'accepted', ['proof_submitted'])
  } else {
    await args.repo.transition(dare.id, 'failed', ['proof_submitted'])
  }
  await args.repo.logEvent(dare.id, 'proof_checked', { proofId: proof.id, outcome: decision.outcome, model: decision.model })
  const funders = await args.repo.listFundings(dare.id)
  const people = [await args.repo.getUser(dare.creatorId), args.user]
  for (const funding of funders) people.push(await args.repo.getUser(funding.funderId))
  await notify(args.repo, people, {
    dareId: dare.id,
    type: 'proof_submitted',
    title: 'Proof submitted',
    body: `A proof was submitted for “${dare.title}”.`,
  })
  const stored = await args.repo.getProof(proof.id)
  return ok({ proof: stored ?? proof, outcome: decision.outcome })
}
