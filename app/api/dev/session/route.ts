import { devUser, type DevPersona } from '@/lib/dare/dev'
import { devStoreEnabled } from '@/lib/dare/flags'
import { json } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'

export async function POST(request: Request) {
  if (!devStoreEnabled()) return json({ error: 'not found' }, 404)
  const body = await request.json().catch(() => ({})) as { persona?: string }
  const persona = body.persona
  if (persona !== 'doer' && persona !== 'funder' && persona !== 'admin') {
    return json({ error: 'persona must be doer, funder, or admin' }, 400)
  }
  const user = devUser(persona as DevPersona)
  const existing = await getRepo().getUser(user.id)
  await getRepo().upsertUser(existing ? { ...user, stripeAccountId: existing.stripeAccountId, payoutsEnabled: existing.payoutsEnabled } : user)
  const response = json({ user: { id: user.id, handle: user.handle, isAdmin: user.isAdmin } })
  response.cookies.set('dare_dev_user', user.id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  return response
}

export async function DELETE() {
  const response = json({ ok: true })
  response.cookies.set('dare_dev_user', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}
