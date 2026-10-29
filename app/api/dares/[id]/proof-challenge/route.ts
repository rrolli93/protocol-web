import { isUser, json, requireUser } from '@/lib/dare/http'
import { issueProofChallenge } from '@/lib/dare/proof-service'
import { randomPhrase } from '@/lib/dare/phrase'
import { getRepo } from '@/lib/dare/runtime'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!isUser(user)) return user
  const { id } = await context.params
  const issued = await issueProofChallenge(id, user, getRepo(), randomPhrase())
  if (!issued.ok) return json({ error: issued.error }, issued.status)
  return json(issued.data)
}
