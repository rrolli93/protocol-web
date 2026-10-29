/** Friend-funded bounty bounds. The doer never pays these. */
export const MIN_BOUNTY_CENTS = 1_000
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
export const MAX_PROOF_BYTES = 200 * 1024 * 1024

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

export function validateFundingAmount(cents: number, alreadyCommittedCents: number): string | null {
  if (!Number.isInteger(cents)) return 'Amount must be whole cents'
  if (cents < MIN_BOUNTY_CENTS || cents > MAX_BOUNTY_CENTS) {
    return 'A bounty must be between CHF 10 and CHF 100'
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
