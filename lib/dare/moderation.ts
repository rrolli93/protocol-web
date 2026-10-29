import { newId, type DareRepo } from './repo'
import { refundDare } from './settlement'
import type { StripePort } from './stripe-port'
import { fail, ok, type DareStatus, type Result, type User } from './types'

const CANCELLABLE: DareStatus[] = ['open', 'accepted', 'proof_submitted', 'in_review', 'completed', 'failed']

export async function reportDare(args: {
  dareId: string
  reporter: User | null
  reason: string
  repo: DareRepo
}): Promise<Result<{ id: string }>> {
  const reason = args.reason.trim()
  if (reason.length < 5 || reason.length > 1_000) return fail(400, 'Describe the problem in 5–1000 characters')
  const dare = await args.repo.getDare(args.dareId)
  if (!dare) return fail(404, 'Dare not found')
  const id = newId()
  await args.repo.createReport({
    id,
    dareId: dare.id,
    reporterId: args.reporter?.id ?? null,
    reason,
    createdAt: new Date().toISOString(),
  })
  await args.repo.logEvent(dare.id, 'report', { reportId: id, reporterId: args.reporter?.id ?? null })
  return ok({ id })
}

export async function adminCancelDare(args: {
  dareId: string
  admin: User
  reason: string
  repo: DareRepo
  stripe: StripePort
}): Promise<Result<{ status: string }>> {
  if (!args.admin.isAdmin) return fail(403, 'Only an admin can cancel a dare')
  const reason = args.reason.trim()
  if (reason.length < 3) return fail(400, 'Give a short reason')
  const dare = await args.repo.getDare(args.dareId)
  if (!dare) return fail(404, 'Dare not found')
  if (dare.status === 'paid_out') return fail(409, 'This dare is already paid out')
  if (dare.status === 'cancelled' || dare.status === 'refunded') {
    return ok({ status: dare.status })
  }
  if (CANCELLABLE.includes(dare.status) && dare.status !== 'failed' && dare.status !== 'completed') {
    await args.repo.transition(dare.id, 'cancelled', [dare.status])
  }
  await args.repo.logEvent(dare.id, 'admin_cancel', { adminId: args.admin.id, reason })
  if (dare.mode === 'funded') {
    const settled = await refundDare(dare.id, args.repo, args.stripe, { allowFrom: ['cancelled', 'failed', 'completed'], reason })
    if (!settled.ok && settled.status !== 409) return settled
  }
  const current = await args.repo.getDare(dare.id)
  return ok({ status: current?.status ?? 'cancelled' })
}
