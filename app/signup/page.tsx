'use client'

import { useState, FormEvent, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import GoogleButton from '@/app/components/GoogleButton'
import { safeNextPath } from '@/lib/dare/auth-google'

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dob, setDob] = useState('')
  const [ageOk, setAgeOk] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (username.length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!ageOk || !dob) {
      setError('Confirm you are 18 or older and enter your date of birth.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Best-effort insert — ignore RLS/conflict errors, auth is what matters
      try {
        await supabase.from('users').insert({
          id: data.user.id,
          username,
          handle: username,
          display_name: username,
          dob,
          age_confirmed: true,
        })
        await fetch('/api/me', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ handle: username, displayName: username, dob, ageConfirmed: true }),
        })
      } catch (_) {}
    }

    router.push(next)
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#0A0A0F' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-black tracking-widest"
            style={{ color: '#6C63FF', fontFamily: "'JetBrains Mono', monospace" }}
          >
            DARE
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#8888AA' }}>Dare a friend for a good cause. 18+ only.</p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-6 border"
          style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}
        >
          <h2
            className="text-lg font-semibold mb-6"
            style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
          >
            Create Account
          </h2>

          <GoogleButton next={next} />
          <p className="text-xs text-center mb-4" style={{ color: '#8888AA' }}>or create an account with email</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                required
                placeholder="yourname"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors focus:border-purple-500"
                style={{
                  backgroundColor: '#0A0A0F',
                  border: '1px solid #1A1A2E',
                  color: '#ffffff',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors focus:border-purple-500"
                style={{
                  backgroundColor: '#0A0A0F',
                  border: '1px solid #1A1A2E',
                  color: '#ffffff',
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="min. 6 characters"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors focus:border-purple-500"
                style={{
                  backgroundColor: '#0A0A0F',
                  border: '1px solid #1A1A2E',
                  color: '#ffffff',
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                DATE OF BIRTH
              </label>
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ backgroundColor: '#0A0A0F', border: '1px solid #1A1A2E', color: '#ffffff' }}
              />
            </div>
            <label className="flex items-start gap-2 text-sm" style={{ color: '#8888AA' }}>
              <input type="checkbox" checked={ageOk} onChange={e => setAgeOk(e.target.checked)} className="mt-1" />
              I confirm I am 18 or older.
            </label>

            {error && (
              <p
                className="text-sm px-3 py-2 rounded-lg"
                style={{ color: '#FF4757', backgroundColor: 'rgba(255,71,87,0.1)', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor: '#6C63FF',
                color: '#ffffff',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-sm" style={{ color: '#8888AA' }}>
          Already have an account?{' '}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="hover:underline" style={{ color: '#6C63FF' }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
