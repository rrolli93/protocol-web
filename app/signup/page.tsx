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
    <main className="dare-page flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="dare-hero-mark mx-auto mb-4" aria-hidden>D</Link>
          <h1 className="font-display text-5xl font-extrabold" style={{ color: '#fff' }}>DARE</h1>
          <p className="mt-2 text-sm" style={{ color: '#c4bdd6' }}>Dare a friend for a good cause. 18+ only.</p>
        </div>
        <div className="dare-card p-6">
          <h2 className="font-display text-2xl mb-5" style={{ color: '#fff' }}>Create Account</h2>
          <GoogleButton next={next} />
          <p className="text-xs text-center mb-4" style={{ color: '#c4bdd6' }}>or create an account with email</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="signup-username" className="dare-kicker block mb-1.5">Username</label>
              <input id="signup-username" type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} required placeholder="yourname" className="dare-input" />
            </div>
            <div>
              <label htmlFor="signup-email" className="dare-kicker block mb-1.5">Email</label>
              <input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className="dare-input" />
            </div>
            <div>
              <label htmlFor="signup-password" className="dare-kicker block mb-1.5">Password</label>
              <input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="min. 6 characters" className="dare-input" />
            </div>
            <div>
              <label htmlFor="signup-dob" className="dare-kicker block mb-1.5">Date of birth</label>
              <input id="signup-dob" type="date" value={dob} onChange={e => setDob(e.target.value)} required className="dare-input" />
            </div>
            <label className="flex items-start gap-2 text-sm" style={{ color: '#e7e2f4' }}>
              <input type="checkbox" checked={ageOk} onChange={e => setAgeOk(e.target.checked)} className="mt-1" />
              I confirm I am 18 or older.
            </label>
            {error && <p className="text-sm px-3 py-2 rounded-xl" role="alert" style={{ color: '#ffb4bc', background: 'rgba(255,71,87,0.12)' }}>{error}</p>}
            <button type="submit" disabled={loading} className="dare-btn w-full py-3 text-sm">{loading ? 'Creating account...' : 'Create Account'}</button>
          </form>
        </div>
        <p className="text-center mt-5 text-sm" style={{ color: '#c4bdd6' }}>
          Already have an account?{' '}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="underline" style={{ color: '#d7d1ff' }}>Sign in</Link>
        </p>
      </div>
    </main>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
