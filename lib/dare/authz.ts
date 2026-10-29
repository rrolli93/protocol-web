import type { DareEnv } from './flags'
import type { User } from './types'

export function assertCronSecret(authorization: string | null, altSecret: string | null, env: DareEnv): boolean {
  const secret = env.CRON_SECRET
  if (!secret) return false
  if (authorization === `Bearer ${secret}`) return true
  if (altSecret && altSecret === secret) return true
  return false
}

/** Jobs refuse anonymous callers. A missing CRON_SECRET does not leave them open. */
export function authorizeJob(user: Pick<User, 'isAdmin'> | null, authorization: string | null, altSecret: string | null, env: DareEnv): { ok: true } | { ok: false; status: 401 | 403; error: string } {
  if (assertCronSecret(authorization, altSecret, env)) return { ok: true }
  if (!user) return { ok: false, status: 401, error: 'unauthorized' }
  if (!user.isAdmin) return { ok: false, status: 403, error: 'forbidden' }
  return { ok: true }
}

export function authorizeReview(user: Pick<User, 'isAdmin'> | null): boolean {
  return user?.isAdmin === true
}

/** Funded mode: the person who will do the dare never sends money. */
export function doerMayFund(doerId: string | null, funderId: string): boolean {
  return !doerId || doerId !== funderId
}
