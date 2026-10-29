# Dare

Friends fund bounties for physical challenges. The doer stakes nothing. A funder pays CHF 10–100 with Stripe. The doer submits video proof. An AI check plus a human queue decides the edge cases. Done pays the doer the bounty minus a 10% fee. Missed refunds the funder in full. Solo mode can be free, or a personal pledge that comes back on success and is marked for charity on a miss.

Paid mode is off unless `DARE_PAID_MODE=true`. The server accepts Stripe **test** keys only (`sk_test_`, `pk_test_`).

If Supabase and Stripe are not configured, the app runs in demo mode with a banner, simulated checkout, and in-memory data. See `DEPLOY.md` for the free-tier deploy and the fee model (`percent` or `surcharge`).

The old USDC escrow path is parked. It is not used to create, fund, or settle a dare.

## Run it locally

```bash
cp .env.example .env.local
npm install
```

Apply `supabase/migrations/20261029_dare_mvp.sql` to the Supabase project (SQL editor or `supabase db push`), then set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Stripe test mode

1. In the Stripe dashboard, stay in **Test mode**.
2. Put `sk_test_...` in `STRIPE_SECRET_KEY` and `pk_test_...` in `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. Set `DARE_PAID_MODE=true`.
4. Forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`.

5. `npm run dev` and open http://localhost:3000.
6. Create a dare, copy the invite link, pay with test card `4242 4242 4242 4242`, upload proof, approve or reject it in the review queue, then settle.

Settlement jobs (both require `CRON_SECRET`; there is no open trigger):

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/jobs/release
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/jobs/expire
```

Use idempotency keys `dare:{id}:transfer` and `dare:{id}:refund:{fundingId}`. Running a job twice does not pay or refund twice.

Connect Express onboarding for the doer runs the first time they cash out. `account.updated` sets `payouts_enabled`. If the doer is still not enabled 30 days after the deadline, the funder is refunded.

### Without Stripe or Supabase keys

```bash
DARE_DEV_STORE=memory
DARE_STRIPE_MOCK=true
DARE_PAID_MODE=true
DARE_AI_ALLOW_FIXTURES=true
CRON_SECRET=dev-only
```

The banner at the top of the page switches a local doer, funder, or reviewer. Checkout shows a test confirmation instead of Stripe. Do not set `DARE_DEV_STORE` or `DARE_STRIPE_MOCK` on a shared deployment.

## Scripts

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Hardening checklist

- [x] Strava debug route removed (it returned tokens).
- [x] HealthKit sync removed (it wrote with the service role and trusted `userId`).
- [x] Strava and Oura sync require the signed-in user. OAuth callbacks refuse a mismatched `state`.
- [x] Parked USDC settlement requires `CRON_SECRET` and claims the challenge row before balance updates.
- [x] Dare settlement is authenticated (cron secret or admin) and idempotent.
- [x] Webhook signatures are verified. Event ids are stored. A replay is a no-op.
- [x] Live Stripe keys are rejected.
- [x] Paid mode defaults off.
- [x] Proof bucket is private. Signed URLs last 10 minutes (`SIGNED_URL_TTL_SECONDS`).
- [x] Proof retention job deletes clips older than 90 days.
- [x] Rate limits on checkout, proof upload, and review.
- [x] CSP and basic security headers.
- [x] RLS: authenticated users cannot insert fundings, proofs, or payouts. Proof reads are limited to the doer, the creator, a funder, or an admin.
- [ ] Sentry: set a DSN later if you want it. Nothing is shipped to a vendor by default.
- [ ] Real multimodal model: set `DARE_AI_PROVIDER=http`, `DARE_AI_API_URL`, and `DARE_AI_API_KEY`. Until then the mock queues proofs for a person.

## What is stubbed

- AI proof check (pluggable interface, mock provider, no key required).
- ffprobe / speech-to-text (duration is taken from the client; the mock does not call a model).
- Charity disbursement (a miss sets `fundings.status = donated` and stores the charity id).
- Stripe Connect KYC when mock mode is on (a button marks `payouts_enabled`).
- Sentry.
