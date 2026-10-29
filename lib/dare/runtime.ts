import { isAdminEmail, devStoreEnabled, paidModeEnabled, simulatedPayments, stripeMockEnabled, supabaseConfigured, type DareEnv } from './flags'
import { cryptoRailEnabled } from './crypto'
import { feeConfig } from './money'
import { createMemoryRepo, type DareRepo } from './repo'
import { createLiveStripe } from './stripe-live'
import { MockStripe, type StripePort } from './stripe-port'
import { createSupabaseDareRepo } from './supabase-repo'
import type { User } from './types'

let memory: DareRepo | null = null
let memoryStripe: MockStripe | null = null

export function getRepo(env: DareEnv = process.env): DareRepo {
  if (devStoreEnabled(env)) {
    if (!memory) memory = createMemoryRepo({ seedDemo: true })
    return memory
  }
  return createSupabaseDareRepo()
}

export function resetRuntimeForTests(): void {
  memory = null
  memoryStripe = null
}

export function getStripe(env: DareEnv = process.env): StripePort {
  if (stripeMockEnabled(env)) {
    if (!memoryStripe) memoryStripe = MockStripe.shared()
    return memoryStripe
  }
  const key = env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return createLiveStripe(key)
}

export function publicConfig(env: DareEnv = process.env) {
  const fees = feeConfig(env)
  return {
    paidMode: paidModeEnabled(env),
    simulatedPayments: simulatedPayments(env),
    stripeMock: stripeMockEnabled(env),
    devStore: devStoreEnabled(env),
    supabase: supabaseConfigured(env),
    currency: 'CHF' as const,
    aiFixtures: env.DARE_AI_ALLOW_FIXTURES === 'true',
    fees,
    cryptoRail: cryptoRailEnabled(env),
    escrowAddress: env.DARE_ESCROW_ADDRESS ?? null,
    cryptoChainId: 84532,
  }
}

export function applyAdminFlag(user: User, env: DareEnv = process.env): User {
  if (user.isAdmin || isAdminEmail(user.email, env)) {
    return { ...user, isAdmin: true }
  }
  return user
}
