import { gateJob } from '@/lib/dare/jobs'
import { currentUser, json } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'
import { verifyDareFromStrava } from '@/lib/dare/strava-verify'

export async function POST(request: Request) {
  const user = await currentUser()
  const gate = gateJob(user, request.headers.get('authorization'), request.headers.get('x-cron-secret'), process.env)
  if (!gate.ok) return json({ error: gate.error }, gate.status)
  const repo = getRepo()
  const dares = await repo.listStravaOpen()
  const results = []
  for (const dare of dares) {
    const checked = await verifyDareFromStrava({ dare, repo })
    results.push({ dareId: dare.id, ok: checked.ok, verified: checked.ok ? checked.data.verified : false, error: checked.ok ? null : checked.error })
  }
  return json({ checked: results.length, results })
}
