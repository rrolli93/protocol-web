import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/auth/google/route'
import { afterGoogleLogin, googleCallbackUrl, handleFromEmail, safeNextPath } from '@/lib/dare/auth-google'
import { resetRuntimeForTests } from '@/lib/dare/runtime'

const INVITE = '/dare/33333333-3333-4333-8333-333333333333/invite'

describe('Google sign-in', () => {
  it('keeps an invite return path and drops open redirects', () => {
    expect(safeNextPath(INVITE)).toBe(INVITE)
    expect(safeNextPath('https://evil.example/phish')).toBe('/dashboard')
    expect(safeNextPath('//evil.example')).toBe('/dashboard')
    expect(safeNextPath('/\\evil')).toBe('/dashboard')
    expect(googleCallbackUrl('http://localhost:3000/', INVITE)).toBe(
      `http://localhost:3000/auth/callback?next=${encodeURIComponent(INVITE)}`,
    )
  })

  it('derives a handle and sends a first Google login through the profile step', () => {
    expect(handleFromEmail('Ada.Rolli@gmail.com')).toBe('adarolli')
    expect(handleFromEmail('a@b.co')).toBe('frienda')
    expect(afterGoogleLogin({ ageConfirmed: false, next: INVITE })).toBe(`/welcome?next=${encodeURIComponent(INVITE)}`)
    expect(afterGoogleLogin({ ageConfirmed: true, next: INVITE })).toBe(INVITE)
    expect(afterGoogleLogin({ ageConfirmed: true, next: 'https://evil.example' })).toBe('/dashboard')
  })

  it('simulates Google in demo mode and refuses it when Supabase is configured', async () => {
    resetRuntimeForTests()
    const saved = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service: process.env.SUPABASE_SERVICE_ROLE_KEY,
    }
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const response = await POST(new Request('http://localhost/api/auth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ next: INVITE }),
    }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.redirect).toBe(`/welcome?next=${encodeURIComponent(INVITE)}`)
    expect(response.cookies.get('dare_dev_user')?.value).toBe('00000000-0000-4000-8000-000000000004')

    const evil = await POST(new Request('http://localhost/api/auth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ next: 'https://evil.example' }),
    }))
    const evilBody = await evil.json()
    expect(evilBody.redirect).toBe('/welcome?next=%2Fdashboard')

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    const blocked = await POST(new Request('http://localhost/api/auth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ next: INVITE }),
    }))
    expect(blocked.status).toBe(400)

    if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url
    if (saved.anon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.anon
    if (saved.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.service
  })

  it('keeps Dare copy on the sign-in and sign-up pages', () => {
    const login = readFileSync('app/login/page.tsx', 'utf8')
    const signup = readFileSync('app/signup/page.tsx', 'utf8')
    const button = readFileSync('app/components/GoogleButton.tsx', 'utf8')
    const deploy = readFileSync('DEPLOY.md', 'utf8')
    for (const source of [login, signup]) {
      expect(source).toContain('DARE')
      expect(source).toContain('Dare a friend for a good cause.')
      expect(source).toContain('<GoogleButton')
      expect(source.toLowerCase()).not.toMatch(/protocol|bet on yourself|stake your future|thousands of challengers|win when you/)
    }
    expect(button).toContain('Continue with Google')
    expect(deploy).toContain('https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback')
    expect(deploy).toContain('http://localhost:3000/**')
  })
})
