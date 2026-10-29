import { DISPUTE_WINDOW_MS, doerReceivesCents, idempotencyCapture, idempotencyRefund, idempotencyTransfer, idempotencyTransferPart, idempotencyVoid, PAYOUT_HOLD_MS } from './money'
import { notify } from './notify'
import type { DareRepo } from './repo'
import type { StripePort } from './stripe-port'
import { fail, ok, type Funding, type Result } from './types'

export interface SettlementReceipt {
  dareId: string
  action: 'payout' | 'refund' | 'donate' | 'void' | 'noop'
  idempotent: boolean
  transferIds: string[]
  refundIds: string[]
  netCents: number
  feeCents: number
}

function receipt(partial: SettlementReceipt): Result<SettlementReceipt> {
  return ok(partial)
}

export async function releasePayout(dareId: string, repo: DareRepo, stripe: StripePort, now = new Date()): Promise<Result<SettlementReceipt>> {
  const dare = await repo.getDare(dareId)
  if (!dare) return fail(404, 'Dare not found')
  if (dare.mode !== 'funded') return fail(400, 'Solo pledges are not paid to the doer')

  const existing = await repo.getPayout(dareId)
  if (existing?.stripeTransferId) {
    return receipt({
      dareId,
      action: 'payout',
      idempotent: true,
      transferIds: [existing.stripeTransferId],
      refundIds: [],
      netCents: existing.netCents,
      feeCents: existing.feeCents,
    })
  }
  if (existing && !existing.stripeTransferId) {
    return finishTransfer(dareId, existing.netCents, existing.feeCents, repo, stripe)
  }

  if (dare.status !== 'completed') return fail(409, `Cannot pay out a dare in status ${dare.status}`)
  if (dare.disputeWindowEndsAt && new Date(dare.disputeWindowEndsAt).getTime() > now.getTime()) {
    return fail(409, 'The 24 hour dispute window is still open')
  }

  const doer = dare.doerId ? await repo.getUser(dare.doerId) : null
  if (!doer?.payoutsEnabled || !doer.stripeAccountId) {
    const holdEnds = new Date(dare.deadlineAt).getTime() + PAYOUT_HOLD_MS
    if (now.getTime() > holdEnds) {
      return refundDare(dareId, repo, stripe, { allowFrom: ['completed'], reason: 'payout hold expired' })
    }
    return fail(409, 'Doer has not finished payout setup')
  }

  const fundings = (await repo.listFundings(dareId)).filter((row) => row.status === 'captured')
  if (fundings.length === 0) return fail(409, 'No captured bounty to pay out')
  const totals = payoutTotals(fundings)
  const claim = await repo.claimPayout(dareId, {
    grossCents: totals.grossCents,
    feeCents: totals.feeCents,
    netCents: totals.netCents,
  }, now)
  if (!claim.claimed) {
    if (claim.reason === 'dispute_window') return fail(409, 'The 24 hour dispute window is still open')
    if (claim.payout?.stripeTransferId) {
      return receipt({
        dareId,
        action: 'payout',
        idempotent: true,
        transferIds: [claim.payout.stripeTransferId],
        refundIds: [],
        netCents: claim.payout.netCents,
        feeCents: claim.payout.feeCents,
      })
    }
    if (claim.payout) {
      return finishTransfer(dareId, claim.payout.netCents, claim.payout.feeCents, repo, stripe)
    }
    return fail(409, 'Payout was not claimed')
  }
  return finishTransfer(dareId, totals.netCents, totals.feeCents, repo, stripe)
}

async function finishTransfer(dareId: string, netCents: number, feeCents: number, repo: DareRepo, stripe: StripePort): Promise<Result<SettlementReceipt>> {
  const dare = await repo.getDare(dareId)
  if (!dare?.doerId) return fail(409, 'Dare has no doer')
  const doer = await repo.getUser(dare.doerId)
  if (!doer?.stripeAccountId) return fail(409, 'Doer has no connected account')
  const fundings = (await repo.listFundings(dareId)).filter((row) => row.status === 'captured' || row.status === 'transferred')
  const captured = fundings.filter((row) => row.status === 'captured')
  const source = captured.length > 0 ? captured : fundings
  const totals = payoutTotals(source)
  const transferIds: string[] = []
  if (source.length === 1) {
    const funding = source[0]
    const transfer = await stripe.createTransfer({
      amountCents: totals.netCents,
      destination: doer.stripeAccountId,
      dareId,
      idempotencyKey: idempotencyTransfer(dareId),
      paymentIntentId: funding.stripePaymentIntentId,
      sourceTransaction: funding.stripeChargeId,
    })
    transferIds.push(transfer.id)
  } else {
    for (const funding of source) {
      const transfer = await stripe.createTransfer({
        amountCents: doerReceivesCents(funding),
        destination: doer.stripeAccountId,
        dareId,
        idempotencyKey: idempotencyTransferPart(dareId, funding.id),
        paymentIntentId: funding.stripePaymentIntentId,
        sourceTransaction: funding.stripeChargeId,
      })
      transferIds.push(transfer.id)
    }
  }
  const primary = transferIds[0]
  if (!primary) return fail(500, 'Transfer did not return an id')
  await repo.markPayoutTransferred(dareId, primary)
  await tellParticipants(repo, dareId, 'payout', 'Payout sent', 'The bounty was paid to the doer, minus the configured fee.')
  return receipt({
    dareId,
    action: 'payout',
    idempotent: false,
    transferIds,
    refundIds: [],
    netCents,
    feeCents,
  })
}

export async function refundDare(
  dareId: string,
  repo: DareRepo,
  stripe: StripePort,
  opts: { allowFrom?: Array<'failed' | 'cancelled' | 'completed'>; reason?: string } = {},
): Promise<Result<SettlementReceipt>> {
  const allowFrom = opts.allowFrom ?? ['failed', 'cancelled']
  const dare = await repo.getDare(dareId)
  if (!dare) return fail(404, 'Dare not found')
  if (dare.mode !== 'funded') return fail(400, 'Solo pledges are returned or donated, not refunded as a bounty')

  const payout = await repo.getPayout(dareId)
  if (payout?.stripeTransferId) return fail(409, 'Already paid out')

  const openFundings = (await repo.listFundings(dareId)).filter((row) => row.status === 'captured' || row.status === 'pending')
  const charityOnly = openFundings.length > 0 && openFundings.every((row) => row.failOutcome === 'charity')
  if (charityOnly) {
    if (dare.status === 'open' || dare.status === 'accepted' || dare.status === 'completed') {
      await repo.transition(dareId, 'failed', [dare.status])
    }
    if (opts.reason) await repo.logEvent(dareId, 'charity_reason', { reason: opts.reason })
    const donated = await finishRefunds(dareId, repo, stripe)
    if (donated.ok) return receipt({ ...donated.data, action: 'donate' })
    return donated
  }

  if (dare.status !== 'refunded') {
    const flipped = await repo.transition(dareId, 'refunded', allowFrom)
    const current = await repo.getDare(dareId)
    if (!flipped && current?.status !== 'refunded') {
      return fail(409, `Cannot refund a dare in status ${dare.status}`)
    }
  }
  if (opts.reason) await repo.logEvent(dareId, 'refund_reason', { reason: opts.reason })
  return finishRefunds(dareId, repo, stripe)
}

async function finishRefunds(dareId: string, repo: DareRepo, stripe: StripePort): Promise<Result<SettlementReceipt>> {
  const fundings = await repo.listFundings(dareId)
  const refundIds: string[] = []
  let idempotent = true
  for (const funding of fundings) {
    if (funding.status === 'refunded') {
      if (funding.refundId && funding.refundId !== 'pending') refundIds.push(funding.refundId)
      continue
    }
    if (funding.failOutcome === 'charity') {
      if (funding.status === 'donated') continue
      if (funding.captureMethod === 'manual' && funding.status === 'pending' && funding.stripePaymentIntentId) {
        await stripe.capturePaymentIntent({
          paymentIntentId: funding.stripePaymentIntentId,
          idempotencyKey: idempotencyCapture(dareId, funding.id),
        })
        await repo.markFundingCaptured(funding.id, funding.stripePaymentIntentId, funding.stripeChargeId)
      }
      const donated = await repo.markFundingDonated(funding.id)
      if (donated) idempotent = false
      continue
    }
    if (funding.status === 'pending' && funding.captureMethod === 'manual' && funding.stripePaymentIntentId) {
      const result = await stripe.cancelPaymentIntent({
        paymentIntentId: funding.stripePaymentIntentId,
        idempotencyKey: idempotencyVoid(dareId, funding.id),
      })
      await repo.markFundingRefunded(funding.id, result.id)
      refundIds.push(result.id)
      idempotent = false
      continue
    }
    if (funding.status !== 'captured' && funding.refundId !== 'pending') continue
    if (!funding.stripePaymentIntentId) continue
    if (funding.status === 'captured') {
      const claimed = await repo.claimFundingRefund(funding.id)
      if (!claimed && funding.refundId && funding.refundId !== 'pending') continue
      if (!claimed) {
        const fresh = await repo.getFunding(funding.id)
        if (!fresh || fresh.status === 'refunded') {
          if (fresh?.refundId) refundIds.push(fresh.refundId)
          continue
        }
        if (fresh.refundId !== 'pending') continue
      }
    }
    const refund = await stripe.createRefund({
      paymentIntentId: funding.stripePaymentIntentId,
      amountCents: funding.feeModel === 'surcharge' ? funding.amountCents : (funding.chargeCents || funding.amountCents),
      idempotencyKey: idempotencyRefund(dareId, funding.id),
    })
    await repo.markFundingRefunded(funding.id, refund.id)
    refundIds.push(refund.id)
    idempotent = false
  }
  if (!idempotent) {
    await tellParticipants(repo, dareId, 'refund', 'Dare settled', 'A miss was refunded or marked for charity.')
  }
  return receipt({
    dareId,
    action: 'refund',
    idempotent,
    transferIds: [],
    refundIds,
    netCents: 0,
    feeCents: 0,
  })
}

async function tellParticipants(repo: DareRepo, dareId: string, type: string, title: string, body: string) {
  const dare = await repo.getDare(dareId)
  if (!dare) return
  const people = [await repo.getUser(dare.creatorId)]
  if (dare.doerId) people.push(await repo.getUser(dare.doerId))
  for (const funding of await repo.listFundings(dareId)) people.push(await repo.getUser(funding.funderId))
  await notify(repo, people, { dareId, type, title, body })
}

export async function settleSoloSuccess(dareId: string, repo: DareRepo, stripe: StripePort): Promise<Result<SettlementReceipt>> {
  const dare = await repo.getDare(dareId)
  if (!dare) return fail(404, 'Dare not found')
  if (dare.mode !== 'solo') return fail(400, 'Not a solo dare')
  if (dare.status !== 'refunded') {
    const flipped = await repo.transition(dareId, 'refunded', ['completed'])
    const current = await repo.getDare(dareId)
    if (!flipped && current?.status !== 'refunded') return fail(409, `Cannot return a pledge from ${dare.status}`)
  }
  const refundIds: string[] = []
  for (const funding of await repo.listFundings(dareId)) {
    if (funding.status === 'refunded') continue
    if (funding.captureMethod === 'manual' && funding.status === 'pending' && funding.stripePaymentIntentId) {
      const result = await stripe.cancelPaymentIntent({
        paymentIntentId: funding.stripePaymentIntentId,
        idempotencyKey: idempotencyVoid(dareId, funding.id),
      })
      await repo.markFundingRefunded(funding.id, result.id)
      refundIds.push(result.id)
      continue
    }
    if (funding.status === 'captured' && funding.stripePaymentIntentId) {
      const claimed = await repo.claimFundingRefund(funding.id)
      if (!claimed) continue
      const refund = await stripe.createRefund({
        paymentIntentId: funding.stripePaymentIntentId,
        amountCents: funding.amountCents,
        idempotencyKey: idempotencyRefund(dareId, funding.id),
      })
      await repo.markFundingRefunded(funding.id, refund.id)
      refundIds.push(refund.id)
    }
  }
  if ((await repo.getPayout(dareId))?.stripeTransferId) {
    return fail(500, 'Solo mode must not create a payout')
  }
  return receipt({ dareId, action: refundIds.length ? 'void' : 'noop', idempotent: refundIds.length === 0, transferIds: [], refundIds, netCents: 0, feeCents: 0 })
}

export async function settleSoloMiss(dareId: string, repo: DareRepo, stripe: StripePort): Promise<Result<SettlementReceipt>> {
  const dare = await repo.getDare(dareId)
  if (!dare) return fail(404, 'Dare not found')
  if (dare.mode !== 'solo') return fail(400, 'Not a solo dare')
  if (!dare.charityId) return fail(409, 'Solo miss needs a charity')
  if (dare.status === 'open' || dare.status === 'accepted') {
    await repo.transition(dareId, 'failed', [dare.status])
  }
  for (const funding of await repo.listFundings(dareId)) {
    if (funding.status === 'donated' || funding.status === 'refunded') continue
    if (funding.captureMethod === 'manual' && funding.status === 'pending' && funding.stripePaymentIntentId) {
      await stripe.capturePaymentIntent({
        paymentIntentId: funding.stripePaymentIntentId,
        idempotencyKey: idempotencyCapture(dareId, funding.id),
      })
      await repo.markFundingCaptured(funding.id, funding.stripePaymentIntentId, null)
    }
    await repo.markFundingDonated(funding.id)
  }
  return receipt({
    dareId,
    action: 'donate',
    idempotent: false,
    transferIds: [],
    refundIds: [],
    netCents: 0,
    feeCents: 0,
  })
}

export async function settleDare(dareId: string, repo: DareRepo, stripe: StripePort, now = new Date()): Promise<Result<SettlementReceipt>> {
  const dare = await repo.getDare(dareId)
  if (!dare) return fail(404, 'Dare not found')
  if (dare.mode === 'solo' && dare.status === 'completed') return settleSoloSuccess(dareId, repo, stripe)
  if (dare.mode === 'solo' && (dare.status === 'failed' || dare.status === 'accepted' || dare.status === 'open')) {
    return settleSoloMiss(dareId, repo, stripe)
  }
  if (dare.mode === 'funded' && (dare.status === 'failed' || dare.status === 'cancelled')) {
    return refundDare(dareId, repo, stripe)
  }
  if (dare.mode === 'funded' && dare.status === 'completed') return releasePayout(dareId, repo, stripe, now)
  if (dare.status === 'paid_out' || dare.status === 'refunded') {
    if (dare.mode === 'funded' && dare.status === 'paid_out') return releasePayout(dareId, repo, stripe, now)
    if (dare.status === 'refunded' && dare.mode === 'funded') return refundDare(dareId, repo, stripe)
    return receipt({ dareId, action: 'noop', idempotent: true, transferIds: [], refundIds: [], netCents: 0, feeCents: 0 })
  }
  return fail(409, `Nothing to settle for status ${dare.status}`)
}

export function disputeWindowEnd(from: Date): string {
  return new Date(from.getTime() + DISPUTE_WINDOW_MS).toISOString()
}

export function capturedAmounts(fundings: Funding[]): number[] {
  return fundings.filter((row) => row.status === 'captured').map((row) => row.amountCents)
}

export function payoutTotals(fundings: Funding[]): { grossCents: number; feeCents: number; netCents: number } {
  const grossCents = fundings.reduce((sum, row) => sum + row.amountCents, 0)
  const netCents = fundings.reduce((sum, row) => sum + doerReceivesCents(row), 0)
  return { grossCents, feeCents: grossCents - netCents, netCents }
}
