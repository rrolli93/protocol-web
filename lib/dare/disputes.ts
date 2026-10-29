import { newId, type DareRepo } from './repo'
import { fail, ok, type Result, type User } from './types'

export async function openDispute(args: {
  dareId: string
  user: User
  reason: string
  repo: DareRepo
  now?: Date
}): Promise<Result<{ disputeId: string }>> {
  const reason = args.reason.trim()
  if (reason.length < 5 || reason.length > 1_000) return fail(400, 'Give a reason between 5 and 1000 characters')
  const dare = await args.repo.getDare(args.dareId)
  if (!dare) return fail(404, 'Dare not found')
  if (dare.mode !== 'funded') return fail(400, 'Solo pledges are not disputed')
  if (dare.status !== 'completed') return fail(409, 'Disputes open only during the window after an automatic pass')
  const now = args.now ?? new Date()
  if (!dare.disputeWindowEndsAt || new Date(dare.disputeWindowEndsAt).getTime() <= now.getTime()) {
    return fail(409, 'The dispute window has closed')
  }
  const isFunder = await args.repo.userHasFunding(dare.id, args.user.id)
  if (!isFunder) return fail(403, 'Only a funder can dispute')
  const existing = await args.repo.listDisputes(dare.id)
  if (existing.some((row) => row.status === 'open')) return fail(409, 'A dispute is already open')
  const moved = await args.repo.transition(dare.id, 'in_review', ['completed'])
  if (!moved) return fail(409, 'Could not move the dare into review')
  const dispute = await args.repo.createDispute({
    id: newId(),
    dareId: dare.id,
    openedBy: args.user.id,
    reason,
    status: 'open',
    createdAt: now.toISOString(),
  })
  return ok({ disputeId: dispute.id })
}
