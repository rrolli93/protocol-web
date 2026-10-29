import { createDareForUser } from '@/lib/dare/create-dare'
import { startCheckout } from '@/lib/dare/checkout'
import { CHARITIES, createMemoryRepo, type DareRepo } from '@/lib/dare/repo'
import { MockStripe } from '@/lib/dare/stripe-port'
import type { Dare, User } from '@/lib/dare/types'
import { handleStripeEvent } from '@/lib/dare/webhook'

export const NOW = new Date('2026-10-29T12:00:00.000Z')

export function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

export function adult(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    handle: overrides.handle ?? 'ada',
    displayName: overrides.displayName ?? 'Ada',
    email: overrides.email ?? 'ada@example.com',
    avatarUrl: null,
    country: 'CH',
    createdAt: NOW.toISOString(),
    stripeAccountId: overrides.stripeAccountId ?? null,
    payoutsEnabled: overrides.payoutsEnabled ?? false,
    dob: overrides.dob ?? '1990-01-01',
    ageConfirmed: overrides.ageConfirmed ?? true,
    isAdmin: overrides.isAdmin ?? false,
  }
}

export async function seedPair(repo: DareRepo) {
  const funder = adult({ handle: 'funder', email: 'funder@example.com' })
  const doer = adult({
    handle: 'doer',
    email: 'doer@example.com',
    stripeAccountId: 'acct_test_doer',
    payoutsEnabled: true,
  })
  await repo.upsertUser(funder)
  await repo.upsertUser(doer)
  return { funder, doer }
}

export async function createFundedDare(repo: DareRepo, creator: User, opts?: { creatorIsDoer?: boolean; deadlineAt?: string }): Promise<Dare> {
  const created = await createDareForUser({
    title: '100 push-ups',
    rules: '100 push-ups in one unbroken set, on camera.',
    category: 'fitness',
    mode: 'funded',
    deadlineAt: opts?.deadlineAt ?? daysFromNow(10),
    framing: 'full body in frame',
    creatorIsDoer: opts?.creatorIsDoer ?? false,
  }, creator, repo, NOW)
  if (!created.ok) throw new Error(created.error)
  return created.data
}

export async function payBounty(repo: DareRepo, stripe: MockStripe, dareId: string, funder: User, amountCents = 2_500) {
  const checkout = await startCheckout({
    dareId,
    amountCents,
    user: funder,
    successUrl: 'http://localhost/checkout/success',
    cancelUrl: 'http://localhost/checkout/cancel',
    paidMode: true,
    now: NOW,
  }, repo, stripe)
  if (!checkout.ok) throw new Error(checkout.error)
  const applied = await handleStripeEvent({
    id: `evt_${checkout.data.fundingId.replace(/-/g, '')}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: checkout.data.sessionId,
        payment_intent: `pi_${checkout.data.fundingId.replace(/-/g, '')}`,
        payment_status: 'paid',
        metadata: { funding_id: checkout.data.fundingId, dare_id: dareId },
      },
    },
  }, repo)
  if (!applied.ok) throw new Error(applied.error)
  return checkout.data
}

export function fresh() {
  return { repo: createMemoryRepo(), stripe: new MockStripe() }
}

export const CHARITY_ID = CHARITIES[0].id
