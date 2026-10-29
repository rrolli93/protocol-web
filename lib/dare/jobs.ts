import { authorizeJob } from './authz'
import type { DareEnv } from './flags'
import { PROOF_RETENTION_MS } from './money'
import type { DareRepo } from './repo'
import { refundDare, releasePayout, settleSoloMiss, settleSoloSuccess } from './settlement'
import type { StripePort } from './stripe-port'
import type { Result, User } from './types'

export async function runExpireJob(repo: DareRepo, stripe: StripePort, now = new Date()): Promise<Result<unknown>[]> {
  const due = await repo.listExpirable(now)
  const results: Result<unknown>[] = []
  for (const dare of due) {
    if (dare.mode === 'solo') {
      results.push(await settleSoloMiss(dare.id, repo, stripe))
      continue
    }
    await repo.transition(dare.id, 'failed', ['open', 'accepted'])
    results.push(await refundDare(dare.id, repo, stripe))
  }
  for (const dare of await repo.listRefundRetries()) {
    results.push(await refundDare(dare.id, repo, stripe))
  }
  return results
}

export async function runReleaseJob(repo: DareRepo, stripe: StripePort, now = new Date()): Promise<Result<unknown>[]> {
  const due = [...await repo.listSettleable(now), ...await repo.listPayoutRetries()]
  const seen = new Set<string>()
  const results: Result<unknown>[] = []
  for (const dare of due) {
    if (seen.has(dare.id)) continue
    seen.add(dare.id)
    if (dare.mode === 'solo') results.push(await settleSoloSuccess(dare.id, repo, stripe))
    else results.push(await releasePayout(dare.id, repo, stripe, now))
  }
  return results
}

export async function runRetentionJob(repo: DareRepo, now = new Date()): Promise<string[]> {
  const expired = await repo.listExpiredProofs(now)
  const removed: string[] = []
  for (const proof of expired) {
    if (now.getTime() - new Date(proof.submittedAt).getTime() < PROOF_RETENTION_MS) continue
    await repo.deleteProof(proof.id)
    await repo.logEvent(proof.dareId, 'proof_deleted', { proofId: proof.id })
    removed.push(proof.id)
  }
  return removed
}

export function gateJob(user: User | null, authorization: string | null, alt: string | null, env: DareEnv) {
  return authorizeJob(user, authorization, alt, env)
}
