'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

    router.push('/dashboard')
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
            ⬡ PROTOCOL
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#8888AA' }}>Welcome back. Time to grind.</p>
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
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors focus:border-purple-500"
                style={{
                  backgroundColor: '#0A0A0F',
                  border: '1px solid #1A1A2E',
                  color: '#ffffff',
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </div>

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
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-sm" style={{ color: '#8888AA' }}>
          Don't have an account?{' '}
          <Link href="/signup" className="hover:underline" style={{ color: '#6C63FF' }}>
            Sign up
          </Link>
        </p>
      </div>
    </main>
  )
}
