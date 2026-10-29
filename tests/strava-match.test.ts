import { describe, expect, it } from 'vitest'
import { demoActivityFor, pickStravaProof, type StravaActivityInput, type StravaRule } from '@/lib/dare/strava-match'

const rule: StravaRule = {
  activity: 'run',
  minDistanceM: 5000,
  minElevationM: 50,
  maxPaceSecPerKm: 420,
  acceptedAt: '2026-10-29T12:00:00.000Z',
  deadlineAt: '2026-10-30T12:00:00.000Z',
}

function run(patch: Partial<StravaActivityInput> = {}): StravaActivityInput {
  return {
    id: 1,
    name: 'Morning run',
    type: 'Run',
    distance: 6200,
    moving_time: 2100,
    total_elevation_gain: 80,
    start_date: '2026-10-29T15:00:00.000Z',
    manual: false,
    trainer: false,
    device_name: 'Garmin',
    map: { summary_polyline: 'abc' },
    ...patch,
  }
}

describe('Strava matching', () => {
  it('verifies a device run inside the window and prefers it over a phone-only run', () => {
    const phone = run({ id: 2, device_name: null, distance: 8000 })
    const watch = run({ id: 3, device_name: 'Coros', distance: 6100 })
    const picked = pickStravaProof([phone, watch], rule)
    expect(picked.verified?.activity.id).toBe(3)
    expect(picked.verified?.deviceRecorded).toBe(true)
    expect(picked.flagged).toHaveLength(0)
  })

  it('rejects manual entries even when they have a map', () => {
    const picked = pickStravaProof([run({ manual: true })], rule)
    expect(picked.verified).toBeNull()
    expect(picked.rejected[0]?.reasons).toContain('manual')
  })

  it('flags a matching activity that has no GPS polyline and does not verify it', () => {
    const picked = pickStravaProof([run({ map: { summary_polyline: '' }, device_name: 'Garmin' })], rule)
    expect(picked.verified).toBeNull()
    expect(picked.flagged).toHaveLength(1)
    expect(picked.flagged[0]?.reasons).toEqual(['no_gps'])
  })

  it('rejects the wrong sport, a short distance, early and late starts, elevation, and pace', () => {
    const cases: Array<[Partial<StravaActivityInput>, string]> = [
      [{ type: 'Ride' }, 'wrong_type'],
      [{ distance: 1000 }, 'short'],
      [{ start_date: '2026-10-29T11:00:00.000Z' }, 'too_early'],
      [{ start_date: '2026-10-31T11:00:00.000Z' }, 'too_late'],
      [{ total_elevation_gain: 10 }, 'elevation'],
      [{ moving_time: 5000 }, 'pace'],
    ]
    for (const [patch, reason] of cases) {
      const picked = pickStravaProof([run(patch)], rule)
      expect(picked.verified).toBeNull()
      expect(picked.rejected[0]?.reasons).toContain(reason)
    }
  })

  it('treats a hike as a walk and builds a demo activity that verifies', () => {
    const hikeRule: StravaRule = { ...rule, activity: 'walk', minElevationM: null, maxPaceSecPerKm: null, minDistanceM: 3000 }
    const hike = run({ type: 'Hike', sport_type: 'Hike', distance: 4000 })
    expect(pickStravaProof([hike], hikeRule).verified?.activity.id).toBe(1)
    const demo = demoActivityFor(hikeRule)
    expect(pickStravaProof([demo], hikeRule).verified).not.toBeNull()
    expect(demo.manual).toBe(false)
    expect(demo.map?.summary_polyline).toBeTruthy()
  })
})
