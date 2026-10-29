'use client'

import { useState, FormEvent, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import GoogleButton from '@/app/components/GoogleButton'
import { safeNextPath } from '@/lib/dare/auth-google'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push(next)
  }

  return (
    <main className="dare-page flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="dare-hero-mark mx-auto mb-4" aria-hidden>D</Link>
          <h1 className="font-display text-5xl font-extrabold" style={{ color: '#fff' }}>DARE</h1>
          <p className="mt-2 text-sm" style={{ color: '#c4bdd6' }}>Dare a friend for a good cause.</p>
        </div>
        <div className="dare-card p-6">
          <h2 className="font-display text-2xl mb-5" style={{ color: '#fff' }}>Sign In</h2>
          <GoogleButton next={next} />
          <p className="text-xs text-center mb-4" style={{ color: '#c4bdd6' }}>or use email</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="dare-kicker block mb-1.5">Email</label>
              <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className="dare-input" />
            </div>
            <div>
              <label htmlFor="login-password" className="dare-kicker block mb-1.5">Password</label>
              <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="dare-input" />
            </div>
            {notice && <p className="text-sm px-3 py-2 rounded-xl" role="status" style={{ color: '#7dffe0', background: 'rgba(61,255,176,0.08)' }}>{notice}</p>}
            {error && <p className="text-sm px-3 py-2 rounded-xl" role="alert" style={{ color: '#ffb4bc', background: 'rgba(255,71,87,0.12)' }}>{error}</p>}
            <button type="submit" disabled={loading} className="dare-btn w-full py-3 text-sm">{loading ? 'Signing in...' : 'Sign In'}</button>
            <button
              type="button"
              onClick={async () => {
                setError('')
                setNotice('')
                if (!email) { setError('Enter your email for a magic link.'); return }
                const supabase = createClient()
                const { error: otpError } = await supabase.auth.signInWithOtp({
                  email,
                  options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
                })
                if (otpError) setError(otpError.message)
                else setNotice('Check your email for a sign-in link.')
              }}
              className="dare-btn-ghost w-full py-3 text-sm"
            >
              Email me a magic link
            </button>
          </form>
        </div>
        <p className="text-center mt-5 text-sm" style={{ color: '#c4bdd6' }}>
          Don&apos;t have an account?{' '}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="underline" style={{ color: '#d7d1ff' }}>Sign up</Link>
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
