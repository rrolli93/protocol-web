import type { DareStatus } from './types'

const ALLOWED: Record<DareStatus, readonly DareStatus[]> = {
  draft: ['open', 'cancelled'],
  open: ['accepted', 'cancelled', 'failed'],
  accepted: ['proof_submitted', 'failed', 'cancelled'],
  proof_submitted: ['in_review', 'completed', 'failed', 'accepted', 'cancelled'],
  in_review: ['completed', 'failed', 'accepted', 'cancelled'],
  completed: ['paid_out', 'refunded', 'in_review', 'failed'],
  failed: ['refunded'],
  cancelled: ['refunded'],
  refunded: [],
  paid_out: [],
}

export function canTransition(from: DareStatus, to: DareStatus): boolean {
  return ALLOWED[from].includes(to)
}

export function assertTransition(from: DareStatus, to: DareStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal dare transition ${from} -> ${to}`)
  }
}
