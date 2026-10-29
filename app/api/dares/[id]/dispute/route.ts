import { openDispute } from '@/lib/dare/disputes'
import { isUser, json, requireUser } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!isUser(user)) return user
  const { id } = await context.params
  const body = await request.json().catch(() => ({})) as { reason?: string }
  const result = await openDispute({ dareId: id, user, reason: body.reason ?? '', repo: getRepo() })
  if (!result.ok) return json({ error: result.error }, result.status)
  return json(result.data)
}
