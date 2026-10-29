'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/app/components/AuthGuard'

const CATEGORIES = [
  { key: 'fitness', label: 'Fitness', emoji: '🏃' },
  { key: 'skills', label: 'Skills', emoji: '🎯' },
  { key: 'habits', label: 'Habits', emoji: '📅' },
] as const

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
  const [proofKind, setProofKind] = useState<'video' | 'strava'>('video')
  const [stravaActivity, setStravaActivity] = useState('run')
  const [distanceKm, setDistanceKm] = useState('5')
  const [elevationM, setElevationM] = useState('')
  const [pace, setPace] = useState('')

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
        proofKind: category === 'fitness' ? proofKind : 'video',
        stravaActivity,
        minDistanceM: Math.round(Number(distanceKm) * 1000),
        minElevationM: elevationM.trim() ? Number(elevationM) : null,
        maxPaceSecPerKm: pace.trim().includes(':')
          ? Number(pace.split(':')[0]) * 60 + Number(pace.split(':')[1])
          : pace.trim() ? Math.round(Number(pace) * 60) : null,
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

  const labels = ['Kind', 'Category', 'Details', 'Promise']

  return (
    <AuthGuard>
      <div className="dare-page">
        <div className="max-w-lg mx-auto px-4 py-8">
          <p className="dare-kicker">New dare</p>
          <h1 className="font-display text-4xl mt-2 mb-2" style={{ color: '#fff' }}>Create a dare</h1>
          <p className="text-sm mb-5" style={{ color: '#c4bdd6' }}>
            The person doing it puts in no money. A friend can fund the bounty, or you can pledge solo and a miss goes to charity.
          </p>
          <ol className="flex gap-2 mb-6" aria-label="Steps">
            {labels.map((label, index) => (
              <li key={label} className="flex-1">
                <div className="h-1 rounded-full mb-1" style={{ background: index <= Math.min(step, 3) ? 'linear-gradient(90deg,#b1a6ff,#3dffb0)' : 'rgba(255,255,255,0.08)' }} />
                <span className="text-[11px]" style={{ color: index === step ? '#fff' : '#9d96b4' }}>{label}</span>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => { setMode('funded'); setStep(1) }} className="dare-card dare-card-link p-5 text-left">
                <p className="font-display text-2xl" style={{ color: '#fff' }}>Friend-funded</p>
                <p className="text-sm mt-1" style={{ color: '#c4bdd6' }}>Someone else pays the bounty. Done pays the doer, minus the fee shown at checkout. A miss refunds the funder.</p>
              </button>
              <button type="button" onClick={() => { setMode('solo'); setStep(1) }} className="dare-card dare-card-link p-5 text-left">
                <p className="font-display text-2xl" style={{ color: '#fff' }}>Solo, free or pledged</p>
                <p className="text-sm mt-1" style={{ color: '#c4bdd6' }}>You keep the promise. An optional card pledge comes back if you do it, or is marked for charity if you miss.</p>
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {CATEGORIES.map((item) => (
                  <button type="button" key={item.key} onClick={() => setCategory(item.key)} className="dare-card p-4" style={{ borderColor: category === item.key ? '#b1a6ff' : undefined, boxShadow: category === item.key ? '0 0 0 1px #b1a6ff' : undefined, color: '#fff' }}>
                    <div className="text-2xl" aria-hidden>{item.emoji}</div>
                    <div className="text-sm mt-1">{item.label}</div>
                  </button>
                ))}
              </div>
              {category === 'fitness' && (
                <div className="mb-4 flex flex-col gap-3">
                  <p className="dare-kicker">How is it proved?</p>
                  <button type="button" onClick={() => setProofKind('video')} className="dare-card p-4 text-left" style={{ boxShadow: proofKind === 'video' ? '0 0 0 1px #b1a6ff' : undefined }}>
                    <p className="font-semibold" style={{ color: '#fff' }}>Live camera</p>
                    <p className="text-sm mt-1" style={{ color: '#c4bdd6' }}>Recorded in the app. A code word is shown at the start. Gallery uploads are not accepted.</p>
                  </button>
                  <button type="button" onClick={() => setProofKind('strava')} className="dare-card p-4 text-left" style={{ boxShadow: proofKind === 'strava' ? '0 0 0 1px #b1a6ff' : undefined }}>
                    <p className="font-semibold" style={{ color: '#fff' }}>Strava-verified</p>
                    <p className="text-sm mt-1" style={{ color: '#c4bdd6' }}>A device activity after they accept, before the deadline. Manual entries do not count.</p>
                  </button>
                  {proofKind === 'strava' && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="dare-kicker col-span-2">Activity</label>
                      <select value={stravaActivity} onChange={(event) => setStravaActivity(event.target.value)} className="dare-input col-span-2">
                        <option value="run">Run</option>
                        <option value="ride">Ride</option>
                        <option value="walk">Walk or hike</option>
                        <option value="swim">Swim</option>
                      </select>
                      <label className="dare-kicker col-span-2">Minimum distance (km)</label>
                      <input value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} inputMode="decimal" className="dare-input col-span-2" />
                      <label className="dare-kicker">Optional climb (m)</label>
                      <label className="dare-kicker">Optional pace (min/km)</label>
                      <input value={elevationM} onChange={(event) => setElevationM(event.target.value)} placeholder="none" className="dare-input" />
                      <input value={pace} onChange={(event) => setPace(event.target.value)} placeholder="6:00" className="dare-input" />
                    </div>
                  )}
                </div>
              )}
              <button type="button" disabled={!category} onClick={() => setStep(2)} className="dare-btn w-full py-3">Continue</button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <label className="dare-kicker" htmlFor="dare-title">Title</label>
              <input id="dare-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="100 push-ups" maxLength={80} className="dare-input" />
              <label className="dare-kicker" htmlFor="dare-rules">What counts as done</label>
              <textarea id="dare-rules" value={rules} onChange={(event) => setRules(event.target.value)} placeholder="Be specific." rows={5} className="dare-input" />
              <label className="dare-kicker" htmlFor="dare-frame">How the video should be framed</label>
              <input id="dare-frame" value={framing} onChange={(event) => setFraming(event.target.value)} className="dare-input" />
              <label className="dare-kicker" htmlFor="dare-deadline">Deadline</label>
              <input id="dare-deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="dare-input" />
              <button type="button" disabled={title.trim().length < 3 || rules.trim().length < 10 || !deadline} onClick={() => setStep(3)} className="dare-btn w-full py-3">Continue</button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3">
              {mode === 'funded' ? (
                <>
                  <label className="dare-card flex items-center justify-between p-4">
                    <span className="text-sm" style={{ color: '#fff' }}>I am the one doing it</span>
                    <input type="checkbox" checked={creatorIsDoer} onChange={(event) => setCreatorIsDoer(event.target.checked)} />
                  </label>
                  <p className="text-sm" style={{ color: '#c4bdd6' }}>
                    You do not pay to enter. Share the link and a friend funds the bounty. The minimum is set in config (CHF 20 unless changed). Paid checkout is {paidMode ? 'on, in Stripe test mode only' : 'off until the feature flag is enabled'}.
                  </p>
                  <label className="flex items-center gap-2 text-sm" style={{ color: '#f6f3ff' }}>
                    <input type="checkbox" checked={missToCharity} onChange={(event) => setMissToCharity(event.target.checked)} />
                    If the dare is missed, the bounty goes to charity instead of back to the funder
                  </label>
                  {missToCharity && (
                    <select value={charityId} onChange={(event) => setCharityId(event.target.value)} className="dare-input">
                      {charities.map((charity) => <option key={charity.id} value={charity.id}>{charity.name}</option>)}
                    </select>
                  )}
                </>
              ) : (
                <>
                  <label className="dare-kicker">Charity if you miss</label>
                  <select value={charityId} onChange={(event) => setCharityId(event.target.value)} className="dare-input">
                    {charities.map((charity) => <option key={charity.id} value={charity.id}>{charity.name}</option>)}
                  </select>
                  <p className="dare-kicker">Optional pledge</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1000, 2500, 5000].map((cents) => (
                      <button type="button" key={cents} onClick={() => setPledge(cents)} className={pledge === cents ? 'dare-btn py-3 text-sm' : 'dare-btn-ghost py-3 text-sm'}>
                        {cents === 0 ? 'Free' : `CHF ${cents / 100}`}
                      </button>
                    ))}
                  </div>
                  {pledge > 0 && !paidMode && <p className="text-sm" style={{ color: '#ffb087' }}>Paid mode is off, so this will be saved as a free solo dare. Turn the flag on to take a card pledge.</p>}
                </>
              )}
              {error && <p className="text-sm" role="alert" style={{ color: '#ffb4bc' }}>{error}</p>}
              <button type="button" onClick={publish} disabled={loading} className="dare-btn-mint w-full py-3">
                {loading ? 'Saving…' : 'Create and share'}
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="dare-card text-center p-6">
              <div className="dare-orb" aria-hidden />
              <h2 className="font-display text-3xl mb-2" style={{ color: '#fff' }}>Link is ready</h2>
              <p className="text-sm mb-4" style={{ color: '#c4bdd6' }}>Send this to the person funding it, or to the person who will do it.</p>
              {error && <p className="text-sm mb-3" style={{ color: '#ffb4bc' }}>{error}</p>}
              <div className="flex gap-2 mb-4">
                <input readOnly value={typeof window === 'undefined' ? sharePath : `${window.location.origin}${sharePath}`} className="dare-input flex-1 text-xs" />
                <button type="button" onClick={copy} className="dare-btn px-4 text-sm">{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <button type="button" onClick={() => router.push(sharePath)} className="dare-btn w-full py-3">Open the dare</button>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
