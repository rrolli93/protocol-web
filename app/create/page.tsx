'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/app/components/AuthGuard'

const CATEGORIES = [
  { key: 'fitness', label: 'Fitness', emoji: '🏃' },
  { key: 'skills', label: 'Skills', emoji: '🎯' },
  { key: 'habits', label: 'Habits', emoji: '📅' },
] as const

const mono = { fontFamily: "'JetBrains Mono', monospace" }

export default function CreatePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<'funded' | 'solo'>('funded')
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [rules, setRules] = useState('')
  const [framing, setFraming] = useState('Full body in frame, one continuous take')
  const [creatorIsDoer, setCreatorIsDoer] = useState(true)
  const [deadline, setDeadline] = useState('')
  const [charityId, setCharityId] = useState('')
  const [missToCharity, setMissToCharity] = useState(false)
  const [charities, setCharities] = useState<Array<{ id: string; name: string }>>([])
  const [pledge, setPledge] = useState(0)
  const [paidMode, setPaidMode] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sharePath, setSharePath] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const when = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const local = new Date(when.getTime() - when.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setDeadline(local)
    fetch('/api/config').then((response) => response.json()).then((body) => setPaidMode(Boolean(body.paidMode))).catch(() => {})
    fetch('/api/charities').then((response) => response.json()).then((body) => {
      setCharities(body.charities ?? [])
      if (body.charities?.[0]) setCharityId(body.charities[0].id)
    }).catch(() => {})
  }, [])

  async function publish() {
    setLoading(true)
    setError('')
    const response = await fetch('/api/dares', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        rules,
        category,
        mode,
        deadlineAt: new Date(deadline).toISOString(),
        framing,
        creatorIsDoer: mode === 'funded' ? creatorIsDoer : true,
        charityId: mode === 'solo' || missToCharity ? charityId : null,
        failOutcome: mode === 'funded' && missToCharity ? 'charity' : 'refund',
        pledgeCents: mode === 'solo' && pledge > 0 ? pledge : null,
      }),
    })
    const body = await response.json()
    setLoading(false)
    if (!response.ok) {
      setError(body.error ?? 'Could not create the dare')
      return
    }
    if (mode === 'solo' && pledge > 0 && paidMode) {
      const checkout = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dareId: body.dare.id, amountCents: pledge }),
      })
      const session = await checkout.json()
      if (!checkout.ok) {
        setError(session.error ?? 'Dare created, but the pledge checkout failed')
        setSharePath(body.sharePath)
        setStep(4)
        return
      }
      window.location.href = session.url
      return
    }
    setSharePath(body.sharePath)
    setStep(4)
  }

  function copy() {
    const url = `${window.location.origin}${sharePath}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-lg mx-auto px-4 py-6">
          <h1 className="text-xl font-bold mb-1" style={{ color: '#ffffff', ...mono }}>Create a dare</h1>
          <p className="text-sm mb-6" style={{ color: '#8888AA' }}>
            The person doing it puts in no money. A friend can fund the bounty, or you can pledge solo and a miss goes to charity.
          </p>

          {step === 0 && (
            <div className="flex flex-col gap-3">
              <button onClick={() => { setMode('funded'); setStep(1) }} className="rounded-xl border p-4 text-left" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
                <p className="font-semibold" style={{ color: '#ffffff', ...mono }}>Friend-funded</p>
                <p className="text-sm mt-1" style={{ color: '#8888AA' }}>Someone else pays CHF 10–100. Done pays the doer minus 10%. Missed refunds the funder.</p>
              </button>
              <button onClick={() => { setMode('solo'); setStep(1) }} className="rounded-xl border p-4 text-left" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
                <p className="font-semibold" style={{ color: '#ffffff', ...mono }}>Solo, free or pledged</p>
                <p className="text-sm mt-1" style={{ color: '#8888AA' }}>You keep the promise. An optional card pledge comes back if you do it, or is marked for charity if you miss.</p>
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {CATEGORIES.map((item) => (
                  <button key={item.key} onClick={() => setCategory(item.key)} className="rounded-xl border p-4" style={{ backgroundColor: category === item.key ? 'rgba(108,99,255,0.15)' : '#0D0D1A', borderColor: category === item.key ? '#6C63FF' : '#1A1A2E', color: '#ffffff' }}>
                    <div className="text-2xl">{item.emoji}</div>
                    <div className="text-sm mt-1" style={mono}>{item.label}</div>
                  </button>
                ))}
              </div>
              <button disabled={!category} onClick={() => setStep(2)} className="w-full py-3 rounded-xl font-semibold disabled:opacity-40" style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}>Continue</button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="100 push-ups" maxLength={80} className="px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E', color: '#ffffff' }} />
              <textarea value={rules} onChange={(event) => setRules(event.target.value)} placeholder="What counts as done? Be specific." rows={5} className="px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E', color: '#ffffff' }} />
              <input value={framing} onChange={(event) => setFraming(event.target.value)} placeholder="How the video should be framed" className="px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E', color: '#ffffff' }} />
              <label className="text-xs" style={{ color: '#8888AA', ...mono }}>DEADLINE</label>
              <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E', color: '#ffffff' }} />
              <button disabled={title.trim().length < 3 || rules.trim().length < 10 || !deadline} onClick={() => setStep(3)} className="w-full py-3 rounded-xl font-semibold disabled:opacity-40" style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}>Continue</button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3">
              {mode === 'funded' ? (
                <>
                  <label className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: '#1A1A2E' }}>
                    <span className="text-sm" style={{ color: '#ffffff' }}>I am the one doing it</span>
                    <input type="checkbox" checked={creatorIsDoer} onChange={(event) => setCreatorIsDoer(event.target.checked)} />
                  </label>
                  <p className="text-sm" style={{ color: '#8888AA' }}>
                    You do not pay to enter. Share the link and a friend funds the bounty. The minimum is set in config (CHF 20 unless changed). Paid checkout is {paidMode ? 'on, in Stripe test mode only' : 'off until the feature flag is enabled'}.
                  </p>
                  <label className="flex items-center gap-2 text-sm" style={{ color: '#ffffff' }}>
                    <input type="checkbox" checked={missToCharity} onChange={(event) => setMissToCharity(event.target.checked)} />
                    If the dare is missed, the bounty goes to charity instead of back to the funder
                  </label>
                  {missToCharity && (
                    <select value={charityId} onChange={(event) => setCharityId(event.target.value)} className="px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E', color: '#ffffff' }}>
                      {charities.map((charity) => <option key={charity.id} value={charity.id}>{charity.name}</option>)}
                    </select>
                  )}
                </>
              ) : (
                <>
                  <label className="text-xs" style={{ color: '#8888AA', ...mono }}>CHARITY IF YOU MISS</label>
                  <select value={charityId} onChange={(event) => setCharityId(event.target.value)} className="px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E', color: '#ffffff' }}>
                    {charities.map((charity) => <option key={charity.id} value={charity.id}>{charity.name}</option>)}
                  </select>
                  <label className="text-xs" style={{ color: '#8888AA', ...mono }}>OPTIONAL PLEDGE</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1000, 2500, 5000].map((cents) => (
                      <button key={cents} onClick={() => setPledge(cents)} className="py-3 rounded-lg text-sm" style={{ backgroundColor: pledge === cents ? '#6C63FF' : '#0D0D1A', color: '#ffffff', ...mono }}>
                        {cents === 0 ? 'Free' : `CHF ${cents / 100}`}
                      </button>
                    ))}
                  </div>
                  {pledge > 0 && !paidMode && <p className="text-sm" style={{ color: '#FF8C42' }}>Paid mode is off, so this will be saved as a free solo dare. Turn the flag on to take a card pledge.</p>}
                </>
              )}
              {error && <p className="text-sm" style={{ color: '#FF4757' }}>{error}</p>}
              <button onClick={publish} disabled={loading} className="w-full py-3 rounded-xl font-semibold disabled:opacity-40" style={{ backgroundColor: '#00FF87', color: '#0A0A0F', ...mono }}>
                {loading ? 'Saving…' : 'Create and share'}
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#ffffff', ...mono }}>Link is ready</h2>
              <p className="text-sm mb-4" style={{ color: '#8888AA' }}>Send this to the person funding it, or to the person who will do it.</p>
              {error && <p className="text-sm mb-3" style={{ color: '#FF4757' }}>{error}</p>}
              <div className="flex gap-2 mb-4">
                <input readOnly value={typeof window === 'undefined' ? sharePath : `${window.location.origin}${sharePath}`} className="flex-1 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#0D0D1A', color: '#8888AA', border: '1px solid #1A1A2E' }} />
                <button onClick={copy} className="px-4 rounded-lg text-sm" style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <button onClick={() => router.push(sharePath)} className="w-full py-3 rounded-xl font-semibold" style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}>Open the dare</button>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
