'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConnectMockPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  async function finish() {
    const response = await fetch('/api/connect/mock-enabled', { method: 'POST' })
    const body = await response.json()
    if (!response.ok) {
      setError(body.error ?? 'Could not enable payouts')
      return
    }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0F' }}>
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-3" style={{ color: '#ffffff' }}>Test payout setup</h1>
        <p className="text-sm mb-4" style={{ color: '#8888AA' }}>
          Stripe Connect Express hosts the real KYC. This button only exists in mock or local memory mode and marks payouts enabled.
        </p>
        {error && <p className="text-sm mb-3" style={{ color: '#FF4757' }}>{error}</p>}
        <button onClick={finish} className="w-full py-3 rounded-xl font-semibold" style={{ backgroundColor: '#6C63FF', color: '#ffffff' }}>
          Mark test account ready
        </button>
      </div>
    </main>
  )
}
