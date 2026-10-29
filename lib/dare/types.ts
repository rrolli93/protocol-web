export const DARE_STATUSES = [
  'draft',
  'open',
  'accepted',
  'proof_submitted',
  'in_review',
  'completed',
  'failed',
  'refunded',
  'paid_out',
  'cancelled',
] as const

export type DareStatus = (typeof DARE_STATUSES)[number]

export type DareMode = 'funded' | 'solo'
export type DareCategory = 'fitness' | 'skills' | 'habits'
export type FundingStatus = 'pending' | 'captured' | 'refunded' | 'transferred' | 'donated'
export type CaptureMethod = 'automatic' | 'manual'
export type AiVerdict = 'pass' | 'fail' | 'unsure'
export type ReviewStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type PayoutStatus = 'pending' | 'transferred' | 'failed'
export type DisputeStatus = 'open' | 'resolved'

export interface ProofRequirements {
  continuous: boolean
  spokenCodeWord: boolean
  framing: string
}

export interface User {
  id: string
  handle: string
  displayName: string
  email: string
  avatarUrl: string | null
  country: string | null
  createdAt: string
  stripeAccountId: string | null
  payoutsEnabled: boolean
  dob: string | null
  ageConfirmed: boolean
  isAdmin: boolean
}

export interface Dare {
  id: string
  creatorId: string
  doerId: string | null
  mode: DareMode
  title: string
  rules: string
  category: DareCategory
  proofRequirements: ProofRequirements
  deadlineAt: string
  status: DareStatus
  charityId: string | null
  currency: 'CHF'
  createdAt: string
  codeWord: string | null
  gesture: string | null
  disputeWindowEndsAt: string | null
}

export interface Funding {
  id: string
  dareId: string
  funderId: string
  amountCents: number
  stripeCheckoutSessionId: string | null
  stripePaymentIntentId: string | null
  stripeChargeId: string | null
  captureMethod: CaptureMethod
  status: FundingStatus
  /** Set to "pending" while a refund is in flight, then the Stripe refund id. */
  refundId: string | null
  createdAt: string
}

export interface Proof {
  id: string
  dareId: string
  doerId: string
  storagePath: string
  durationS: number
  sha256: string
  codeWord: string
  submittedAt: string
  aiVerdict: AiVerdict | null
  aiConfidence: number | null
  aiRationale: string | null
  aiModel: string | null
  reviewStatus: ReviewStatus
  reviewerId: string | null
  reviewedAt: string | null
  repCount: number | null
  cutDetected: boolean | null
}

export interface Dispute {
  id: string
  dareId: string
  openedBy: string
  reason: string
  status: DisputeStatus
  createdAt: string
}

export interface Payout {
  id: string
  dareId: string
  stripeTransferId: string | null
  grossCents: number
  feeCents: number
  netCents: number
  status: PayoutStatus
  createdAt: string
}

export interface Charity {
  id: string
  name: string
  url: string
  active: boolean
}

export interface DareEvent {
  id: number
  dareId: string | null
  type: string
  payload: unknown
  createdAt: string
}

export interface WebhookClaim {
  id: string
  type: string
  state: 'processing' | 'done'
}

export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function fail(status: number, error: string): Result<never> {
  return { ok: false, status, error }
}
