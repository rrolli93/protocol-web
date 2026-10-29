import { authorizeReview } from '@/lib/dare/authz'
import { isUser, json, requireUser } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'

export async function GET() {
  const user = await requireUser()
  if (!isUser(user)) return user
  if (!authorizeReview(user)) return json({ error: 'forbidden' }, 403)
  const repo = getRepo()
  const proofs = await repo.listReviewQueue()
  const rows = []
  for (const proof of proofs) {
    const dare = await repo.getDare(proof.dareId)
    rows.push({
      proof,
      dare: dare ? { id: dare.id, title: dare.title, rules: dare.rules, mode: dare.mode, deadlineAt: dare.deadlineAt, status: dare.status } : null,
    })
  }
  return json({ queue: rows })
}
