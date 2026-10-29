import { gateJob, runRetentionJob } from '@/lib/dare/jobs'
import { currentUser, json } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'

export async function POST(request: Request) {
  const user = await currentUser()
  const gate = gateJob(user, request.headers.get('authorization'), request.headers.get('x-cron-secret'), process.env)
  if (!gate.ok) return json({ error: gate.error }, gate.status)
  const removed = await runRetentionJob(getRepo())
  return json({ removed })
}
