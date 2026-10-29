import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { afterGoogleLogin, handleFromEmail } from '@/lib/dare/auth-google'
import { getRepo } from '@/lib/dare/runtime'
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase'
import type { User } from '@/lib/dare/types'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=google', url.origin))
  }
  const jar = await cookies()
  const pending: { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] }[] = []
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll(cookiesToSet) {
        pending.length = 0
        for (const cookie of cookiesToSet) {
          pending.push(cookie)
          jar.set(cookie.name, cookie.value, cookie.options)
        }
      },
    },
  })
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return NextResponse.redirect(new URL('/login?error=google', url.origin))
  }
  const email = data.user.email ?? ''
  const derived = handleFromEmail(email || data.user.id)
  const repo = getRepo()
  let profile = await repo.getUser(data.user.id)
  if (!profile) {
    const created: User = {
      id: data.user.id,
      handle: derived,
      displayName: derived,
      email,
      avatarUrl: null,
      country: null,
      createdAt: new Date().toISOString(),
      stripeAccountId: null,
      payoutsEnabled: false,
      dob: null,
      ageConfirmed: false,
      isAdmin: false,
    }
    profile = await repo.upsertUser(created)
  }
  const dest = afterGoogleLogin({ ageConfirmed: profile.ageConfirmed, next })
  const redirect = NextResponse.redirect(new URL(dest, url.origin))
  for (const cookie of pending) {
    redirect.cookies.set(cookie.name, cookie.value, cookie.options)
  }
  return redirect
}
