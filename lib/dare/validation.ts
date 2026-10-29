import type { DareCategory, DareMode } from './types'

export const CATEGORIES: DareCategory[] = ['fitness', 'skills', 'habits']

const BANNED_TERMS = [
  'minor',
  'minors',
  'child',
  'children',
  'kid',
  'kids',
  'underage',
  'teenager',
  'teen',
  'alcohol',
  'beer',
  'wine',
  'drunk',
  'vodka',
  'whisky',
  'whiskey',
  'binge',
  'fasting',
  'starve',
  'starvation',
  'stunt',
  'rooftop',
  'cocaine',
  'heroin',
  'suicide',
  'self harm',
  'brawl',
  'nude',
  'naked',
  'porn',
  'pornography',
  'sexual',
  'nsfw',
  'weapon',
  'firearm',
  'gun',
]

export interface CreateDareInput {
  title: string
  rules: string
  category: string
  mode: string
  deadlineAt: string
  framing?: string
  charityId?: string | null
  pledgeCents?: number | null
  creatorIsDoer?: boolean
  failOutcome?: 'refund' | 'charity'
}

export interface ValidDareDraft {
  title: string
  rules: string
  category: DareCategory
  mode: DareMode
  deadlineAt: string
  framing: string
  charityId: string | null
  pledgeCents: number | null
  creatorIsDoer: boolean
  failOutcome: 'refund' | 'charity'
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export function findBannedTerm(text: string): string | null {
  const cleaned = text.toLowerCase().replace(/child['’]s pose/g, ' ')
  const padded = ` ${cleaned.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `
  for (const term of BANNED_TERMS) {
    if (padded.includes(` ${term} `)) return term
  }
  return null
}

export function isAtLeast18(dob: string | null | undefined, now = new Date()): boolean {
  if (!dob) return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  let age = now.getUTCFullYear() - year
  const nowMonth = now.getUTCMonth() + 1
  const nowDay = now.getUTCDate()
  if (nowMonth < month || (nowMonth === month && nowDay < day)) age -= 1
  return age >= 18
}

export function validateDeadline(deadlineAt: string, now = new Date()): string | null {
  const deadline = new Date(deadlineAt)
  if (Number.isNaN(deadline.getTime())) return 'Deadline is not a valid date'
  const delta = deadline.getTime() - now.getTime()
  if (delta < 24 * HOUR_MS) return 'Deadline must be at least 24 hours away'
  if (delta > 30 * DAY_MS) return 'Deadline must be within 30 days'
  return null
}

export function validateCreateDare(input: CreateDareInput, now = new Date()): { ok: true; value: ValidDareDraft } | { ok: false; error: string } {
  const title = input.title?.trim() ?? ''
  const rules = input.rules?.trim() ?? ''
  const framing = input.framing?.trim() ?? ''
  if (title.length < 3 || title.length > 80) return { ok: false, error: 'Title must be 3–80 characters' }
  if (rules.length < 10 || rules.length > 2_000) return { ok: false, error: 'Rules must be 10–2000 characters' }
  if (framing.length > 300) return { ok: false, error: 'Framing note is too long' }
  if (!CATEGORIES.includes(input.category as DareCategory)) {
    return { ok: false, error: 'Category must be fitness, skills, or habits' }
  }
  if (input.mode !== 'funded' && input.mode !== 'solo') {
    return { ok: false, error: 'Mode must be funded or solo' }
  }
  const banned = findBannedTerm(`${title}\n${rules}\n${framing}`)
  if (banned) return { ok: false, error: `This dare is not allowed (matched “${banned}”)` }
  const deadlineError = validateDeadline(input.deadlineAt, now)
  if (deadlineError) return { ok: false, error: deadlineError }
  const failOutcome = input.failOutcome === 'charity' ? 'charity' : 'refund'
  if (input.mode === 'solo' && !input.charityId) {
    return { ok: false, error: 'Solo mode needs a charity' }
  }
  if (input.mode === 'funded' && failOutcome === 'charity' && !input.charityId) {
    return { ok: false, error: 'Name a charity for a missed dare' }
  }
  if (input.mode === 'funded' && failOutcome !== 'charity' && input.charityId) {
    return { ok: false, error: 'A charity is only used when a miss goes to charity' }
  }
  const pledge = input.pledgeCents ?? null
  if (input.mode === 'funded' && pledge) {
    return { ok: false, error: 'The doer does not put money in. A funder pays the bounty.' }
  }
  return {
    ok: true,
    value: {
      title,
      rules,
      category: input.category as DareCategory,
      mode: input.mode,
      deadlineAt: new Date(input.deadlineAt).toISOString(),
      framing,
      charityId: input.charityId ?? null,
      pledgeCents: input.mode === 'solo' ? pledge : null,
      creatorIsDoer: Boolean(input.creatorIsDoer),
      failOutcome: input.mode === 'solo' ? 'charity' : failOutcome,
    },
  }
}

export function daysUntil(deadlineAt: string, now = new Date()): number {
  return (new Date(deadlineAt).getTime() - now.getTime()) / DAY_MS
}
