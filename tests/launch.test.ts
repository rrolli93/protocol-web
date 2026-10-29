import { describe, expect, it } from 'vitest'
import { devStoreEnabled, paidModeEnabled, simulatedPayments, supabaseConfigured } from '@/lib/dare/flags'
import { parseGeminiText } from '@/lib/dare/gemini'
import { createProofChecker } from '@/lib/dare/ai'
import { adminCancelDare, reportDare } from '@/lib/dare/moderation'
import { createEmailSender, notify } from '@/lib/dare/notify'
import { shareText } from '@/lib/dare/share'
import { adult, createFundedDare, fresh, NOW, payBounty, seedPair } from './helpers'

describe('launch surfaces', () => {
  it('runs as a demo when Supabase and Stripe are missing, and keeps paid mode off', () => {
    expect(devStoreEnabled({})).toBe(true)
    expect(simulatedPayments({})).toBe(true)
    expect(paidModeEnabled({})).toBe(false)
    expect(supabaseConfigured({})).toBe(false)
    expect(devStoreEnabled({
      DARE_DEV_STORE: 'supabase',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    })).toBe(false)
    expect(simulatedPayments({ STRIPE_SECRET_KEY: 'sk_test_123' })).toBe(false)
    expect(simulatedPayments({ DARE_STRIPE_MOCK: 'false' })).toBe(false)
    expect(createProofChecker({}).id).toBe('mock-proof-v1')
    expect(createProofChecker({ DARE_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test' }).id).toBe('gemini-2.0-flash')
  })

  it('parses Gemini JSON and treats junk as unusable', () => {
    expect(parseGeminiText('sure {"verdict":"pass","confidence":0.9}')).toMatchObject({ verdict: 'pass' })
    expect(parseGeminiText('no json here')).toBeNull()
  })

  it('stores a waitlist email once and writes an in-app notification without sending email', async () => {
    const { repo } = fresh()
    expect(await repo.joinWaitlist('Ada@Example.com')).toBe('created')
    expect(await repo.joinWaitlist('ada@example.com')).toBe('exists')
    const user = adult()
    await repo.upsertUser(user)
    const sent: string[] = []
    await notify(repo, [user], {
      dareId: null,
      type: 'accepted',
      title: 'Dare accepted',
      body: 'You are in.',
    }, { async send() { sent.push('sent') } })
    const notes = await repo.listNotifications(user.id)
    expect(notes).toHaveLength(1)
    expect(notes[0].title).toBe('Dare accepted')
    expect(sent).toEqual(['sent'])
    const skipped: string[] = []
    await createEmailSender({}).send({ to: 'a@b.c', subject: 'x', text: 'y' })
    expect(skipped).toEqual([])
  })

  it('lets an admin cancel and refund, and anyone report', async () => {
    const { repo, stripe } = fresh()
    const { funder, doer } = await seedPair(repo)
    const admin = adult({ handle: 'reviewer', isAdmin: true })
    await repo.upsertUser(admin)
    const dare = await createFundedDare(repo, funder)
    await repo.setDoer(dare.id, doer.id)
    await payBounty(repo, stripe, dare.id, funder, 2_000)
    const reported = await reportDare({ dareId: dare.id, reporter: funder, reason: 'This looks dangerous.', repo })
    expect(reported.ok).toBe(true)
    const blocked = await adminCancelDare({ dareId: dare.id, admin: funder, reason: 'no', repo, stripe })
    expect(blocked.ok).toBe(false)
    const cancelled = await adminCancelDare({ dareId: dare.id, admin, reason: 'Against the rules', repo, stripe })
    expect(cancelled.ok).toBe(true)
    expect(stripe.refunds).toHaveLength(1)
    expect(stripe.transfers).toHaveLength(0)
  })

  it('writes share text a chat app can preview', () => {
    const copy = shareText({ title: '100 push-ups', bountyCents: 2500, status: 'accepted' })
    expect(copy.title).toContain('100 push-ups')
    expect(copy.description).toMatch(/doer never pays/i)
    expect(copy.description).toMatch(/CHF 25/)
  })
})
