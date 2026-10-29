import { gateJob, runExpireJob } from '@/lib/dare/jobs'
import { currentUser, json } from '@/lib/dare/http'
import { getRepo, getStripe } from '@/lib/dare/runtime'

export async function POST(request: Request) {
  const user = await currentUser()
  const gate = gateJob(user, request.headers.get('authorization'), request.headers.get('x-cron-secret'), process.env)
  if (!gate.ok) return json({ error: gate.error }, gate.status)
  try {
    const results = await runExpireJob(getRepo(), getStripe())
    return json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Expire job failed'
    return json({ error: message }, 500)
  }
}
