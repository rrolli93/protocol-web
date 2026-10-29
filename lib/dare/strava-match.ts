/**
 * Pure Strava proof matching. No network. CI feeds fixtures.
 *
 * Scope choice lives with the OAuth client: activity:read only returns
 * activities visible to Everyone. Followers-only and private activities,
 * which is how most people record a dare, need activity:read_all.
 */

export const STRAVA_SPORTS = ['run', 'ride', 'walk', 'swim'] as const
export type StravaSport = (typeof STRAVA_SPORTS)[number]

export interface StravaActivityInput {
  id: number | string
  name?: string
  type?: string
  sport_type?: string
  distance: number
  moving_time: number
  total_elevation_gain?: number
  start_date: string
  manual?: boolean
  trainer?: boolean
  device_name?: string | null
  map?: { summary_polyline?: string | null; polyline?: string | null } | null
}

export interface StravaRule {
  activity: StravaSport
  minDistanceM: number
  minElevationM?: number | null
  /** Moving seconds per kilometre. The activity must be this fast or faster. */
  maxPaceSecPerKm?: number | null
  acceptedAt: string
  deadlineAt: string
}

export type StravaSkip =
  | 'manual'
  | 'wrong_type'
  | 'too_early'
  | 'too_late'
  | 'short'
  | 'elevation'
  | 'pace'
  | 'no_gps'

export interface RankedActivity {
  activity: StravaActivityInput
  reasons: StravaSkip[]
  deviceRecorded: boolean
  hasGps: boolean
  distanceM: number
  movingTimeS: number
  elevationM: number
  paceSecPerKm: number | null
}

const TYPE_MAP: Record<StravaSport, string[]> = {
  run: ['run', 'trailrun', 'virtualrun'],
  ride: ['ride', 'mountainbikeride', 'gravelride', 'ebikeride', 'virtualride', 'emountainbikeride'],
  walk: ['walk', 'hike'],
  swim: ['swim'],
}

export function activityMatchesSport(activity: StravaActivityInput, sport: StravaSport): boolean {
  const raw = `${activity.sport_type ?? ''} ${activity.type ?? ''}`.toLowerCase().replace(/[^a-z]/g, '')
  return TYPE_MAP[sport].some((name) => raw.includes(name))
}

export function hasGps(activity: StravaActivityInput): boolean {
  const line = activity.map?.summary_polyline || activity.map?.polyline
  return Boolean(line && line.length > 0)
}

export function isDeviceRecorded(activity: StravaActivityInput): boolean {
  return Boolean(activity.device_name && activity.device_name.trim()) && activity.manual !== true && activity.trainer !== true
}

export function paceSecPerKm(distanceM: number, movingTimeS: number): number | null {
  if (distanceM <= 0 || movingTimeS <= 0) return null
  return movingTimeS / (distanceM / 1000)
}

function rankOne(activity: StravaActivityInput, rule: StravaRule): RankedActivity {
  const reasons: StravaSkip[] = []
  const distanceM = activity.distance
  const movingTimeS = activity.moving_time
  const elevationM = activity.total_elevation_gain ?? 0
  const pace = paceSecPerKm(distanceM, movingTimeS)
  const start = new Date(activity.start_date).getTime()
  const accepted = new Date(rule.acceptedAt).getTime()
  const deadline = new Date(rule.deadlineAt).getTime()
  if (activity.manual === true) reasons.push('manual')
  if (!activityMatchesSport(activity, rule.activity)) reasons.push('wrong_type')
  if (Number.isNaN(start) || start < accepted) reasons.push('too_early')
  if (!Number.isNaN(start) && start > deadline) reasons.push('too_late')
  if (distanceM < rule.minDistanceM) reasons.push('short')
  if (rule.minElevationM != null && elevationM < rule.minElevationM) reasons.push('elevation')
  if (rule.maxPaceSecPerKm != null && (pace == null || pace > rule.maxPaceSecPerKm)) reasons.push('pace')
  const gps = hasGps(activity)
  if (!gps) reasons.push('no_gps')
  return {
    activity,
    reasons,
    deviceRecorded: isDeviceRecorded(activity),
    hasGps: gps,
    distanceM,
    movingTimeS,
    elevationM,
    paceSecPerKm: pace,
  }
}

/** A match that only lacks GPS is flagged, not verified. Manual entries are rejected. */
export function pickStravaProof(activities: StravaActivityInput[], rule: StravaRule): {
  verified: RankedActivity | null
  flagged: RankedActivity[]
  rejected: RankedActivity[]
} {
  const ranked = activities.map((activity) => rankOne(activity, rule))
  const flagged = ranked.filter((row) => row.reasons.length === 1 && row.reasons[0] === 'no_gps')
  const rejected = ranked.filter((row) => row.reasons.some((reason) => reason !== 'no_gps'))
  const verifiedPool = ranked.filter((row) => row.reasons.length === 0)
  verifiedPool.sort((a, b) => {
    if (a.deviceRecorded !== b.deviceRecorded) return a.deviceRecorded ? -1 : 1
    if (a.distanceM !== b.distanceM) return b.distanceM - a.distanceM
    return new Date(b.activity.start_date).getTime() - new Date(a.activity.start_date).getTime()
  })
  return { verified: verifiedPool[0] ?? null, flagged, rejected }
}

/** Demo activity that satisfies the dare, so a preview can show the verified card without calling Strava. */
export function demoActivityFor(rule: StravaRule): StravaActivityInput {
  const start = new Date(new Date(rule.acceptedAt).getTime() + 30 * 60 * 1000)
  const deadline = new Date(rule.deadlineAt).getTime()
  if (start.getTime() > deadline) start.setTime(new Date(rule.acceptedAt).getTime() + 60 * 1000)
  const distance = Math.max(rule.minDistanceM + 250, 1000)
  const pace = rule.maxPaceSecPerKm ? Math.max(60, rule.maxPaceSecPerKm - 15) : 360
  const type = rule.activity === 'ride' ? 'Ride' : rule.activity === 'swim' ? 'Swim' : rule.activity === 'walk' ? 'Hike' : 'Run'
  return {
    id: 9001001,
    name: `Recorded ${type.toLowerCase()}`,
    type,
    sport_type: type,
    distance,
    moving_time: Math.round((distance / 1000) * pace),
    total_elevation_gain: (rule.minElevationM ?? 0) + 12,
    start_date: start.toISOString(),
    manual: false,
    trainer: false,
    device_name: 'Garmin',
    map: { summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
  }
}

export function decodePolyline(encoded: string): Array<[number, number]> {
  const coords: Array<[number, number]> = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index <= encoded.length)
    lat += (result & 1) ? ~(result >> 1) : result >> 1
    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index <= encoded.length)
    lng += (result & 1) ? ~(result >> 1) : result >> 1
    coords.push([lat / 1e5, lng / 1e5])
  }
  return coords
}
