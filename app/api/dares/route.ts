import { createDareForUser } from '@/lib/dare/create-dare'
import { isUser, json, requireUser } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'
import type { CreateDareInput } from '@/lib/dare/validation'

export async function POST(request: Request) {
  const user = await requireUser()
  if (!isUser(user)) return user
  const body = await request.json().catch(() => null) as CreateDareInput | null
  if (!body) return json({ error: 'Invalid JSON' }, 400)
  const created = await createDareForUser(body, user, getRepo())
  if (!created.ok) return json({ error: created.error }, created.status)
  return json({ dare: created.data, sharePath: `/dare/${created.data.id}/invite` }, 201)
}
