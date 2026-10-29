import { devStoreEnabled, stripeMockEnabled } from '@/lib/dare/flags'
import { isUser, json, requireUser } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'

export async function POST() {
  if (!stripeMockEnabled() && !devStoreEnabled()) return json({ error: 'not found' }, 404)
  const user = await requireUser()
  if (!isUser(user)) return user
  const repo = getRepo()
  if (!user.stripeAccountId) {
    await repo.setStripeAccount(user.id, `acct_test_${user.id.replace(/-/g, '').slice(0, 12)}`)
  }
  await repo.setPayoutsEnabled(user.id, true)
  return json({ payoutsEnabled: true })
}
