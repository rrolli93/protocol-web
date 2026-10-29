'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'

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
    <main className="dare-page">
      <header className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: '#fff' }}>
          <span className="dare-hero-mark" style={{ width: 32, height: 32, borderRadius: 10, fontSize: 14, boxShadow: 'none' }} aria-hidden>D</span>
          DARE
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="dare-btn-ghost text-sm px-4 py-2">Sign in</Link>
          <Link href="/signup" className="dare-btn text-sm px-4 py-2">Get started</Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-5 pt-8 pb-16 md:pt-16 md:pb-24 grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
        <div>
          <p className="dare-kicker rise">Dare a friend for a good cause</p>
          <h1 className="font-display font-extrabold text-5xl md:text-7xl mt-4 mb-5 rise rise-2" style={{ color: '#fff', lineHeight: 0.95 }}>
            Friends fund the challenge.
          </h1>
          <p className="text-lg md:text-xl max-w-xl rise rise-3" style={{ color: '#d9d3ea' }}>
            Someone puts up CHF for a real-world dare. The person who does it never pays. Video proof decides the result.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link href="/signup" className="dare-btn px-6 py-3">Create an account</Link>
            <Link href="/login" className="dare-btn-ghost px-6 py-3">Sign in</Link>
          </div>
        </div>

        <div className="dare-card p-6 md:p-8 rise rise-3" aria-hidden={false}>
          <p className="dare-kicker">How a dare moves</p>
          <ol className="mt-5 flex flex-col gap-4">
            {[
              ['01', 'Fund', 'A friend pays a bounty. The doer never pays.'],
              ['02', 'Prove', 'One continuous video, with a code word shown at the start.'],
              ['03', 'Review', 'An AI check, then a person when it is unsure.'],
              ['04', 'Settle', 'Done pays the doer. Missed refunds the funder, or goes to charity if they chose that.'],
            ].map(([step, title, copy]) => (
              <li key={step} className="flex gap-4">
                <span className="font-display text-sm pt-0.5" style={{ color: '#b1a6ff' }}>{step}</span>
                <div>
                  <p className="font-semibold" style={{ color: '#fff' }}>{title}</p>
                  <p className="text-sm mt-1" style={{ color: '#c4bdd6' }}>{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-20 grid md:grid-cols-3 gap-4">
        {[
          ['No entry fee', 'The doer never puts money in. A funder pays the bounty.'],
          ['Proof, not promises', 'A code word and one continuous clip. A person reviews the edge cases.'],
          ['Clear money', 'The fee is shown before anyone pays. A miss refunds the funder, or goes to charity if they chose that.'],
        ].map(([title, copy]) => (
          <article key={title} className="dare-card p-5">
            <h2 className="font-display text-2xl" style={{ color: '#fff' }}>{title}</h2>
            <p className="text-sm mt-2" style={{ color: '#c4bdd6' }}>{copy}</p>
          </article>
        ))}
      </section>

      <section className="max-w-xl mx-auto px-5 pb-20">
        <form onSubmit={join} className="dare-card p-5 md:p-6">
          <h2 className="font-display text-2xl mb-1" style={{ color: '#fff' }}>Early access</h2>
          <p className="text-sm mb-4" style={{ color: '#c4bdd6' }}>
            18+ only. The service fee is shown before anyone pays. Paid mode stays off until a Stripe test key is enabled.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="sr-only" htmlFor="waitlist-email">Email</label>
            <input id="waitlist-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="you@example.com" className="dare-input flex-1" />
            <button disabled={busy} className="dare-btn px-5 py-3">{busy ? 'Saving…' : 'Join the list'}</button>
          </div>
          <label className="flex items-start gap-2 text-sm mt-4" style={{ color: '#e7e2f4' }}>
            <input type="checkbox" checked={age} onChange={(event) => setAge(event.target.checked)} className="mt-1" />
            I confirm I am 18 or older.
          </label>
          {message && <p className="text-sm mt-3" role="status" style={{ color: '#7dffe0' }}>{message}</p>}
        </form>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm mt-5" aria-label="Legal">
          <Link href="/legal/payouts" style={{ color: '#c4bdd6' }}>How payouts work</Link>
          <Link href="/legal/terms" style={{ color: '#c4bdd6' }}>Terms (draft)</Link>
          <Link href="/legal/privacy" style={{ color: '#c4bdd6' }}>Privacy (draft)</Link>
        </nav>
      </section>
    </main>
  )
}
