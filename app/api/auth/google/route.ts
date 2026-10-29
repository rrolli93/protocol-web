import { afterGoogleLogin } from '@/lib/dare/auth-google'
import { devStoreEnabled } from '@/lib/dare/flags'
import { json } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'
import type { User } from '@/lib/dare/types'

const DEMO_GOOGLE_ID = '00000000-0000-4000-8000-000000000004'

/** Demo stand-in for Google OAuth. Real Google runs through Supabase when keys exist. */
export async function POST(request: Request) {
  if (!devStoreEnabled()) return json({ error: 'Google is configured through Supabase. Use the button on the sign-in page.' }, 400)
  const body = await request.json().catch(() => ({})) as { next?: string }
  const repo = getRepo()
  const existing = await repo.getUser(DEMO_GOOGLE_ID)
  const user: User = existing ?? {
    id: DEMO_GOOGLE_ID,
    handle: 'googlefriend',
    displayName: 'Google friend',
    email: 'google.friend@dare.local',
    avatarUrl: null,
    country: 'CH',
    createdAt: new Date().toISOString(),
    stripeAccountId: null,
    payoutsEnabled: false,
    dob: null,
    ageConfirmed: false,
    isAdmin: false,
  }
  if (!existing) await repo.upsertUser(user)
  const response = json({ redirect: afterGoogleLogin({ ageConfirmed: user.ageConfirmed, next: body.next }) })
  response.cookies.set('dare_dev_user', user.id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  return response
}
