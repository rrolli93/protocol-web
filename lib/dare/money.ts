import type { FailOutcome, FeeModel } from './types'

/** Friend-funded bounty bounds. The doer never pays these. */
export const DEFAULT_MIN_BOUNTY_CENTS = 2_000
export const MIN_BOUNTY_CENTS = DEFAULT_MIN_BOUNTY_CENTS
export const MAX_BOUNTY_CENTS = 10_000
/** Total captured bounty on one dare, across every funder. */
export const DARE_CAP_CENTS = 10_000
/** Per-account funding cap inside a calendar month. */
export const MONTHLY_CAP_CENTS = 50_000
/** Platform fee charged only when a funded dare is paid out. */
export const FEE_BPS = 1_000
export const CURRENCY = 'CHF' as const
export const DISPUTE_WINDOW_MS = 24 * 60 * 60 * 1000
export const PAYOUT_HOLD_MS = 30 * 24 * 60 * 60 * 1000
export const SIGNED_URL_TTL_SECONDS = 10 * 60
export const PROOF_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
export const MAX_PROOF_BYTES = 80 * 1024 * 1024
export const MAX_PROOF_SECONDS = 90

export function assertIntegerCents(cents: number, label = 'amount'): void {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`${label} must be a non-negative integer number of cents`)
  }
}

/** 10% of the gross, rounded to the nearest cent. Charged on success only. */
export function platformFeeCents(grossCents: number): number {
  assertIntegerCents(grossCents, 'gross')
  return Math.round((grossCents * FEE_BPS) / 10_000)
}

export function netPayoutCents(grossCents: number): number {
  return grossCents - platformFeeCents(grossCents)
}

export interface FeeConfig {
  model: FeeModel
  /** Used when model is `percent`. 1000 = 10% taken from the bounty. */
  percentBps: number
  /** Used when model is `surcharge`. Fixed cents added on top of the bounty. */
  surchargeFixedCents: number
  /** Used when model is `surcharge`. 500 = 5% of the bounty, added on top. */
  surchargeBps: number
  minBountyCents: number
  maxBountyCents: number
}

export interface PriceQuote {
  model: FeeModel
  bountyCents: number
  feeCents: number
  chargeCents: number
  doerReceivesCents: number
  failOutcome: FailOutcome
  lines: string[]
}

function readInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return fallback
  return parsed
}

/** Defaults: 10% taken from the bounty, minimum CHF 20. Override with env. */
export function feeConfig(env: { [key: string]: string | undefined } = process.env): FeeConfig {
  const model: FeeModel = env.DARE_FEE_MODEL === 'surcharge' ? 'surcharge' : 'percent'
  return {
    model,
    percentBps: readInt(env.DARE_FEE_PERCENT_BPS, 1_000),
    surchargeFixedCents: readInt(env.DARE_SURCHARGE_FIXED_CENTS, 200),
    surchargeBps: readInt(env.DARE_SURCHARGE_BPS, 500),
    minBountyCents: readInt(env.DARE_MIN_BOUNTY_CENTS, DEFAULT_MIN_BOUNTY_CENTS),
    maxBountyCents: readInt(env.DARE_MAX_BOUNTY_CENTS, MAX_BOUNTY_CENTS),
  }
}

export function priceBounty(bountyCents: number, config: FeeConfig = feeConfig(), failOutcome: FailOutcome = 'refund'): PriceQuote {
  assertIntegerCents(bountyCents, 'bounty')
  const feeCents = config.model === 'surcharge'
    ? config.surchargeFixedCents + Math.round((bountyCents * config.surchargeBps) / 10_000)
    : Math.round((bountyCents * config.percentBps) / 10_000)
  const chargeCents = config.model === 'surcharge' ? bountyCents + feeCents : bountyCents
  const doerReceivesCents = config.model === 'surcharge' ? bountyCents : bountyCents - feeCents
  const lines = config.model === 'surcharge'
    ? [
        `Bounty ${formatChf(bountyCents)}. The doer receives all of it.`,
        `Service fee ${formatChf(feeCents)} (${formatChf(config.surchargeFixedCents)} + ${config.surchargeBps / 100}% ). You pay this on top.`,
        `You pay ${formatChf(chargeCents)}.`,
        failOutcome === 'charity'
          ? `If the dare is missed, the bounty is marked for charity. The service fee is not refunded.`
          : `If the dare is missed, ${formatChf(bountyCents)} is refunded. The service fee is not refunded, because card fees are not returned.`,
      ]
    : [
        `Bounty ${formatChf(bountyCents)}.`,
        `Service fee ${formatChf(feeCents)} (${config.percentBps / 100}% of the bounty). It comes out of the bounty.`,
        `The doer receives ${formatChf(doerReceivesCents)}.`,
        `You pay ${formatChf(chargeCents)}.`,
        failOutcome === 'charity'
          ? 'If the dare is missed, the bounty is marked for charity instead of refunded.'
          : `If the dare is missed, ${formatChf(chargeCents)} is refunded. A flat 10% does not cover Stripe fees on small bounties or on refunds.`,
      ]
  return { model: config.model, bountyCents, feeCents, chargeCents, doerReceivesCents, failOutcome, lines }
}

export function doerReceivesCents(funding: { amountCents: number; feeCents?: number; feeModel?: FeeModel }): number {
  if (funding.feeModel === 'surcharge') return funding.amountCents
  const fee = funding.feeCents ?? platformFeeCents(funding.amountCents)
  return funding.amountCents - fee
}

export function validateFundingAmount(cents: number, alreadyCommittedCents: number, config: FeeConfig = feeConfig()): string | null {
  if (!Number.isInteger(cents)) return 'Amount must be whole cents'
  if (cents < config.minBountyCents || cents > config.maxBountyCents) {
    return `A bounty must be between ${formatChf(config.minBountyCents)} and ${formatChf(config.maxBountyCents)}`
  }
  if (alreadyCommittedCents + cents > DARE_CAP_CENTS) {
    return 'A dare bounty is capped at CHF 100 in total'
  }
  return null
}

export function validateMonthlyCap(alreadyThisMonthCents: number, nextCents: number): string | null {
  if (alreadyThisMonthCents + nextCents > MONTHLY_CAP_CENTS) {
    return 'Monthly funding cap is CHF 500'
  }
  return null
}

export function formatChf(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return `${sign}CHF ${whole}.${frac}`
}

export function idempotencyTransfer(dareId: string): string {
  return `dare:${dareId}:transfer`
}

export function idempotencyTransferPart(dareId: string, fundingId: string): string {
  return `dare:${dareId}:transfer:${fundingId}`
}

export function idempotencyRefund(dareId: string, fundingId: string): string {
  return `dare:${dareId}:refund:${fundingId}`
}

export function idempotencyVoid(dareId: string, fundingId: string): string {
  return `dare:${dareId}:void:${fundingId}`
}

export function idempotencyCapture(dareId: string, fundingId: string): string {
  return `dare:${dareId}:capture:${fundingId}`
}

/**
 * Split a single dare-level fee across fundings so the parts sum to the total.
 * One funder keeps the key `dare:{id}:transfer`.
 */
export function splitPayout(amounts: number[]): { grossCents: number; feeCents: number; netCents: number; parts: { grossCents: number; feeCents: number; netCents: number }[] } {
  if (amounts.length === 0) {
    return { grossCents: 0, feeCents: 0, netCents: 0, parts: [] }
  }
  for (const amount of amounts) assertIntegerCents(amount, 'funding')
  const grossCents = amounts.reduce((sum, amount) => sum + amount, 0)
  const feeCents = platformFeeCents(grossCents)
  const netCents = grossCents - feeCents
  const parts = amounts.map((gross) => {
    const fee = grossCents === 0 ? 0 : Math.floor((feeCents * gross) / grossCents)
    return { grossCents: gross, feeCents: fee, netCents: gross - fee }
  })
  const assignedFee = parts.reduce((sum, part) => sum + part.feeCents, 0)
  const remainder = feeCents - assignedFee
  const last = parts[parts.length - 1]
  last.feeCents += remainder
  last.netCents -= remainder
  return { grossCents, feeCents, netCents, parts }
}
