export interface CheckoutArgs {
  amountCents: number
  dareId: string
  fundingId: string
  productName: string
  mode: 'funded' | 'solo'
  captureMethod: 'automatic' | 'manual'
  idempotencyKey: string
  successUrl: string
  cancelUrl: string
}

export interface TransferArgs {
  amountCents: number
  destination: string
  dareId: string
  idempotencyKey: string
  paymentIntentId?: string | null
  sourceTransaction?: string | null
}

export interface RefundArgs {
  paymentIntentId: string
  amountCents: number
  idempotencyKey: string
}

export interface StripePort {
  createCheckout(args: CheckoutArgs): Promise<{ id: string; url: string }>
  createTransfer(args: TransferArgs): Promise<{ id: string }>
  createRefund(args: RefundArgs): Promise<{ id: string }>
  cancelPaymentIntent(args: { paymentIntentId: string; idempotencyKey: string }): Promise<{ id: string }>
  capturePaymentIntent(args: { paymentIntentId: string; idempotencyKey: string }): Promise<{ id: string }>
  createExpressAccount(args: { userId: string; country: string }): Promise<{ id: string }>
  createAccountLink(args: { accountId: string; refreshUrl: string; returnUrl: string }): Promise<{ url: string }>
}

interface MockStore {
  transfers: Map<string, string>
  refunds: Map<string, string>
  voids: Map<string, string>
  captures: Map<string, string>
  transferCalls: TransferArgs[]
  refundCalls: RefundArgs[]
}

function emptyStore(): MockStore {
  return {
    transfers: new Map(),
    refunds: new Map(),
    voids: new Map(),
    captures: new Map(),
    transferCalls: [],
    refundCalls: [],
  }
}

const globalStore = emptyStore()

export function resetSharedMockStripe(): void {
  const fresh = emptyStore()
  globalStore.transfers = fresh.transfers
  globalStore.refunds = fresh.refunds
  globalStore.voids = fresh.voids
  globalStore.captures = fresh.captures
  globalStore.transferCalls = fresh.transferCalls
  globalStore.refundCalls = fresh.refundCalls
}

/**
 * Test-mode stand-in. Idempotency keys collapse to one transfer or refund,
 * including across instances that share the process store.
 */
export class MockStripe implements StripePort {
  readonly checkouts: CheckoutArgs[] = []
  readonly accounts: string[] = []

  constructor(private readonly store: MockStore = emptyStore()) {}

  static shared(): MockStripe {
    return new MockStripe(globalStore)
  }

  get transfers(): TransferArgs[] {
    return this.store.transferCalls
  }

  get refunds(): RefundArgs[] {
    return this.store.refundCalls
  }

  uniqueTransferIds(): string[] {
    return [...this.store.transfers.values()]
  }

  uniqueRefundIds(): string[] {
    return [...this.store.refunds.values()]
  }

  captureCount(): number {
    return this.store.captures.size
  }

  voidCount(): number {
    return this.store.voids.size
  }

  async createCheckout(args: CheckoutArgs): Promise<{ id: string; url: string }> {
    this.checkouts.push(args)
    const id = `cs_test_mock_${args.fundingId}`
    return { id, url: `/checkout/mock?session_id=${id}` }
  }

  async createTransfer(args: TransferArgs): Promise<{ id: string }> {
    const existing = this.store.transfers.get(args.idempotencyKey)
    if (existing) return { id: existing }
    const id = `tr_test_${this.store.transfers.size + 1}`
    this.store.transfers.set(args.idempotencyKey, id)
    this.store.transferCalls.push(args)
    return { id }
  }

  async createRefund(args: RefundArgs): Promise<{ id: string }> {
    const existing = this.store.refunds.get(args.idempotencyKey)
    if (existing) return { id: existing }
    const id = `re_test_${this.store.refunds.size + 1}`
    this.store.refunds.set(args.idempotencyKey, id)
    this.store.refundCalls.push(args)
    return { id }
  }

  async cancelPaymentIntent(args: { paymentIntentId: string; idempotencyKey: string }): Promise<{ id: string }> {
    const existing = this.store.voids.get(args.idempotencyKey)
    if (existing) return { id: existing }
    const id = `void_${args.paymentIntentId}`
    this.store.voids.set(args.idempotencyKey, id)
    return { id }
  }

  async capturePaymentIntent(args: { paymentIntentId: string; idempotencyKey: string }): Promise<{ id: string }> {
    const existing = this.store.captures.get(args.idempotencyKey)
    if (existing) return { id: existing }
    const id = `cap_${args.paymentIntentId}`
    this.store.captures.set(args.idempotencyKey, id)
    return { id }
  }

  async createExpressAccount(args: { userId: string }): Promise<{ id: string }> {
    const id = `acct_test_${args.userId.replace(/-/g, '').slice(0, 12)}`
    this.accounts.push(id)
    return { id }
  }

  async createAccountLink(args: { accountId: string }): Promise<{ url: string }> {
    return { url: `/connect/mock?account=${args.accountId}` }
  }
}

export function assertStripeTestKey(secretKey: string): void {
  if (!secretKey.startsWith('sk_test_')) {
    throw new Error('Refusing Stripe key. Dare accepts sk_test_ keys only.')
  }
}

export function assertStripePublishableTestKey(key: string): void {
  if (!key.startsWith('pk_test_')) {
    throw new Error('Refusing Stripe publishable key. Dare accepts pk_test_ keys only.')
  }
}
