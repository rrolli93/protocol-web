'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function SuccessInner() {
  const params = useSearchParams()
  const sessionId = params.get('session_id') ?? ''
  const [note, setNote] = useState('Waiting for Stripe to confirm the payment.')

  useEffect(() => {
    if (!sessionId || sessionId.includes('{')) return
    fetch('/api/checkout/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).then(async (response) => {
      if (response.status === 404) {
        setNote('If you used a real test key, the webhook marks the bounty captured. Refresh the dare in a few seconds.')
        return
      }
      const body = await response.json()
      setNote(response.ok ? `Payment recorded (${body.status}).` : (body.error ?? 'Could not confirm'))
    }).catch(() => setNote('Could not reach the server.'))
  }, [sessionId])

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0F' }}>
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold mb-3" style={{ color: '#ffffff' }}>Payment submitted</h1>
        <p className="text-sm mb-6" style={{ color: '#8888AA' }}>{note}</p>
        <Link href="/dashboard" className="px-4 py-3 rounded-xl inline-block" style={{ backgroundColor: '#6C63FF', color: '#ffffff' }}>Back to dares</Link>
      </div>
    </main>
  )
}

export default function Page() {
  return <Suspense><SuccessInner /></Suspense>
}
