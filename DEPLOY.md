# Deploy Dare on free tiers

Nothing here needs a paid plan. Paid mode stays off until you set `DARE_PAID_MODE=true`. The server refuses live Stripe keys (`sk_live_`, and publishable keys that are not `pk_test_`).

If you deploy with no keys, the app runs in demo mode: an in-memory store, a demo banner, simulated checkout, and persona buttons (doer, funder, reviewer). Data disappears when the server restarts. That is for previews only.

## 1. Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run, in order:
   - `supabase/migrations/20261029_dare_mvp.sql`
3. In Project Settings → API, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`)
4. Authentication → Providers: enable Email.
5. To make yourself a reviewer, run `update public.users set is_admin = true where email = 'you@example.com';` after you have signed up, or set `DARE_ADMIN_EMAILS=you@example.com`.

### Google sign-in (free)

Google Cloud and Supabase Auth are both free for this. Email and password stay as a fallback.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (the free tier is enough).
2. APIs & Services → OAuth consent screen. Choose External. App name: Dare. Add your email as a test user while the app is in Testing. You do not need to pay for verification for a private beta.
3. APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
4. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://YOUR_VERCEL_DOMAIN` (for example `https://protocol-web-theta.vercel.app`, or the new Dare domain)
5. Authorized redirect URI — paste Supabase’s callback, not the app’s:
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   - The project ref is the subdomain of `NEXT_PUBLIC_SUPABASE_URL`.
6. Copy the client ID and client secret.
7. In Supabase: Authentication → Providers → Google. Enable it and paste the client ID and secret.
8. Authentication → URL configuration:
   - Site URL: `http://localhost:3000` while you develop, then `https://YOUR_VERCEL_DOMAIN` for production.
   - Redirect URLs (allow-list), add each of these:
     - `http://localhost:3000/**`
     - `https://YOUR_VERCEL_DOMAIN/**`
   - Dare sends people back through `https://YOUR_DOMAIN/auth/callback?next=/dare/.../invite`. That URL must match the allow-list. A dare invite then returns the doer to the same link after Google.
9. No extra env vars. The anon key already talks to Supabase Auth. Without Supabase keys, the Google button still shows and signs in a demo user.

## 2. Stripe (test mode, free)

1. Stay in **Test mode** in the Stripe dashboard.
2. Developers → API keys:
   - Secret key `sk_test_…` → `STRIPE_SECRET_KEY`
   - Publishable key `pk_test_…` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Install the Stripe CLI and forward webhooks while developing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Put the printed `whsec_…` in `STRIPE_WEBHOOK_SECRET`. On Vercel, add an endpoint in Developers → Webhooks for `https://YOUR_DOMAIN/api/stripe/webhook` and the events `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`, `account.updated`, `transfer.reversed`. Use that endpoint’s signing secret in production.

4. Leave `DARE_PAID_MODE` unset or `false` until you want test charges. Turning it on does not switch Stripe to live mode. Do not paste a live secret.

Connect Express (doer payouts) uses the same test secret. The doer opens payout setup from the dare page. `account.updated` sets `payouts_enabled`.

## 3. Vercel Hobby

1. Import the GitHub repo. Framework preset: Next.js.
2. Environment variables (Production and Preview):

| Name | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API, server only |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` |
| `CRON_SECRET` | a long random string you invent |
| `DARE_ADMIN_EMAILS` | your email, optional if `is_admin` is set |
| `STRIPE_SECRET_KEY` | `sk_test_…` only, when you are ready |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `DARE_PAID_MODE` | `false` until you want test checkout |

Do not set `DARE_DEV_STORE` or `DARE_STRIPE_MOCK` on Vercel. Those are for a laptop.

3. Deploy. Vercel Hobby includes the hosting. No other paid add-on is required.

## 4. Scheduled jobs

Vercel Hobby cron can call these once a day. Send `Authorization: Bearer <CRON_SECRET>`.

- `POST /api/jobs/expire` — deadline passed with no proof → refund or charity mark
- `POST /api/jobs/release` — pay approved dares, retry a payout if Stripe failed mid-way
- `POST /api/jobs/retention` — delete proof rows older than 90 days

Example `vercel.json` crons can be added later. Until then, an admin can press “Run payout / refund job” on a dare, or you can curl the routes.

## 5. Fee model

Default is 10% taken from the bounty (`DARE_FEE_MODEL=percent`, `DARE_FEE_PERCENT_BPS=1000`) and a minimum bounty of CHF 20 (`DARE_MIN_BOUNTY_CENTS=2000`).

To charge the funder on top so the doer receives the full bounty:

```bash
DARE_FEE_MODEL=surcharge
DARE_SURCHARGE_FIXED_CENTS=200
DARE_SURCHARGE_BPS=500
```

That is CHF 2 + 5%. The breakdown is shown before payment. On a miss, the bounty is refunded and the surcharge is not, because Stripe does not return card fees. A flat 10% loses money below about CHF 42 and on every refund under Swiss Stripe pricing (2.9% + CHF 0.30 per charge, CHF 2 per monthly active Connect account, 0.25% + CHF 0.55 per payout).

## 6. Optional AI check (Gemini free tier)

Leave this unset to keep the stub, which queues every real upload for a person.

```bash
DARE_AI_PROVIDER=gemini
GEMINI_API_KEY=   # Google AI Studio, free tier
```

Limits: Gemini API quotas change and are small on the free tier. Clips over about 4 MB of base64 are not sent; those proofs are queued. Google’s Gemini API terms require users to be 18 or older. Video you send is processed by Google. If the call fails, the proof goes to the human queue.

## 7. Optional email

In-app notifications always work. Email is a no-op unless:

```bash
DARE_EMAIL_PROVIDER=resend
RESEND_API_KEY=
DARE_EMAIL_FROM=Dare <noreply@your-domain>
```

Resend’s free allowance is enough for a beta. If these are empty, nothing is sent.

## 8. USDC on Base Sepolia (optional, off by default)

This is a second rail. Stripe stays the default. Set `CRYPTO_RAIL_ENABLED=true` only when you want the wallet UI. It defaults off. The app refuses chain id 8453 (Base mainnet) before it will ask a wallet to send a transaction.

The parked `ProtocolEscrow` pooled-stake contract is not used. The rail is `contracts/src/DareEscrow.sol`. Findings and leftover risks are in `contracts/SECURITY.md`.

You deploy it yourself. Nothing in CI broadcasts a transaction.

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
forge test
# Base Sepolia only. Needs test ETH in the key. Do not point this at mainnet.
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export DARE_ORACLE=0xYourOracle
export DARE_TREASURY=0xYourTreasury
export DARE_OWNER=0xYourOwner
forge script script/DeploySepolia.s.sol --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --private-key "$SEPOLIA_DEPLOYER_KEY"
```

The script reverts unless `block.chainid` is 84532. USDC is the Circle test token `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

Then set `DARE_ESCROW_ADDRESS` to the logged address and `CRYPTO_RAIL_ENABLED=true`. Funders connect a wallet on Base Sepolia and deposit. The doer connects and calls `accept` (no tokens). Your oracle wallet calls `release`, `refund`, or `donate`. After the grace period, funders can `claimRefund` even if the oracle is gone.

Do not put a settler private key in the Next.js app. Settlement stays a wallet transaction so this environment never holds testnet keys.

## 10. What you still do by hand

- Run the SQL migration.
- Paste the keys above.
- Decide when `DARE_PAID_MODE=true` is appropriate. That still uses test keys only.
- Pick a licence. `LICENSE` is all-rights-reserved.
- Get a written answer on the Gespa / gambling question before any live payments. This deploy path never asks for live keys.
