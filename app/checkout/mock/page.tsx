'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function MockCheckout() {
  const params = useSearchParams()
  const router = useRouter()
  const sessionId = params.get('session_id') ?? ''
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function pay() {
    setBusy(true)
    const response = await fetch('/api/checkout/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    const body = await response.json()
    setBusy(false)
    if (!response.ok) {
      setError(body.error ?? 'Payment failed')
      return
    }
    router.push(`/dare/${body.dareId}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0F' }}>
      <div className="max-w-sm w-full rounded-xl border p-6" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
        <p className="text-xs mb-2" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>STRIPE TEST STAND-IN</p>
        <h1 className="text-xl font-bold mb-3" style={{ color: '#ffffff' }}>Confirm test payment</h1>
        <p className="text-sm mb-4" style={{ color: '#8888AA' }}>No card is charged. This path is only available when DARE_STRIPE_MOCK=true. Real test mode uses Stripe Checkout and the webhook.</p>
        {error && <p className="text-sm mb-3" style={{ color: '#FF4757' }}>{error}</p>}
        <button onClick={pay} disabled={busy || !sessionId} className="w-full py-3 rounded-xl font-semibold disabled:opacity-40" style={{ backgroundColor: '#6C63FF', color: '#ffffff' }}>
          {busy ? 'Paying…' : 'Pay with test mode'}
        </button>
      </div>
    </main>
  )
}

export default function Page() {
  return <Suspense><MockCheckout /></Suspense>
}
