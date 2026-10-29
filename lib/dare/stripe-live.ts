import Stripe from 'stripe'
import type { StripePort } from './stripe-port'
import { assertStripePublishableTestKey, assertStripeTestKey } from './stripe-port'

export function createLiveStripe(secretKey: string): StripePort {
  assertStripeTestKey(secretKey)
  const stripe = new Stripe(secretKey)

  return {
    async createCheckout(args) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        client_reference_id: args.fundingId,
        metadata: {
          dare_id: args.dareId,
          funding_id: args.fundingId,
          mode: args.mode,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'chf',
              unit_amount: args.amountCents,
              product_data: { name: args.productName },
            },
          },
        ],
        payment_intent_data: {
          transfer_group: args.dareId,
          capture_method: args.captureMethod,
          metadata: { dare_id: args.dareId, funding_id: args.fundingId },
        },
      }, { idempotencyKey: args.idempotencyKey })
      if (!session.url) throw new Error('Stripe Checkout did not return a URL')
      return { id: session.id, url: session.url }
    },

    async createTransfer(args) {
      let source = args.sourceTransaction ?? undefined
      if (!source && args.paymentIntentId) {
        const intent = await stripe.paymentIntents.retrieve(args.paymentIntentId)
        if (typeof intent.latest_charge === 'string') source = intent.latest_charge
      }
      const transfer = await stripe.transfers.create({
        amount: args.amountCents,
        currency: 'chf',
        destination: args.destination,
        transfer_group: args.dareId,
        ...(source ? { source_transaction: source } : {}),
      }, { idempotencyKey: args.idempotencyKey })
      return { id: transfer.id }
    },

    async createRefund(args) {
      const refund = await stripe.refunds.create({
        payment_intent: args.paymentIntentId,
        amount: args.amountCents,
      }, { idempotencyKey: args.idempotencyKey })
      return { id: refund.id }
    },

    async cancelPaymentIntent(args) {
      const intent = await stripe.paymentIntents.cancel(args.paymentIntentId, {}, { idempotencyKey: args.idempotencyKey })
      return { id: intent.id }
    },

    async capturePaymentIntent(args) {
      const intent = await stripe.paymentIntents.capture(args.paymentIntentId, {}, { idempotencyKey: args.idempotencyKey })
      return { id: intent.id }
    },

    async createExpressAccount(args) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: args.country,
        capabilities: { transfers: { requested: true } },
        metadata: { user_id: args.userId },
      })
      return { id: account.id }
    },

    async createAccountLink(args) {
      const link = await stripe.accountLinks.create({
        account: args.accountId,
        refresh_url: args.refreshUrl,
        return_url: args.returnUrl,
        type: 'account_onboarding',
      })
      return { url: link.url }
    },
  }
}

export function constructStripeEvent(rawBody: string, signature: string, webhookSecret: string, secretKey: string): Stripe.Event {
  assertStripeTestKey(secretKey)
  const stripe = new Stripe(secretKey)
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}

export function assertPublishableKeyConfigured(key: string | undefined): void {
  if (!key) return
  assertStripePublishableTestKey(key)
}
