import { isAtLeast18 } from '@/lib/dare/validation'
import { isUser, json, requireUser } from '@/lib/dare/http'
import { notify } from '@/lib/dare/notify'
import { presentDare } from '@/lib/dare/present'
import { getRepo } from '@/lib/dare/runtime'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!isUser(user)) return user
  if (!user.ageConfirmed || !isAtLeast18(user.dob)) return json({ error: 'You need to confirm you are 18 or older' }, 403)
  const { id } = await context.params
  const repo = getRepo()
  const dare = await repo.getDare(id)
  if (!dare) return json({ error: 'Dare not found' }, 404)
  if (dare.mode !== 'funded') return json({ error: 'Solo dares are not accepted by someone else' }, 400)
  if (await repo.userHasFunding(id, user.id)) return json({ error: 'A funder does not also do the dare' }, 403)
  const accepted = await repo.setDoer(id, user.id)
  if (!accepted) return json({ error: 'This dare already has a doer' }, 409)
  const creator = await repo.getUser(dare.creatorId)
  await notify(repo, [creator, user], {
    dareId: id,
    type: 'accepted',
    title: 'Dare accepted',
    body: `${user.handle} will do “${dare.title}”.`,
  })
  const updated = await repo.getDare(id)
  if (!updated) return json({ error: 'Dare not found' }, 404)
  return json({ dare: await presentDare(updated, repo, user) })
}
