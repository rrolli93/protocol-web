import { createProofChecker } from '@/lib/dare/ai'
import { aiFixturesAllowed } from '@/lib/dare/flags'
import { isUser, json, requireUser } from '@/lib/dare/http'
import { MAX_PROOF_BYTES } from '@/lib/dare/money'
import { submitProof } from '@/lib/dare/proof-service'
import { createRateLimiter } from '@/lib/dare/rate-limit'
import { getRepo } from '@/lib/dare/runtime'
import type { ProofCheckInput } from '@/lib/dare/ai'

const limit = createRateLimiter(8, 60_000)

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!isUser(user)) return user
  if (!limit(`proof:${user.id}`)) return json({ error: 'Too many uploads' }, 429)
  const { id } = await context.params
  const form = await request.formData()
  const file = form.get('video')
  if (!(file instanceof File)) return json({ error: 'Attach a video file' }, 400)
  if (file.size > MAX_PROOF_BYTES) return json({ error: 'Videos are limited to 200 MB' }, 400)
  const durationS = Number(form.get('durationS') ?? 0)
  const spokenCodeWord = String(form.get('codeWord') ?? '')
  const fixtureRaw = String(form.get('fixture') ?? '')
  const fixture = ['pass', 'fail', 'unsure', 'injection'].includes(fixtureRaw)
    ? fixtureRaw as ProofCheckInput['fixture']
    : undefined
  const bytes = new Uint8Array(await file.arrayBuffer())
  const result = await submitProof({
    dareId: id,
    user,
    bytes,
    durationS,
    spokenCodeWord,
    repo: getRepo(),
    checker: createProofChecker(),
    fixture,
    allowFixtures: aiFixturesAllowed(),
  })
  if (!result.ok) return json({ error: result.error }, result.status)
  return json({ proofId: result.data.proof.id, outcome: result.data.outcome, reviewStatus: result.data.proof.reviewStatus })
}
