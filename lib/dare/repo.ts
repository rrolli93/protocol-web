import { randomUUID } from 'crypto'
import { PROOF_RETENTION_MS } from './money'
import { canTransition } from './transitions'
import type {
  Charity,
  Dare,
  DareEvent,
  DareStatus,
  Dispute,
  Funding,
  Payout,
  Proof,
  User,
} from './types'

export const CHARITIES: Charity[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Swiss Red Cross',
    url: 'https://www.redcross.ch',
    active: true,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Médecins Sans Frontières',
    url: 'https://www.msf.ch',
    active: true,
  },
]

export interface PayoutClaim {
  claimed: boolean
  payout: Payout | null
  reason?: 'exists' | 'dispute_window' | 'bad_status'
}

export interface DareRepo {
  getUser(id: string): Promise<User | null>
  getUserByStripeAccount(accountId: string): Promise<User | null>
  upsertUser(user: User): Promise<User>
  setStripeAccount(userId: string, accountId: string): Promise<void>
  setPayoutsEnabled(userId: string, enabled: boolean): Promise<void>
  setPayoutsEnabledByAccount(accountId: string, enabled: boolean): Promise<void>

  createDare(dare: Dare): Promise<Dare>
  getDare(id: string): Promise<Dare | null>
  listDaresForUser(userId: string): Promise<Dare[]>
  listExpirable(now: Date): Promise<Dare[]>
  listSettleable(now: Date): Promise<Dare[]>
  listPayoutRetries(): Promise<Dare[]>
  listRefundRetries(): Promise<Dare[]>
  listStravaOpen(): Promise<Dare[]>
  setCodeWord(dareId: string, codeWord: string, gesture: string): Promise<Dare | null>
  setDoer(dareId: string, doerId: string): Promise<boolean>
  setDisputeWindow(dareId: string, endsAt: string | null): Promise<void>
  transition(dareId: string, to: DareStatus, from: DareStatus[]): Promise<boolean>

  createFunding(funding: Funding): Promise<Funding>
  getFunding(id: string): Promise<Funding | null>
  getFundingBySession(sessionId: string): Promise<Funding | null>
  getFundingByPaymentIntent(paymentIntentId: string): Promise<Funding | null>
  listFundings(dareId: string): Promise<Funding[]>
  attachCheckoutSession(fundingId: string, sessionId: string): Promise<void>
  markFundingCaptured(fundingId: string, paymentIntentId: string, chargeId: string | null): Promise<void>
  markFundingAuthorized(fundingId: string, paymentIntentId: string): Promise<void>
  sumCommitted(dareId: string): Promise<number>
  sumCaptured(dareId: string): Promise<number>
  sumFunderMonth(funderId: string, now: Date): Promise<number>
  userHasFunding(dareId: string, userId: string): Promise<boolean>
  claimFundingRefund(fundingId: string): Promise<boolean>
  markFundingRefunded(fundingId: string, refundId: string): Promise<void>
  markFundingDonated(fundingId: string): Promise<boolean>

  claimPayout(dareId: string, amounts: { grossCents: number; feeCents: number; netCents: number }, now: Date): Promise<PayoutClaim>
  getPayout(dareId: string): Promise<Payout | null>
  markPayoutTransferred(dareId: string, transferId: string): Promise<void>

  createProof(proof: Proof): Promise<Proof>
  updateProof(id: string, patch: Partial<Proof>): Promise<void>
  listProofs(dareId: string): Promise<Proof[]>
  getProof(id: string): Promise<Proof | null>
  findProofByHash(hash: string): Promise<Proof | null>
  listReviewQueue(): Promise<Proof[]>
  listExpiredProofs(now: Date): Promise<Proof[]>
  deleteProof(id: string): Promise<void>

  createDispute(dispute: Dispute): Promise<Dispute>
  listDisputes(dareId: string): Promise<Dispute[]>

  claimWebhook(id: string, type: string): Promise<'fresh' | 'done' | 'inflight'>
  completeWebhook(id: string): Promise<void>
  releaseWebhook(id: string): Promise<void>

  logEvent(dareId: string | null, type: string, payload: unknown): Promise<void>
  listEvents(dareId: string): Promise<DareEvent[]>

  joinWaitlist(email: string, createdAt?: string): Promise<'created' | 'exists'>
  addNotification(note: import('./types').AppNotification): Promise<void>
  listNotifications(userId: string): Promise<import('./types').AppNotification[]>
  createReport(report: import('./types').DareReport): Promise<void>

  listCharities(): Promise<Charity[]>
  getCharity(id: string): Promise<Charity | null>

  saveMedia(proofId: string, bytes: Uint8Array): Promise<void>
  readMedia(proofId: string): Promise<Uint8Array | null>
  signedMediaUrl(proofId: string): Promise<string | null>
}

export function newId(): string {
  return randomUUID()
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export const DEMO_DARE_ID = '33333333-3333-4333-8333-333333333333'

export function createMemoryRepo(options?: { seedDemo?: boolean }): DareRepo {
  const users = new Map<string, User>()
  const dares = new Map<string, Dare>()
  const fundings = new Map<string, Funding>()
  const proofs = new Map<string, Proof>()
  const payouts = new Map<string, Payout>()
  const disputes: Dispute[] = []
  const events: DareEvent[] = []
  const waitlist = new Map<string, string>()
  const notifications: import('./types').AppNotification[] = []
  const reports: import('./types').DareReport[] = []
  const webhooks = new Map<string, 'processing' | 'done'>()
  const media = new Map<string, Uint8Array>()
  let eventId = 1

  function log(dareId: string | null, type: string, payload: unknown) {
    events.push({ id: eventId++, dareId, type, payload, createdAt: new Date().toISOString() })
  }

  const api: DareRepo = {
    async getUser(id) {
      return users.get(id) ?? null
    },
    async getUserByStripeAccount(accountId) {
      return [...users.values()].find((user) => user.stripeAccountId === accountId) ?? null
    },
    async upsertUser(user) {
      users.set(user.id, user)
      return user
    },
    async setStripeAccount(userId, accountId) {
      const user = users.get(userId)
      if (!user) throw new Error('user not found')
      user.stripeAccountId = accountId
    },
    async setPayoutsEnabled(userId, enabled) {
      const user = users.get(userId)
      if (!user) throw new Error('user not found')
      user.payoutsEnabled = enabled
    },
    async setPayoutsEnabledByAccount(accountId, enabled) {
      const user = [...users.values()].find((row) => row.stripeAccountId === accountId)
      if (user) user.payoutsEnabled = enabled
    },

    async createDare(dare) {
      dares.set(dare.id, dare)
      log(dare.id, 'dare_created', { status: dare.status, mode: dare.mode })
      return dare
    },
    async getDare(id) {
      await Promise.resolve()
      return dares.get(id) ?? null
    },
    async listDaresForUser(userId) {
      const funded = new Set(
        [...fundings.values()].filter((row) => row.funderId === userId).map((row) => row.dareId),
      )
      return [...dares.values()].filter((dare) => dare.creatorId === userId || dare.doerId === userId || funded.has(dare.id))
    },
    async listExpirable(now) {
      return [...dares.values()].filter((dare) => {
        if (dare.status !== 'open' && dare.status !== 'accepted') return false
        return new Date(dare.deadlineAt).getTime() < now.getTime()
      })
    },
    async listSettleable(now) {
      return [...dares.values()].filter((dare) => {
        if (dare.status !== 'completed') return false
        if (!dare.disputeWindowEndsAt) return true
        return new Date(dare.disputeWindowEndsAt).getTime() <= now.getTime()
      })
    },
    async listPayoutRetries() {
      return [...dares.values()].filter((dare) => {
        const payout = payouts.get(dare.id)
        return dare.status === 'paid_out' && Boolean(payout && !payout.stripeTransferId)
      })
    },
    async listRefundRetries() {
      return [...dares.values()].filter((dare) => {
        if (dare.mode !== 'funded') return false
        if (dare.status !== 'refunded' && dare.status !== 'failed' && dare.status !== 'cancelled') return false
        return [...fundings.values()].some((row) => row.dareId === dare.id && (row.status === 'captured' || (row.status === 'pending' && row.captureMethod === 'manual' && row.stripePaymentIntentId)))
      })
    },
    async listStravaOpen() {
      return [...dares.values()].filter((dare) => dare.proofKind === 'strava' && dare.status === 'accepted' && Boolean(dare.doerId))
    },
    async setCodeWord(dareId, codeWord, gesture) {
      const dare = dares.get(dareId)
      if (!dare) return null
      if (!dare.codeWord) {
        dare.codeWord = codeWord
        dare.gesture = gesture
        dare.proofIssuedAt = new Date().toISOString()
      }
      return dare
    },
    async setDoer(dareId, doerId) {
      const dare = dares.get(dareId)
      if (!dare || dare.doerId || dare.status !== 'open') return false
      if ([...fundings.values()].some((row) => row.dareId === dareId && row.funderId === doerId && row.status !== 'refunded')) {
        return false
      }
      dare.doerId = doerId
      dare.status = 'accepted'
      dare.acceptedAt = new Date().toISOString()
      log(dareId, 'accepted', { doerId })
      return true
    },
    async setDisputeWindow(dareId, endsAt) {
      const dare = dares.get(dareId)
      if (dare) dare.disputeWindowEndsAt = endsAt
    },
    async transition(dareId, to, from) {
      const dare = dares.get(dareId)
      if (!dare) return false
      if (!from.includes(dare.status)) return false
      if (!canTransition(dare.status, to)) return false
      const previous = dare.status
      dare.status = to
      log(dareId, 'status', { from: previous, to })
      return true
    },

    async createFunding(funding) {
      if (funding.stripePaymentIntentId) {
        const clash = [...fundings.values()].some((row) => row.stripePaymentIntentId === funding.stripePaymentIntentId)
        if (clash) throw new Error('duplicate payment intent')
      }
      fundings.set(funding.id, funding)
      return funding
    },
    async getFunding(id) {
      return fundings.get(id) ?? null
    },
    async getFundingBySession(sessionId) {
      return [...fundings.values()].find((row) => row.stripeCheckoutSessionId === sessionId) ?? null
    },
    async getFundingByPaymentIntent(paymentIntentId) {
      return [...fundings.values()].find((row) => row.stripePaymentIntentId === paymentIntentId) ?? null
    },
    async listFundings(dareId) {
      return [...fundings.values()].filter((row) => row.dareId === dareId)
    },
    async attachCheckoutSession(fundingId, sessionId) {
      const funding = fundings.get(fundingId)
      if (funding) funding.stripeCheckoutSessionId = sessionId
    },
    async markFundingCaptured(fundingId, paymentIntentId, chargeId) {
      const funding = fundings.get(fundingId)
      if (!funding || funding.status === 'captured') return
      funding.status = 'captured'
      funding.stripePaymentIntentId = paymentIntentId
      funding.stripeChargeId = chargeId
      log(funding.dareId, 'funding_captured', { fundingId, amountCents: funding.amountCents })
    },
    async markFundingAuthorized(fundingId, paymentIntentId) {
      const funding = fundings.get(fundingId)
      if (!funding || funding.stripePaymentIntentId) return
      funding.stripePaymentIntentId = paymentIntentId
      funding.captureMethod = 'manual'
      log(funding.dareId, 'funding_authorized', { fundingId })
    },
    async sumCommitted(dareId) {
      return [...fundings.values()]
        .filter((row) => row.dareId === dareId && (row.status === 'captured' || row.status === 'pending' || row.status === 'transferred'))
        .reduce((sum, row) => sum + row.amountCents, 0)
    },
    async sumCaptured(dareId) {
      return [...fundings.values()]
        .filter((row) => row.dareId === dareId && row.status === 'captured')
        .reduce((sum, row) => sum + row.amountCents, 0)
    },
    async sumFunderMonth(funderId, now) {
      const key = monthKey(now.toISOString())
      return [...fundings.values()]
        .filter((row) => row.funderId === funderId && row.status !== 'refunded' && monthKey(row.createdAt) === key)
        .reduce((sum, row) => sum + row.amountCents, 0)
    },
    async userHasFunding(dareId, userId) {
      return [...fundings.values()].some((row) => row.dareId === dareId && row.funderId === userId && row.status !== 'refunded')
    },
    async claimFundingRefund(fundingId) {
      const funding = fundings.get(fundingId)
      if (!funding || funding.status !== 'captured' || funding.refundId) return false
      funding.refundId = 'pending'
      return true
    },
    async markFundingRefunded(fundingId, refundId) {
      const funding = fundings.get(fundingId)
      if (!funding) return
      funding.status = 'refunded'
      funding.refundId = refundId
      log(funding.dareId, 'funding_refunded', { fundingId, refundId, amountCents: funding.amountCents })
    },
    async markFundingDonated(fundingId) {
      const funding = fundings.get(fundingId)
      if (!funding || funding.status === 'donated') return funding?.status === 'donated'
      if (funding.status !== 'captured' && funding.status !== 'pending') return false
      funding.status = 'donated'
      log(funding.dareId, 'funding_donated', { fundingId, charityId: dares.get(funding.dareId)?.charityId ?? null })
      return true
    },

    async claimPayout(dareId, amounts, now) {
      const dare = dares.get(dareId)
      if (!dare) return { claimed: false, payout: null, reason: 'bad_status' }
      const existing = payouts.get(dareId) ?? null
      if (existing) return { claimed: false, payout: existing, reason: 'exists' }
      if (dare.status !== 'completed') return { claimed: false, payout: null, reason: 'bad_status' }
      if (dare.disputeWindowEndsAt && new Date(dare.disputeWindowEndsAt).getTime() > now.getTime()) {
        return { claimed: false, payout: null, reason: 'dispute_window' }
      }
      if (!canTransition(dare.status, 'paid_out')) return { claimed: false, payout: null, reason: 'bad_status' }
      dare.status = 'paid_out'
      const payout: Payout = {
        id: newId(),
        dareId,
        stripeTransferId: null,
        grossCents: amounts.grossCents,
        feeCents: amounts.feeCents,
        netCents: amounts.netCents,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      payouts.set(dareId, payout)
      log(dareId, 'payout_claimed', { netCents: amounts.netCents, feeCents: amounts.feeCents })
      return { claimed: true, payout }
    },
    async getPayout(dareId) {
      await Promise.resolve()
      return payouts.get(dareId) ?? null
    },
    async markPayoutTransferred(dareId, transferId) {
      const payout = payouts.get(dareId)
      if (!payout) throw new Error('payout missing')
      if (payout.stripeTransferId && payout.stripeTransferId !== transferId) {
        throw new Error('payout already has a different transfer')
      }
      payout.stripeTransferId = transferId
      payout.status = 'transferred'
      const dare = dares.get(dareId)
      for (const funding of fundings.values()) {
        if (funding.dareId === dareId && funding.status === 'captured') funding.status = 'transferred'
      }
      log(dareId, 'payout_transferred', { transferId, doerId: dare?.doerId ?? null })
    },

    async createProof(proof) {
      proofs.set(proof.id, proof)
      return proof
    },
    async updateProof(id, patch) {
      const proof = proofs.get(id)
      if (!proof) throw new Error('proof missing')
      Object.assign(proof, patch)
    },
    async listProofs(dareId) {
      return [...proofs.values()].filter((proof) => proof.dareId === dareId)
    },
    async getProof(id) {
      return proofs.get(id) ?? null
    },
    async findProofByHash(hash) {
      return [...proofs.values()].find((proof) => proof.sha256 === hash) ?? null
    },
    async listReviewQueue() {
      return [...proofs.values()].filter((proof) => proof.reviewStatus === 'pending')
    },
    async listExpiredProofs(now) {
      const cutoff = now.getTime() - PROOF_RETENTION_MS
      return [...proofs.values()].filter((proof) => new Date(proof.submittedAt).getTime() <= cutoff)
    },
    async deleteProof(id) {
      proofs.delete(id)
      media.delete(id)
    },

    async createDispute(dispute) {
      disputes.push(dispute)
      log(dispute.dareId, 'dispute_opened', { disputeId: dispute.id, openedBy: dispute.openedBy })
      return dispute
    },
    async listDisputes(dareId) {
      return disputes.filter((row) => row.dareId === dareId)
    },

    async claimWebhook(id, type) {
      const state = webhooks.get(id)
      if (state === 'done') return 'done'
      if (state === 'processing') return 'inflight'
      webhooks.set(id, 'processing')
      log(null, 'webhook', { id, type })
      return 'fresh'
    },
    async completeWebhook(id) {
      webhooks.set(id, 'done')
    },
    async releaseWebhook(id) {
      if (webhooks.get(id) === 'processing') webhooks.delete(id)
    },

    async logEvent(dareId, type, payload) {
      log(dareId, type, payload)
    },
    async listEvents(dareId) {
      return events.filter((event) => event.dareId === dareId)
    },
    async joinWaitlist(email, createdAt = new Date().toISOString()) {
      const key = email.trim().toLowerCase()
      if (waitlist.has(key)) return 'exists'
      waitlist.set(key, createdAt)
      return 'created'
    },
    async addNotification(note) {
      notifications.push(note)
    },
    async listNotifications(userId) {
      return notifications.filter((note) => note.userId === userId).slice().reverse()
    },
    async createReport(report) {
      reports.push(report)
    },

    async listCharities() {
      return CHARITIES.filter((charity) => charity.active)
    },
    async getCharity(id) {
      return CHARITIES.find((charity) => charity.id === id) ?? null
    },

    async saveMedia(proofId, bytes) {
      media.set(proofId, bytes)
    },
    async readMedia(proofId) {
      return media.get(proofId) ?? null
    },
    async signedMediaUrl() {
      return null
    },
  }

  if (options?.seedDemo) {
    const createdAt = new Date().toISOString()
    const deadlineAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    void api.upsertUser({
      id: '00000000-0000-4000-8000-000000000002',
      handle: 'funder',
      displayName: 'Funder',
      email: 'funder@dare.local',
      avatarUrl: null,
      country: 'CH',
      createdAt,
      stripeAccountId: null,
      payoutsEnabled: false,
      dob: '1990-01-01',
      ageConfirmed: true,
      isAdmin: false,
    })
    void api.upsertUser({
      id: '00000000-0000-4000-8000-000000000001',
      handle: 'doer',
      displayName: 'Doer',
      email: 'doer@dare.local',
      avatarUrl: null,
      country: 'CH',
      createdAt,
      stripeAccountId: null,
      payoutsEnabled: false,
      dob: '1990-01-01',
      ageConfirmed: true,
      isAdmin: false,
    })
    void api.createDare({
      id: DEMO_DARE_ID,
      creatorId: '00000000-0000-4000-8000-000000000002',
      doerId: '00000000-0000-4000-8000-000000000001',
      mode: 'funded',
      title: '100 push-ups',
      rules: '100 push-ups in one unbroken set, on camera.',
      category: 'fitness',
      proofRequirements: { continuous: true, spokenCodeWord: true, framing: 'Full body in frame' },
      deadlineAt,
      status: 'accepted',
      charityId: '11111111-1111-4111-8111-111111111111',
      failOutcome: 'refund',
      currency: 'CHF',
      createdAt,
      codeWord: null,
      gesture: null,
      disputeWindowEndsAt: null,
      proofKind: 'video',
      acceptedAt: createdAt,
      proofIssuedAt: null,
      strava: null,
    })
    void api.createFunding({
      id: '44444444-4444-4444-8444-444444444444',
      dareId: DEMO_DARE_ID,
      funderId: '00000000-0000-4000-8000-000000000002',
      amountCents: 2500,
      chargeCents: 2500,
      feeCents: 250,
      feeModel: 'percent',
      failOutcome: 'refund',
      charityId: null,
      stripeCheckoutSessionId: 'cs_test_demo',
      stripePaymentIntentId: 'pi_demo',
      stripeChargeId: null,
      captureMethod: 'automatic',
      status: 'captured',
      refundId: null,
      createdAt,
    })
  }
  return api
}
