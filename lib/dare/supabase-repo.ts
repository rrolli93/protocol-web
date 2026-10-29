import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SIGNED_URL_TTL_SECONDS } from './money'
import type { DareRepo, PayoutClaim } from './repo'
import type {
  Dare,
  DareStatus,
  Dispute,
  Funding,
  Payout,
  Proof,
  User,
} from './types'

type Row = Record<string, unknown>

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export function adminClient(): SupabaseClient {
  return createClient(requiredEnv('NEXT_PUBLIC_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

function text(row: Row, key: string): string | null {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

function num(row: Row, key: string): number {
  return Number(row[key] ?? 0)
}

function bool(row: Row, key: string): boolean {
  return row[key] === true
}

function userFrom(row: Row): User {
  return {
    id: String(row.id),
    handle: text(row, 'handle') ?? text(row, 'username') ?? 'friend',
    displayName: text(row, 'display_name') ?? text(row, 'handle') ?? 'Friend',
    email: text(row, 'email') ?? '',
    avatarUrl: text(row, 'avatar_url'),
    country: text(row, 'country'),
    createdAt: text(row, 'created_at') ?? new Date().toISOString(),
    stripeAccountId: text(row, 'stripe_account_id'),
    payoutsEnabled: bool(row, 'payouts_enabled'),
    dob: text(row, 'dob'),
    ageConfirmed: bool(row, 'age_confirmed'),
    isAdmin: bool(row, 'is_admin'),
  }
}

function dareFrom(row: Row): Dare {
  const requirements = (row.proof_requirements ?? {}) as Dare['proofRequirements']
  return {
    id: String(row.id),
    creatorId: String(row.creator_id),
    doerId: text(row, 'doer_id'),
    mode: row.mode === 'solo' ? 'solo' : 'funded',
    title: String(row.title),
    rules: String(row.rules ?? ''),
    category: (text(row, 'category') ?? 'fitness') as Dare['category'],
    proofRequirements: {
      continuous: requirements.continuous !== false,
      spokenCodeWord: requirements.spokenCodeWord !== false,
      framing: requirements.framing ?? '',
    },
    deadlineAt: String(row.deadline_at),
    status: String(row.status) as DareStatus,
    charityId: text(row, 'charity_id'),
    currency: 'CHF',
    createdAt: String(row.created_at),
    codeWord: text(row, 'code_word'),
    gesture: text(row, 'gesture'),
    disputeWindowEndsAt: text(row, 'dispute_window_ends_at'),
  }
}

function fundingFrom(row: Row): Funding {
  return {
    id: String(row.id),
    dareId: String(row.dare_id),
    funderId: String(row.funder_id),
    amountCents: num(row, 'amount_cents'),
    stripeCheckoutSessionId: text(row, 'stripe_checkout_session_id'),
    stripePaymentIntentId: text(row, 'stripe_payment_intent_id'),
    stripeChargeId: text(row, 'stripe_charge_id'),
    captureMethod: row.capture_method === 'manual' ? 'manual' : 'automatic',
    status: String(row.status) as Funding['status'],
    refundId: text(row, 'refund_id'),
    createdAt: String(row.created_at),
  }
}

function proofFrom(row: Row): Proof {
  return {
    id: String(row.id),
    dareId: String(row.dare_id),
    doerId: String(row.doer_id),
    storagePath: String(row.storage_path),
    durationS: num(row, 'duration_s'),
    sha256: String(row.sha256),
    codeWord: String(row.code_word),
    submittedAt: String(row.submitted_at),
    aiVerdict: text(row, 'ai_verdict') as Proof['aiVerdict'],
    aiConfidence: row.ai_confidence == null ? null : Number(row.ai_confidence),
    aiRationale: text(row, 'ai_rationale'),
    aiModel: text(row, 'ai_model'),
    reviewStatus: (text(row, 'review_status') ?? 'none') as Proof['reviewStatus'],
    reviewerId: text(row, 'reviewer_id'),
    reviewedAt: text(row, 'reviewed_at'),
    repCount: row.rep_count == null ? null : Number(row.rep_count),
    cutDetected: row.cut_detected == null ? null : row.cut_detected === true,
  }
}

function payoutFrom(row: Row): Payout {
  return {
    id: String(row.id),
    dareId: String(row.dare_id),
    stripeTransferId: text(row, 'stripe_transfer_id'),
    grossCents: num(row, 'gross_cents'),
    feeCents: num(row, 'fee_cents'),
    netCents: num(row, 'net_cents'),
    status: String(row.status) as Payout['status'],
    createdAt: String(row.created_at),
  }
}

export function createSupabaseDareRepo(client: SupabaseClient = adminClient()): DareRepo {
  const db = client

  return {
    async getUser(id) {
      const { data, error } = await db.from('users').select('*').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? userFrom(data as Row) : null
    },
    async getUserByStripeAccount(accountId) {
      const { data, error } = await db.from('users').select('*').eq('stripe_account_id', accountId).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? userFrom(data as Row) : null
    },
    async upsertUser(user) {
      const { error } = await db.from('users').upsert({
        id: user.id,
        username: user.handle,
        handle: user.handle,
        display_name: user.displayName,
        email: user.email,
        avatar_url: user.avatarUrl,
        country: user.country,
        stripe_account_id: user.stripeAccountId,
        payouts_enabled: user.payoutsEnabled,
        dob: user.dob,
        age_confirmed: user.ageConfirmed,
        is_admin: user.isAdmin,
      })
      if (error) throw new Error(error.message)
      return user
    },
    async setStripeAccount(userId, accountId) {
      const { error } = await db.from('users').update({ stripe_account_id: accountId }).eq('id', userId)
      if (error) throw new Error(error.message)
    },
    async setPayoutsEnabled(userId, enabled) {
      const { error } = await db.from('users').update({ payouts_enabled: enabled }).eq('id', userId)
      if (error) throw new Error(error.message)
    },
    async setPayoutsEnabledByAccount(accountId, enabled) {
      const { error } = await db.from('users').update({ payouts_enabled: enabled }).eq('stripe_account_id', accountId)
      if (error) throw new Error(error.message)
    },
    async createDare(dare) {
      const { error } = await db.from('dares').insert({
        id: dare.id,
        creator_id: dare.creatorId,
        doer_id: dare.doerId,
        mode: dare.mode,
        title: dare.title,
        rules: dare.rules,
        category: dare.category,
        proof_requirements: dare.proofRequirements,
        deadline_at: dare.deadlineAt,
        status: dare.status,
        charity_id: dare.charityId,
        currency: dare.currency,
        code_word: dare.codeWord,
        gesture: dare.gesture,
        dispute_window_ends_at: dare.disputeWindowEndsAt,
      })
      if (error) throw new Error(error.message)
      await db.from('events').insert({ dare_id: dare.id, type: 'dare_created', payload: { mode: dare.mode } })
      return dare
    },
    async getDare(id) {
      const { data, error } = await db.from('dares').select('*').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? dareFrom(data as Row) : null
    },
    async listDaresForUser(userId) {
      const { data, error } = await db.from('dares').select('*').or(`creator_id.eq.${userId},doer_id.eq.${userId}`)
      if (error) throw new Error(error.message)
      const mine = ((data ?? []) as Row[]).map(dareFrom)
      const { data: funded } = await db.from('fundings').select('dare_id').eq('funder_id', userId)
      const extraIds = [...new Set((funded ?? []).map((row) => String((row as Row).dare_id)))].filter((id) => !mine.some((dare) => dare.id === id))
      if (extraIds.length === 0) return mine
      const { data: more, error: moreError } = await db.from('dares').select('*').in('id', extraIds)
      if (moreError) throw new Error(moreError.message)
      return mine.concat(((more ?? []) as Row[]).map(dareFrom))
    },
    async listExpirable(now) {
      const { data, error } = await db.from('dares').select('*').lt('deadline_at', now.toISOString()).in('status', ['open', 'accepted'])
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).map(dareFrom)
    },
    async listSettleable(now) {
      const { data, error } = await db.from('dares').select('*').eq('status', 'completed').or(`dispute_window_ends_at.is.null,dispute_window_ends_at.lte.${now.toISOString()}`)
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).map(dareFrom)
    },
    async listPayoutRetries() {
      const { data, error } = await db.from('payouts').select('dare_id').is('stripe_transfer_id', null).eq('status', 'pending')
      if (error) throw new Error(error.message)
      const ids = [...new Set((data ?? []).map((row) => String((row as Row).dare_id)))]
      if (ids.length === 0) return []
      const { data: rows, error: dareError } = await db.from('dares').select('*').in('id', ids).eq('status', 'paid_out')
      if (dareError) throw new Error(dareError.message)
      return ((rows ?? []) as Row[]).map(dareFrom)
    },
    async listRefundRetries() {
      const { data, error } = await db.from('fundings').select('dare_id, status, capture_method, stripe_payment_intent_id').in('status', ['captured', 'pending'])
      if (error) throw new Error(error.message)
      const ids = [...new Set((data ?? []).filter((row) => {
        const record = row as Row
        return record.status === 'captured' || (record.capture_method === 'manual' && record.stripe_payment_intent_id)
      }).map((row) => String((row as Row).dare_id)))]
      if (ids.length === 0) return []
      const { data: rows, error: dareError } = await db.from('dares').select('*').in('id', ids).eq('mode', 'funded').in('status', ['refunded', 'failed', 'cancelled'])
      if (dareError) throw new Error(dareError.message)
      return ((rows ?? []) as Row[]).map(dareFrom)
    },
    async setCodeWord(dareId, codeWord, gesture) {
      const current = await this.getDare(dareId)
      if (!current) return null
      if (current.codeWord) return current
      const { error } = await db.from('dares').update({ code_word: codeWord, gesture }).eq('id', dareId).is('code_word', null)
      if (error) throw new Error(error.message)
      return this.getDare(dareId)
    },
    async setDoer(dareId, doerId) {
      const { data, error } = await db.from('dares').update({ doer_id: doerId, status: 'accepted' }).eq('id', dareId).eq('status', 'open').is('doer_id', null).select('id')
      if (error) throw new Error(error.message)
      return Array.isArray(data) && data.length > 0
    },
    async setDisputeWindow(dareId, endsAt) {
      const { error } = await db.from('dares').update({ dispute_window_ends_at: endsAt }).eq('id', dareId)
      if (error) throw new Error(error.message)
    },
    async transition(dareId, to, from) {
      const current = await this.getDare(dareId)
      if (!current || !from.includes(current.status)) return false
      const { error } = await db.rpc('transition_dare', { p_id: dareId, p_to: to })
      if (error) {
        if (error.message.includes('illegal') || error.message.includes('not found')) return false
        throw new Error(error.message)
      }
      return true
    },
    async createFunding(funding) {
      const { error } = await db.from('fundings').insert({
        id: funding.id,
        dare_id: funding.dareId,
        funder_id: funding.funderId,
        amount_cents: funding.amountCents,
        stripe_checkout_session_id: funding.stripeCheckoutSessionId,
        stripe_payment_intent_id: funding.stripePaymentIntentId,
        stripe_charge_id: funding.stripeChargeId,
        capture_method: funding.captureMethod,
        status: funding.status,
        refund_id: funding.refundId,
        created_at: funding.createdAt,
      })
      if (error) throw new Error(error.message)
      return funding
    },
    async getFunding(id) {
      const { data, error } = await db.from('fundings').select('*').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? fundingFrom(data as Row) : null
    },
    async getFundingBySession(sessionId) {
      const { data, error } = await db.from('fundings').select('*').eq('stripe_checkout_session_id', sessionId).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? fundingFrom(data as Row) : null
    },
    async getFundingByPaymentIntent(paymentIntentId) {
      const { data, error } = await db.from('fundings').select('*').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? fundingFrom(data as Row) : null
    },
    async listFundings(dareId) {
      const { data, error } = await db.from('fundings').select('*').eq('dare_id', dareId)
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).map(fundingFrom)
    },
    async attachCheckoutSession(fundingId, sessionId) {
      const { error } = await db.from('fundings').update({ stripe_checkout_session_id: sessionId }).eq('id', fundingId)
      if (error) throw new Error(error.message)
    },
    async markFundingCaptured(fundingId, paymentIntentId, chargeId) {
      const current = await this.getFunding(fundingId)
      if (!current || current.status === 'captured') return
      const { error } = await db.from('fundings').update({
        status: 'captured',
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId,
      }).eq('id', fundingId)
      if (error) throw new Error(error.message)
      await db.from('events').insert({ dare_id: current.dareId, type: 'funding_captured', payload: { fundingId, amountCents: current.amountCents } })
    },
    async markFundingAuthorized(fundingId, paymentIntentId) {
      const current = await this.getFunding(fundingId)
      if (!current || current.stripePaymentIntentId) return
      const { error } = await db.from('fundings').update({
        stripe_payment_intent_id: paymentIntentId,
        capture_method: 'manual',
      }).eq('id', fundingId)
      if (error) throw new Error(error.message)
    },
    async sumCommitted(dareId) {
      const rows = await this.listFundings(dareId)
      return rows.filter((row) => row.status === 'captured' || row.status === 'pending' || row.status === 'transferred').reduce((sum, row) => sum + row.amountCents, 0)
    },
    async sumCaptured(dareId) {
      const rows = await this.listFundings(dareId)
      return rows.filter((row) => row.status === 'captured').reduce((sum, row) => sum + row.amountCents, 0)
    },
    async sumFunderMonth(funderId, now) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
      const { data, error } = await db.from('fundings').select('amount_cents, status').eq('funder_id', funderId).gte('created_at', start)
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).filter((row) => row.status !== 'refunded').reduce((sum, row) => sum + num(row, 'amount_cents'), 0)
    },
    async userHasFunding(dareId, userId) {
      const rows = await this.listFundings(dareId)
      return rows.some((row) => row.funderId === userId && row.status !== 'refunded')
    },
    async claimFundingRefund(fundingId) {
      const { data, error } = await db.from('fundings').update({ refund_id: 'pending' }).eq('id', fundingId).eq('status', 'captured').is('refund_id', null).select('id')
      if (error) throw new Error(error.message)
      return Array.isArray(data) && data.length > 0
    },
    async markFundingRefunded(fundingId, refundId) {
      const current = await this.getFunding(fundingId)
      const { error } = await db.from('fundings').update({ status: 'refunded', refund_id: refundId }).eq('id', fundingId)
      if (error) throw new Error(error.message)
      if (current) await db.from('events').insert({ dare_id: current.dareId, type: 'funding_refunded', payload: { fundingId, refundId } })
    },
    async markFundingDonated(fundingId) {
      const { data, error } = await db.from('fundings').update({ status: 'donated' }).eq('id', fundingId).in('status', ['captured', 'pending']).select('id, dare_id')
      if (error) throw new Error(error.message)
      const row = Array.isArray(data) ? data[0] as Row | undefined : undefined
      if (!row) return false
      await db.from('events').insert({ dare_id: row.dare_id, type: 'funding_donated', payload: { fundingId } })
      return true
    },
    async claimPayout(dareId, amounts, _now): Promise<PayoutClaim> {
      const { data, error } = await db.rpc('claim_dare_payout', {
        p_id: dareId,
        p_gross: amounts.grossCents,
        p_fee: amounts.feeCents,
        p_net: amounts.netCents,
      })
      if (error) {
        if (error.message.includes('dispute window')) return { claimed: false, payout: null, reason: 'dispute_window' }
        if (error.message.includes('cannot claim')) return { claimed: false, payout: null, reason: 'bad_status' }
        throw new Error(error.message)
      }
      const row = (Array.isArray(data) ? data[0] : data) as Row | null
      if (!row) return { claimed: false, payout: null, reason: 'bad_status' }
      const payout: Payout = {
        id: String(row.payout_id),
        dareId,
        stripeTransferId: text(row, 'stripe_transfer_id'),
        grossCents: amounts.grossCents,
        feeCents: amounts.feeCents,
        netCents: num(row, 'net_cents') || amounts.netCents,
        status: (text(row, 'status') ?? 'pending') as Payout['status'],
        createdAt: new Date().toISOString(),
      }
      return { claimed: row.claimed === true, payout, reason: row.claimed === true ? undefined : 'exists' }
    },
    async getPayout(dareId) {
      const { data, error } = await db.from('payouts').select('*').eq('dare_id', dareId).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? payoutFrom(data as Row) : null
    },
    async markPayoutTransferred(dareId, transferId) {
      const { error } = await db.from('payouts').update({ stripe_transfer_id: transferId, status: 'transferred' }).eq('dare_id', dareId)
      if (error) throw new Error(error.message)
      await db.from('fundings').update({ status: 'transferred' }).eq('dare_id', dareId).eq('status', 'captured')
      await db.from('events').insert({ dare_id: dareId, type: 'payout_transferred', payload: { transferId } })
    },
    async createProof(proof) {
      const { error } = await db.from('proofs').insert({
        id: proof.id,
        dare_id: proof.dareId,
        doer_id: proof.doerId,
        storage_path: proof.storagePath,
        duration_s: proof.durationS,
        sha256: proof.sha256,
        code_word: proof.codeWord,
        submitted_at: proof.submittedAt,
        review_status: proof.reviewStatus,
      })
      if (error) throw new Error(error.message)
      return proof
    },
    async updateProof(id, patch) {
      const row: Record<string, unknown> = {}
      if (patch.aiVerdict !== undefined) row.ai_verdict = patch.aiVerdict
      if (patch.aiConfidence !== undefined) row.ai_confidence = patch.aiConfidence
      if (patch.aiRationale !== undefined) row.ai_rationale = patch.aiRationale
      if (patch.aiModel !== undefined) row.ai_model = patch.aiModel
      if (patch.reviewStatus !== undefined) row.review_status = patch.reviewStatus
      if (patch.reviewerId !== undefined) row.reviewer_id = patch.reviewerId
      if (patch.reviewedAt !== undefined) row.reviewed_at = patch.reviewedAt
      if (patch.repCount !== undefined) row.rep_count = patch.repCount
      if (patch.cutDetected !== undefined) row.cut_detected = patch.cutDetected
      const { error } = await db.from('proofs').update(row).eq('id', id)
      if (error) throw new Error(error.message)
    },
    async listProofs(dareId) {
      const { data, error } = await db.from('proofs').select('*').eq('dare_id', dareId)
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).map(proofFrom)
    },
    async getProof(id) {
      const { data, error } = await db.from('proofs').select('*').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? proofFrom(data as Row) : null
    },
    async findProofByHash(hash) {
      const { data, error } = await db.from('proofs').select('*').eq('sha256', hash).limit(1).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? proofFrom(data as Row) : null
    },
    async listReviewQueue() {
      const { data, error } = await db.from('proofs').select('*').eq('review_status', 'pending').order('submitted_at')
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).map(proofFrom)
    },
    async listExpiredProofs(now) {
      const retention = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await db.from('proofs').select('*').lte('submitted_at', retention)
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).map(proofFrom)
    },
    async deleteProof(id) {
      const proof = await this.getProof(id)
      if (proof) await db.storage.from('proofs').remove([proof.storagePath])
      const { error } = await db.from('proofs').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    async createDispute(dispute) {
      const { error } = await db.from('disputes').insert({
        id: dispute.id,
        dare_id: dispute.dareId,
        opened_by: dispute.openedBy,
        reason: dispute.reason,
        status: dispute.status,
        created_at: dispute.createdAt,
      })
      if (error) throw new Error(error.message)
      await db.from('events').insert({ dare_id: dispute.dareId, type: 'dispute_opened', payload: { disputeId: dispute.id } })
      return dispute
    },
    async listDisputes(dareId) {
      const { data, error } = await db.from('disputes').select('*').eq('dare_id', dareId)
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).map((row) => ({
        id: String(row.id),
        dareId: String(row.dare_id),
        openedBy: String(row.opened_by),
        reason: String(row.reason),
        status: String(row.status) as Dispute['status'],
        createdAt: String(row.created_at),
      }))
    },
    async claimWebhook(id, type) {
      const { data: existing } = await db.from('stripe_webhook_events').select('id, processed').eq('id', id).maybeSingle()
      if (existing && (existing as Row).processed === true) return 'done'
      if (existing) return 'inflight'
      const { error } = await db.from('stripe_webhook_events').insert({ id, type, processed: false })
      if (error) {
        const again = await db.from('stripe_webhook_events').select('processed').eq('id', id).maybeSingle()
        if (again.data && (again.data as Row).processed === true) return 'done'
        return 'inflight'
      }
      return 'fresh'
    },
    async completeWebhook(id) {
      await db.from('stripe_webhook_events').update({ processed: true }).eq('id', id)
    },
    async releaseWebhook(id) {
      await db.from('stripe_webhook_events').delete().eq('id', id).eq('processed', false)
    },
    async logEvent(dareId, type, payload) {
      await db.from('events').insert({ dare_id: dareId, type, payload })
    },
    async listEvents(dareId) {
      const { data, error } = await db.from('events').select('*').eq('dare_id', dareId).order('id')
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).map((row) => ({
        id: Number(row.id),
        dareId: text(row, 'dare_id'),
        type: String(row.type),
        payload: row.payload,
        createdAt: String(row.created_at),
      }))
    },
    async listCharities() {
      const { data, error } = await db.from('charities').select('*').eq('active', true)
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).map((row) => ({
        id: String(row.id),
        name: String(row.name),
        url: String(row.url),
        active: true,
      }))
    },
    async getCharity(id) {
      const { data, error } = await db.from('charities').select('*').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return null
      const row = data as Row
      return { id: String(row.id), name: String(row.name), url: String(row.url), active: row.active === true }
    },
    async saveMedia(proofId, bytes) {
      const proof = await this.getProof(proofId)
      const path = proof?.storagePath ?? `${proofId}.webm`
      const { error } = await db.storage.from('proofs').upload(path, bytes, { contentType: 'video/webm', upsert: true })
      if (error) throw new Error(error.message)
    },
    async readMedia(proofId) {
      const proof = await this.getProof(proofId)
      if (!proof) return null
      const { data, error } = await db.storage.from('proofs').download(proof.storagePath)
      if (error || !data) return null
      return new Uint8Array(await data.arrayBuffer())
    },
    async signedMediaUrl(proofId) {
      const proof = await this.getProof(proofId)
      if (!proof) return null
      const { data, error } = await db.storage.from('proofs').createSignedUrl(proof.storagePath, SIGNED_URL_TTL_SECONDS)
      if (error || !data?.signedUrl) return null
      return data.signedUrl
    },
  }
}
