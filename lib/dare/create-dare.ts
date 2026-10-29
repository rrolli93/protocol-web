import { newId, type DareRepo } from './repo'
import { isAtLeast18, validateCreateDare, type CreateDareInput } from './validation'
import { fail, ok, type Dare, type Result, type User } from './types'

export async function createDareForUser(input: CreateDareInput, user: User, repo: DareRepo, now = new Date()): Promise<Result<Dare>> {
  if (!user.ageConfirmed || !isAtLeast18(user.dob, now)) {
    return fail(403, 'You need to confirm you are 18 or older')
  }
  const parsed = validateCreateDare(input, now)
  if (!parsed.ok) return fail(400, parsed.error)
  if (parsed.value.charityId) {
    const charity = await repo.getCharity(parsed.value.charityId)
    if (!charity?.active) return fail(400, 'Pick an active charity')
  }
  const solo = parsed.value.mode === 'solo'
  const creatorIsDoer = solo || parsed.value.creatorIsDoer
  const dare: Dare = {
    id: newId(),
    creatorId: user.id,
    doerId: creatorIsDoer ? user.id : null,
    mode: parsed.value.mode,
    title: parsed.value.title,
    rules: parsed.value.rules,
    category: parsed.value.category,
    proofRequirements: {
      continuous: true,
      spokenCodeWord: true,
      framing: parsed.value.framing,
    },
    deadlineAt: parsed.value.deadlineAt,
    status: creatorIsDoer ? 'accepted' : 'open',
    charityId: parsed.value.charityId,
    failOutcome: parsed.value.failOutcome,
    currency: 'CHF',
    createdAt: now.toISOString(),
    codeWord: null,
    gesture: null,
    disputeWindowEndsAt: null,
    proofKind: parsed.value.proofKind,
    acceptedAt: creatorIsDoer ? now.toISOString() : null,
    proofIssuedAt: null,
    strava: parsed.value.proofKind === 'strava' && parsed.value.stravaActivity ? {
      activity: parsed.value.stravaActivity,
      minDistanceM: parsed.value.minDistanceM ?? 0,
      minElevationM: parsed.value.minElevationM,
      maxPaceSecPerKm: parsed.value.maxPaceSecPerKm,
    } : null,
  }
  await repo.createDare(dare)
  return ok(dare)
}
