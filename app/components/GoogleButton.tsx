'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { googleCallbackUrl } from '@/lib/dare/auth-google'

export default function GoogleButton({ next }: { next: string }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function continueWithGoogle() {
    setError('')
    setBusy(true)
    const config = await fetch('/api/config').then((response) => response.json()).catch(() => null)
    if (config?.devStore) {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ next }),
      })
      const body = await response.json().catch(() => ({}))
      setBusy(false)
      if (!response.ok) {
        setError(body.error ?? 'Could not start Google sign-in')
        return
      }
      window.location.href = body.redirect
      return
    }
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: googleCallbackUrl(window.location.origin, next) },
    })
    if (oauthError) {
      setBusy(false)
      setError(oauthError.message)
    }
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={busy}
        className="w-full py-3 rounded-lg font-semibold text-sm border disabled:opacity-50"
        style={{ color: '#ffffff', borderColor: '#6C63FF', backgroundColor: '#12121c', fontFamily: "'JetBrains Mono', monospace" }}
      >
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {error && <p className="text-sm mt-2" style={{ color: '#FF4757' }}>{error}</p>}
    </div>
  )
}
