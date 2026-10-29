import type { User } from './types'

export const DEV_PERSONAS = {
  doer: {
    id: '00000000-0000-4000-8000-000000000001',
    handle: 'doer',
    displayName: 'Doer',
    email: 'doer@dare.local',
    isAdmin: false,
  },
  funder: {
    id: '00000000-0000-4000-8000-000000000002',
    handle: 'funder',
    displayName: 'Funder',
    email: 'funder@dare.local',
    isAdmin: false,
  },
  admin: {
    id: '00000000-0000-4000-8000-000000000003',
    handle: 'reviewer',
    displayName: 'Reviewer',
    email: 'reviewer@dare.local',
    isAdmin: true,
  },
} as const

export type DevPersona = keyof typeof DEV_PERSONAS

export function devUser(persona: DevPersona): User {
  const row = DEV_PERSONAS[persona]
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    email: row.email,
    avatarUrl: null,
    country: 'CH',
    createdAt: new Date().toISOString(),
    stripeAccountId: persona === 'doer' ? null : null,
    payoutsEnabled: false,
    dob: '1990-01-01',
    ageConfirmed: true,
    isAdmin: row.isAdmin,
  }
}
