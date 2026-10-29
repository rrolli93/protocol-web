'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'

const mono = { fontFamily: "'JetBrains Mono', monospace" }

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [age, setAge] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function join(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, ageConfirmed: age }),
    })
    const body = await response.json()
    setBusy(false)
    setMessage(response.ok ? 'You are on the list. We will only use this address for early access.' : (body.error ?? 'Could not save that email'))
  }

  return (
    <main className="min-h-screen px-4 py-10" style={{ backgroundColor: '#0A0A0F' }}>
      <div className="max-w-3xl mx-auto">
        <p className="text-xs tracking-[0.3em]" style={{ color: '#6C63FF', ...mono }}>DARE</p>
        <h1 className="text-4xl md:text-6xl font-black mt-3 mb-4" style={{ color: '#ffffff', ...mono }}>Friends fund the challenge.</h1>
        <p className="text-lg mb-8" style={{ color: '#cccccc' }}>
          Someone puts up CHF for a real-world dare. The person who does it never pays. Video proof decides the result.
        </p>
        <ol className="grid md:grid-cols-4 gap-3 mb-8">
          {[
            ['1', 'Fund', 'A friend pays a bounty. The doer stakes nothing.'],
            ['2', 'Prove', 'One continuous video, with a code word shown at the start.'],
            ['3', 'Review', 'An AI check, then a person when it is unsure.'],
            ['4', 'Settle', 'Done pays the doer. Missed refunds the funder, or goes to charity if they chose that.'],
          ].map(([step, title, copy]) => (
            <li key={step} className="rounded-xl border p-4" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
              <p className="text-xs" style={{ color: '#6C63FF', ...mono }}>{step}</p>
              <p className="font-semibold mt-1" style={{ color: '#ffffff' }}>{title}</p>
              <p className="text-sm mt-2" style={{ color: '#8888AA' }}>{copy}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm mb-6" style={{ color: '#8888AA' }}>
          The service fee is shown before anyone pays. It is either taken from the bounty or added on top, depending on configuration. Paid mode stays off until a Stripe test key is enabled. 18+ only.
        </p>
        <form onSubmit={join} className="rounded-xl border p-4 mb-6" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
          <h2 className="font-semibold mb-2" style={{ color: '#ffffff', ...mono }}>Early access</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="you@example.com" className="flex-1 px-3 py-3 rounded-lg text-sm" style={{ backgroundColor: '#0A0A0F', color: '#ffffff', border: '1px solid #1A1A2E' }} />
            <button disabled={busy} className="px-4 py-3 rounded-lg font-semibold" style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}>{busy ? 'Saving…' : 'Join the list'}</button>
          </div>
          <label className="flex items-start gap-2 text-sm mt-3" style={{ color: '#cccccc' }}>
            <input type="checkbox" checked={age} onChange={(event) => setAge(event.target.checked)} className="mt-1" />
            I confirm I am 18 or older.
          </label>
          {message && <p className="text-sm mt-3" style={{ color: '#00FF87' }}>{message}</p>}
        </form>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/signup" style={{ color: '#6C63FF' }}>Create an account</Link>
          <Link href="/login" style={{ color: '#6C63FF' }}>Sign in</Link>
          <Link href="/legal/payouts" style={{ color: '#8888AA' }}>How payouts work</Link>
          <Link href="/legal/terms" style={{ color: '#8888AA' }}>Terms (draft)</Link>
          <Link href="/legal/privacy" style={{ color: '#8888AA' }}>Privacy (draft)</Link>
        </div>
      </div>
    </main>
  )
}
