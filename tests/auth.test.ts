import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { authorizeJob, authorizeReview, doerMayFund } from '@/lib/dare/authz'
import { gateJob } from '@/lib/dare/jobs'
import { SIGNED_URL_TTL_SECONDS } from '@/lib/dare/money'
import { createRateLimiter } from '@/lib/dare/rate-limit'
import { renderShareCard } from '@/lib/dare/share'
import { handleStripeEvent } from '@/lib/dare/webhook'
import { startCheckout } from '@/lib/dare/checkout'
import { adult, createFundedDare, fresh, NOW } from './helpers'

describe('auth and webhooks', () => {
  it('rejects anonymous and non-admin settlement calls', () => {
    const env = { CRON_SECRET: 'cron-secret' }
    expect(gateJob(null, null, null, env)).toMatchObject({ ok: false, status: 401 })
    expect(gateJob(null, 'Bearer wrong', null, env)).toMatchObject({ ok: false, status: 401 })
    expect(gateJob(null, 'Bearer cron-secret', null, {})).toMatchObject({ ok: false, status: 401 })
    expect(gateJob(adult(), null, null, env)).toMatchObject({ ok: false, status: 403 })
    expect(gateJob(adult({ isAdmin: true }), null, null, env).ok).toBe(true)
    expect(authorizeJob(null, 'Bearer cron-secret', null, env).ok).toBe(true)
    expect(authorizeReview(adult())).toBe(false)
    expect(authorizeReview(adult({ isAdmin: true }))).toBe(true)
  })

  it('stops the doer from funding their own dare', async () => {
    const { repo, stripe } = fresh()
    const doer = adult()
    await repo.upsertUser(doer)
    const dare = await createFundedDare(repo, doer, { creatorIsDoer: true })
    const result = await startCheckout({
      dareId: dare.id,
      amountCents: 2_000,
      user: doer,
      successUrl: 'http://localhost/ok',
      cancelUrl: 'http://localhost/no',
      paidMode: true,
      now: NOW,
    }, repo, stripe)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
    expect(doerMayFund(doer.id, doer.id)).toBe(false)
  })

  it('refuses checkout while paid mode is off', async () => {
    const { repo, stripe } = fresh()
    const funder = adult()
    await repo.upsertUser(funder)
    const dare = await createFundedDare(repo, funder)
    const result = await startCheckout({
      dareId: dare.id,
      amountCents: 2_000,
      user: funder,
      successUrl: 'http://localhost/ok',
      cancelUrl: 'http://localhost/no',
      paidMode: false,
      now: NOW,
    }, repo, stripe)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Paid mode/)
    expect(stripe.checkouts).toHaveLength(0)
  })

  it('treats a replayed Stripe event as a no-op', async () => {
    const { repo, stripe } = fresh()
    const funder = adult()
    await repo.upsertUser(funder)
    const dare = await createFundedDare(repo, funder)
    const checkout = await startCheckout({
      dareId: dare.id,
      amountCents: 2_000,
      user: funder,
      successUrl: 'http://localhost/ok',
      cancelUrl: 'http://localhost/no',
      paidMode: true,
      now: NOW,
    }, repo, stripe)
    if (!checkout.ok) throw new Error(checkout.error)
    const event = {
      id: 'evt_replay_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: checkout.data.sessionId,
          payment_intent: 'pi_replay_1',
          payment_status: 'paid',
          metadata: { funding_id: checkout.data.fundingId },
        },
      },
    }
    const first = await handleStripeEvent(event, repo)
    const second = await handleStripeEvent(event, repo)
    expect(first.ok && first.data.duplicate).toBe(false)
    expect(second.ok && second.data.duplicate).toBe(true)
    const funding = await repo.getFunding(checkout.data.fundingId)
    expect(funding?.status).toBe('captured')
    expect(funding?.amountCents).toBe(2_000)
  })

  it('renders a share card and signs proof URLs for 10 minutes', () => {
    const svg = renderShareCard({ title: '100 push-ups', result: 'Done', amountLabel: 'CHF 25.00' })
    expect(svg).toContain('<svg')
    expect(svg).toContain('100 push-ups')
    expect(svg).toContain('Done')
    expect(SIGNED_URL_TTL_SECONDS).toBe(600)
    const allow = createRateLimiter(2, 1_000)
    expect(allow('checkout:1', 0)).toBe(true)
    expect(allow('checkout:1', 10)).toBe(true)
    expect(allow('checkout:1', 20)).toBe(false)
  })

  it('locks proofs and fundings down in the migration', () => {
    const sql = readFileSync('supabase/migrations/20261029_dare_mvp.sql', 'utf8')
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.fundings FROM anon, authenticated/)
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.proofs FROM anon, authenticated/)
    expect(sql).toContain('transition_dare')
    expect(sql).toContain('claim_dare_payout')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('doer cannot fund')
    const proofsPolicy = sql.slice(sql.indexOf('proofs_select'), sql.indexOf('fundings_select'))
    expect(proofsPolicy).not.toContain('USING (true)')
    expect(proofsPolicy).toContain('auth.uid()')
  })
})
