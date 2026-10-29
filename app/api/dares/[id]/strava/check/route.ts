import { isUser, json, requireUser } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'
import { verifyDareFromStrava } from '@/lib/dare/strava-verify'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!isUser(user)) return user
  const { id } = await context.params
  const repo = getRepo()
  const dare = await repo.getDare(id)
  if (!dare) return json({ error: 'Dare not found' }, 404)
  if (dare.doerId !== user.id && !user.isAdmin) return json({ error: 'Only the doer can check Strava' }, 403)
  const result = await verifyDareFromStrava({ dare, repo })
  if (!result.ok) return json({ error: result.error }, result.status)
  const updated = await repo.getDare(id)
  return json({ ...result.data, status: updated?.status ?? dare.status })
}
