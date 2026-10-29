import { createHash } from 'crypto'
import { fetchStravaActivities, refreshStravaToken } from '@/lib/strava'
import { newId, type DareRepo } from './repo'
import { disputeWindowEnd } from './settlement'
import { demoActivityFor, pickStravaProof, type StravaActivityInput } from './strava-match'
import { getStravaConnection, saveStravaConnection, type StravaConnection } from './strava-store'
import { fail, ok, type Dare, type Proof, type Result } from './types'

async function tokenFor(connection: StravaConnection, fetchImpl: typeof fetch): Promise<StravaConnection> {
  if (connection.demo) return connection
  if (new Date(connection.expiresAt).getTime() > Date.now() + 60_000) return connection
  const refreshed = await refreshStravaToken(connection.refreshToken, fetchImpl)
  const next: StravaConnection = {
    ...connection,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || connection.refreshToken,
    expiresAt: new Date(refreshed.expires_at * 1000).toISOString(),
    scope: refreshed.scope || connection.scope,
  }
  await saveStravaConnection(next)
  return next
}

export async function loadActivities(
  connection: StravaConnection,
  dare: Dare,
  fetchImpl: typeof fetch,
): Promise<StravaActivityInput[]> {
  if (connection.demo) {
    if (!dare.strava || !dare.acceptedAt) return []
    return [demoActivityFor({
      activity: dare.strava.activity,
      minDistanceM: dare.strava.minDistanceM,
      minElevationM: dare.strava.minElevationM,
      maxPaceSecPerKm: dare.strava.maxPaceSecPerKm,
      acceptedAt: dare.acceptedAt,
      deadlineAt: dare.deadlineAt,
    })]
  }
  const live = await tokenFor(connection, fetchImpl)
  const after = dare.acceptedAt ? Math.floor(new Date(dare.acceptedAt).getTime() / 1000) - 60 : 0
  const rows = await fetchStravaActivities(live.accessToken, after, fetchImpl)
  return Array.isArray(rows) ? rows as StravaActivityInput[] : []
}

export async function verifyDareFromStrava(args: {
  dare: Dare
  repo: DareRepo
  now?: Date
  fetchImpl?: typeof fetch
  activities?: StravaActivityInput[]
}): Promise<Result<{ verified: boolean; proof: Proof | null; flagged: number; rejected: number }>> {
  const now = args.now ?? new Date()
  const dare = args.dare
  if (dare.proofKind !== 'strava' || !dare.strava) return fail(400, 'This dare is not Strava-verified')
  if (!dare.doerId) return fail(409, 'Nobody has accepted this dare yet')
  if (dare.status !== 'accepted' && dare.status !== 'completed' && dare.status !== 'proof_submitted' && dare.status !== 'in_review') {
    return fail(409, 'This dare is not waiting for a Strava activity')
  }
  if (!dare.acceptedAt) return fail(409, 'Acceptance time is missing')
  const existing = (await args.repo.listProofs(dare.id)).find((proof) => proof.kind === 'strava' && proof.stravaActivityId)
  if (existing && dare.status === 'completed') {
    return ok({ verified: true, proof: existing, flagged: 0, rejected: 0 })
  }
  const connection = await getStravaConnection(dare.doerId)
  if (!connection) return fail(400, 'Connect Strava before checking this dare')
  let activities = args.activities
  if (!activities) {
    try {
      activities = await loadActivities(connection, dare, args.fetchImpl ?? fetch)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Strava could not be reached'
      return fail(502, message)
    }
  }
  const picked = pickStravaProof(activities, {
    activity: dare.strava.activity,
    minDistanceM: dare.strava.minDistanceM,
    minElevationM: dare.strava.minElevationM,
    maxPaceSecPerKm: dare.strava.maxPaceSecPerKm,
    acceptedAt: dare.acceptedAt,
    deadlineAt: dare.deadlineAt,
  })
  if (!picked.verified) {
    return ok({ verified: false, proof: null, flagged: picked.flagged.length, rejected: picked.rejected.length })
  }
  const match = picked.verified
  const activityId = String(match.activity.id)
  const duplicate = (await args.repo.listProofs(dare.id)).find((proof) => proof.stravaActivityId === activityId)
  if (duplicate) return ok({ verified: true, proof: duplicate, flagged: picked.flagged.length, rejected: picked.rejected.length })
  const proof: Proof = {
    id: newId(),
    dareId: dare.id,
    doerId: dare.doerId,
    storagePath: `strava/${activityId}`,
    durationS: match.movingTimeS,
    sha256: createHash('sha256').update(`strava:${activityId}`).digest('hex'),
    codeWord: 'strava',
    submittedAt: now.toISOString(),
    aiVerdict: 'pass',
    aiConfidence: 1,
    aiRationale: connection.demo
      ? 'Demo activity. No live Strava request was made. A real connection uses this same matcher.'
      : 'Matched a device activity from Strava inside the dare window.',
    aiModel: 'strava',
    reviewStatus: 'approved',
    reviewerId: null,
    reviewedAt: now.toISOString(),
    repCount: null,
    cutDetected: false,
    kind: 'strava',
    capturedAt: now.toISOString(),
    stravaActivityId: activityId,
    stravaName: match.activity.name ?? 'Strava activity',
    stravaDistanceM: Math.round(match.distanceM),
    stravaMovingTimeS: match.movingTimeS,
    stravaElevationM: Math.round(match.elevationM),
    stravaPolyline: match.activity.map?.summary_polyline || match.activity.map?.polyline || null,
    stravaDeviceName: match.activity.device_name ?? null,
  }
  await args.repo.createProof(proof)
  if (dare.status === 'accepted') {
    await args.repo.transition(dare.id, 'proof_submitted', ['accepted'])
    await args.repo.setDisputeWindow(dare.id, disputeWindowEnd(now))
    await args.repo.transition(dare.id, 'completed', ['proof_submitted'])
  }
  await args.repo.logEvent(dare.id, 'strava_verified', { activityId, distanceM: match.distanceM })
  return ok({ verified: true, proof, flagged: picked.flagged.length, rejected: picked.rejected.length })
}
