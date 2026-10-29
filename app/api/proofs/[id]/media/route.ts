import { canReadProof } from '@/lib/dare/access'
import { currentUser, json } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  const { id } = await context.params
  const repo = getRepo()
  const proof = await repo.getProof(id)
  if (!proof) return json({ error: 'Proof not found' }, 404)
  const dare = await repo.getDare(proof.dareId)
  if (!dare) return json({ error: 'Dare not found' }, 404)
  const fundings = await repo.listFundings(dare.id)
  const allowed = canReadProof(user.id, {
    doerId: proof.doerId,
    creatorId: dare.creatorId,
    dareDoerId: dare.doerId,
    funderIds: fundings.map((row) => row.funderId),
    isAdmin: user.isAdmin,
  })
  if (!allowed) return json({ error: 'forbidden' }, 403)
  const signed = await repo.signedMediaUrl(proof.id)
  if (signed) return Response.redirect(signed, 302)
  const bytes = await repo.readMedia(proof.id)
  if (!bytes) return json({ error: 'Video missing' }, 404)
  return new Response(new Blob([Buffer.from(bytes)]), { headers: { 'content-type': 'video/webm' } })
}
