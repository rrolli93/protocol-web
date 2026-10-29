import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { devStoreEnabled } from './flags'
import { applyAdminFlag, getRepo } from './runtime'
import type { User } from './types'

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status })
}

export function appOrigin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return new URL(request.url).origin
}

export async function currentUser(): Promise<User | null> {
  if (devStoreEnabled()) {
    const jar = await cookies()
    const id = jar.get('dare_dev_user')?.value
    if (!id) return null
    const user = await getRepo().getUser(id)
    return user ? applyAdminFlag(user) : null
  }

  let data: { user: { id: string; email?: string | null } | null }
  try {
    const { createSupabaseServer } = await import('@/lib/supabase/server')
    const supabase = await createSupabaseServer()
    const result = await supabase.auth.getUser()
    data = result.data
  } catch {
    return null
  }
  if (!data.user) return null
  const repo = getRepo()
  const existing = await repo.getUser(data.user.id)
  const handle = existing?.handle || data.user.email?.split('@')[0] || 'friend'
  const user: User = existing ?? {
    id: data.user.id,
    handle,
    displayName: handle,
    email: data.user.email ?? '',
    avatarUrl: null,
    country: null,
    createdAt: new Date().toISOString(),
    stripeAccountId: null,
    payoutsEnabled: false,
    dob: null,
    ageConfirmed: false,
    isAdmin: false,
  }
  return applyAdminFlag({ ...user, email: user.email || data.user.email || '' })
}

export async function requireUser(): Promise<User | NextResponse> {
  const user = await currentUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  return user
}

export function isUser(value: User | NextResponse): value is User {
  return !(value instanceof NextResponse)
}
