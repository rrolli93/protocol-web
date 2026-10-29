import { describe, expect, it } from 'vitest'
import { canReadProof, canWriteFunding } from '@/lib/dare/access'
import { findBannedTerm, isAtLeast18, validateCreateDare, validateDeadline } from '@/lib/dare/validation'
import {
  formatChf,
  idempotencyRefund,
  idempotencyTransfer,
  netPayoutCents,
  platformFeeCents,
  splitPayout,
  validateFundingAmount,
  validateMonthlyCap,
} from '@/lib/dare/money'
import { assertStripeTestKey } from '@/lib/dare/stripe-port'
import { paidModeEnabled } from '@/lib/dare/flags'
import { canTransition } from '@/lib/dare/transitions'
import { NOW, daysFromNow } from './helpers'

describe('money', () => {
  it('keeps a 10% fee on success and refunds the full bounty', () => {
    expect(platformFeeCents(10_000)).toBe(1_000)
    expect(netPayoutCents(10_000)).toBe(9_000)
    expect(platformFeeCents(2_550)).toBe(255)
    expect(netPayoutCents(2_550)).toBe(2_295)
    expect(formatChf(2_500)).toBe('CHF 25.00')
  })

  it('splits a multi-funder fee so the parts sum to the total', () => {
    const split = splitPayout([6_000, 4_000])
    expect(split.feeCents).toBe(1_000)
    expect(split.netCents).toBe(9_000)
    expect(split.parts.reduce((sum, part) => sum + part.netCents, 0)).toBe(9_000)
    expect(split.parts.reduce((sum, part) => sum + part.feeCents, 0)).toBe(1_000)
  })

  it('caps a single payment and the dare total', () => {
    expect(validateFundingAmount(999, 0)).toMatch(/CHF 20/)
    expect(validateFundingAmount(1_500, 0)).toMatch(/CHF 20/)
    expect(validateFundingAmount(10_001, 0)).toMatch(/CHF 100/)
    expect(validateFundingAmount(2_500, 0)).toBeNull()
    expect(validateFundingAmount(5_000, 6_000)).toMatch(/capped/)
    expect(validateMonthlyCap(45_000, 6_000)).toMatch(/500/)
    expect(idempotencyTransfer('abc')).toBe('dare:abc:transfer')
    expect(idempotencyRefund('abc', 'f1')).toBe('dare:abc:refund:f1')
  })

  it('leaves paid mode off unless the flag is exactly true', () => {
    expect(paidModeEnabled({})).toBe(false)
    expect(paidModeEnabled({ DARE_PAID_MODE: '1' })).toBe(false)
    expect(paidModeEnabled({ DARE_PAID_MODE: 'true' })).toBe(true)
  })

  it('refuses live Stripe keys', () => {
    expect(() => assertStripeTestKey('sk_live_123')).toThrow(/sk_test_/)
    expect(() => assertStripeTestKey('sk_test_123')).not.toThrow()
  })

  it('blocks dangerous dares and enforces the deadline and age rules', () => {
    expect(findBannedTerm('100 push-ups')).toBeNull()
    expect(findBannedTerm('hold child\'s pose for a minute')).toBeNull()
    expect(findBannedTerm('kidney-friendly walk')).toBeNull()
    expect(findBannedTerm('a rooftop handstand')).toBe('rooftop')
    expect(findBannedTerm('a nude dare')).toBe('nude')
    expect(findBannedTerm('sexual challenge')).toBe('sexual')
    expect(findBannedTerm('day of fasting')).toBe('fasting')
    const blocked = validateCreateDare({
      title: 'Beer mile',
      rules: 'Drink beer between each lap of the track.',
      category: 'fitness',
      mode: 'funded',
      deadlineAt: daysFromNow(3),
    }, NOW)
    expect(blocked.ok).toBe(false)
    expect(validateDeadline(daysFromNow(0.5), NOW)).toMatch(/24 hours/)
    expect(validateDeadline(daysFromNow(31), NOW)).toMatch(/30 days/)
    expect(validateDeadline(daysFromNow(30), NOW)).toBeNull()
    expect(isAtLeast18('2008-10-29', NOW)).toBe(true)
    expect(isAtLeast18('2008-10-30', NOW)).toBe(false)
    expect(isAtLeast18(null, NOW)).toBe(false)
  })

  it('does not let a stranger read a proof or write a funding', () => {
    expect(canReadProof('stranger', {
      doerId: 'doer',
      creatorId: 'creator',
      dareDoerId: 'doer',
      funderIds: ['funder'],
      isAdmin: false,
    })).toBe(false)
    expect(canReadProof('funder', {
      doerId: 'doer',
      creatorId: 'creator',
      dareDoerId: 'doer',
      funderIds: ['funder'],
      isAdmin: false,
    })).toBe(true)
    expect(canReadProof(null, {
      doerId: 'doer',
      creatorId: 'creator',
      dareDoerId: 'doer',
      funderIds: [],
      isAdmin: false,
    })).toBe(false)
    expect(canWriteFunding('authenticated')).toBe(false)
    expect(canWriteFunding('anon')).toBe(false)
    expect(canWriteFunding('service_role')).toBe(true)
    expect(canTransition('paid_out', 'paid_out')).toBe(false)
    expect(canTransition('completed', 'paid_out')).toBe(true)
  })
})
