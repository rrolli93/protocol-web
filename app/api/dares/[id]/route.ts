import { currentUser, json } from '@/lib/dare/http'
import { presentDare } from '@/lib/dare/present'
import { getRepo } from '@/lib/dare/runtime'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const repo = getRepo()
  const dare = await repo.getDare(id)
  if (!dare || dare.status === 'draft') return json({ error: 'Dare not found' }, 404)
  const viewer = await currentUser()
  return json({ dare: await presentDare(dare, repo, viewer) })
}
