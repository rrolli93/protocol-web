'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import AuthGuard from '@/app/components/AuthGuard'
import StravaMap from '@/app/components/StravaMap'
import { dareProgress } from '@/lib/dare/present'

export default function DarePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [dare, setDare] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState('')
  const [report, setReport] = useState('')
  const [paidMode, setPaidMode] = useState(false)
  const [checking, setChecking] = useState(false)
  const [stravaNote, setStravaNote] = useState('')

  async function load() {
    const response = await fetch(`/api/dares/${id}`)
    if (!response.ok) return
    const body = await response.json()
    setDare(body.dare)
  }

  useEffect(() => {
    if (!id) return
    load()
    fetch('/api/config').then((response) => response.json()).then((body) => setPaidMode(Boolean(body.paidMode))).catch(() => {})
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') setStravaNote('Strava is connected. Check for a matching activity.')
    if (params.get('strava') === 'error') setStravaNote('Strava did not connect. Try again.')
  }, [id])

  async function dispute() {
    const response = await fetch(`/api/dares/${id}/dispute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const body = await response.json()
    setMessage(response.ok ? 'Dispute opened. It is in the review queue.' : body.error)
    if (response.ok) load()
  }

  async function connect() {
    const response = await fetch('/api/connect/onboard', { method: 'POST' })
    const body = await response.json()
    if (!response.ok) {
      setMessage(body.error ?? 'Payout setup is unavailable')
      return
    }
    window.location.href = body.url
  }

  async function checkStrava() {
    setChecking(true)
    setMessage('')
    const response = await fetch(`/api/dares/${id}/strava/check`, { method: 'POST' })
    const body = await response.json()
    setChecking(false)
    if (!response.ok) {
      setMessage(body.error ?? 'Could not check Strava')
      return
    }
    if (body.verified) setMessage('Verified by Strava. A funder can still dispute.')
    else setMessage(`No matching activity yet. Flagged without GPS: ${body.flagged ?? 0}. Rejected: ${body.rejected ?? 0}.`)
    load()
  }

  async function release() {
    const response = await fetch('/api/jobs/release', { method: 'POST' })
    const body = await response.json()
    setMessage(response.ok ? 'Settlement ran. Running it again does not pay twice.' : (body.error ?? 'Could not settle'))
    load()
  }

  if (!dare) {
    return <AuthGuard><div className="dare-page" /></AuthGuard>
  }

  const viewer = dare.viewer as { isDoer: boolean; isFunder: boolean; isAdmin: boolean }
  const proofs = (dare.proofs as Array<Record<string, unknown>>) ?? []
  const fundings = (dare.fundings as Array<{ funderId: string; status: string }> | undefined) ?? []
  const funderCount = new Set(fundings.filter((row) => row.status !== 'refunded').map((row) => row.funderId)).size
  const progress = dareProgress(String(dare.status))
  const deadline = new Date(String(dare.deadlineAt ?? ''))
  const deadlineLabel = Number.isNaN(deadline.getTime()) ? '—' : deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const bountyLabel = Number(dare.bountyCents) ? `CHF ${(Number(dare.bountyCents) / 100).toFixed(0)}` : 'Open'

  return (
    <AuthGuard>
      <div className="dare-page">
        <div className="max-w-lg mx-auto px-4 py-8">
          <p className="dare-kicker">{String(dare.mode)} · {String(dare.category ?? 'dare')}</p>
          <h1 className="font-display text-4xl mt-2 mb-3" style={{ color: '#fff' }}>{String(dare.title)}</h1>
          <p className="text-sm mb-5" style={{ color: '#c4bdd6' }}>{String(dare.rules)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              ['Bounty', bountyLabel],
              ['Deadline', deadlineLabel],
              ['Funders', String(funderCount)],
              ['Progress', `${progress}%`],
            ].map(([label, value]) => (
              <div key={label} className="dare-card p-3">
                <p className="text-[11px] uppercase tracking-wider" style={{ color: '#9d96b4' }}>{label}</p>
                <p className="text-sm mt-1 font-medium" style={{ color: '#fff' }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="dare-bar mb-5" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Dare progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm mb-4" style={{ color: '#7dffe0' }}>
            {paidMode ? 'Paid mode is on, test keys only.' : 'Paid mode is off.'}
          </p>
          {String(dare.proofKind) === 'strava' && Boolean(dare.strava) ? (
            <section className="dare-card p-4 mb-5">
              <p className="dare-kicker">Strava-verified</p>
              <p className="text-sm mt-2" style={{ color: '#c4bdd6' }}>
                {String((dare.strava as { activity: string }).activity)} · at least {Math.round(Number((dare.strava as { minDistanceM: number }).minDistanceM) / 100) / 10} km
                {(dare.strava as { minElevationM: number | null }).minElevationM ? ` · climb ${(dare.strava as { minElevationM: number }).minElevationM} m` : ''}
              </p>
              {stravaNote && <p className="text-sm mt-2" style={{ color: '#fff' }}>{stravaNote}</p>}
              {viewer.isDoer && dare.status === 'accepted' && (
                <div className="flex flex-col gap-2 mt-3">
                  <a href={`/api/strava/start?next=${encodeURIComponent(`/dare/${id}`)}`} className="dare-btn-ghost py-3 text-center text-sm">Connect Strava</a>
                  <button type="button" onClick={checkStrava} disabled={checking} className="dare-btn py-3 text-sm">{checking ? 'Checking…' : 'Check Strava'}</button>
                </div>
              )}
              {(proofs as Array<Record<string, unknown>>).filter((proof) => proof.kind === 'strava').map((proof) => (
                <div key={String(proof.id)} className="mt-4">
                  <p className="dare-status">verified by Strava</p>
                  <p className="font-display text-xl mt-2" style={{ color: '#fff' }}>{String(proof.stravaName ?? 'Activity')}</p>
                  <p className="text-sm mt-1" style={{ color: '#c4bdd6' }}>
                    {(Number(proof.stravaDistanceM) / 1000).toFixed(2)} km · {Math.round(Number(proof.stravaMovingTimeS) / 60)} min
                    {proof.stravaDeviceName ? ` · ${String(proof.stravaDeviceName)}` : ''}
                  </p>
                  {proof.aiRationale ? <p className="text-xs mt-2" style={{ color: '#c4bdd6' }}>{String(proof.aiRationale)}</p> : null}
                  <div className="mt-3">
                    <StravaMap polyline={proof.stravaPolyline ? String(proof.stravaPolyline) : null} />
                  </div>
                </div>
              ))}
            </section>
          ) : null}
          {message && <p className="text-sm mb-3" style={{ color: '#ffb087' }}>{message}</p>}
          <div className="flex flex-col gap-2 mb-6">
            {viewer.isDoer && dare.status === 'accepted' && dare.proofKind !== 'strava' && (
              <Link href={`/dare/${id}/proof`} className="dare-btn w-full py-3">Record proof</Link>
            )}
            {viewer.isDoer && (dare.status === 'completed' || dare.status === 'paid_out') && dare.mode === 'funded' && (
              <button type="button" onClick={connect} className="dare-btn-ghost w-full py-3">Set up payout</button>
            )}
            {viewer.isFunder && dare.status === 'completed' && (
              <div className="dare-card p-3">
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why should this be reviewed?" className="dare-input w-full mb-2" />
                <button type="button" onClick={dispute} className="dare-btn-ghost w-full py-2 text-sm" style={{ color: '#ffb4bc' }}>Dispute within the window</button>
              </div>
            )}
            {viewer.isAdmin && <button type="button" onClick={release} className="dare-btn-ghost w-full py-3 text-sm">Run payout / refund job</button>}
            {viewer.isAdmin && (
              <button type="button" onClick={async () => {
                const response = await fetch(`/api/dares/${id}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Admin cancelled this dare' }) })
                const body = await response.json()
                setMessage(response.ok ? `Cancelled (${body.status})` : (body.error ?? 'Could not cancel'))
                load()
              }} className="dare-btn-ghost w-full py-3 text-sm" style={{ color: '#ffb4bc' }}>Cancel and refund</button>
            )}
            <div className="dare-card p-3">
              <label className="dare-kicker" htmlFor="report-reason">Report</label>
              <textarea id="report-reason" value={report} onChange={(event) => setReport(event.target.value)} placeholder="What is wrong with this dare?" className="dare-input w-full mb-2 mt-2" />
              <button type="button" onClick={async () => {
                const response = await fetch(`/api/dares/${id}/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: report }) })
                const body = await response.json()
                setMessage(response.ok ? 'Report received.' : (body.error ?? 'Could not report'))
              }} className="dare-btn-ghost w-full py-2 text-sm">Report</button>
            </div>
            <Link href={`/dare/${id}/invite`} className="text-center text-sm py-2" style={{ color: '#d7d1ff' }}>Share link</Link>
          </div>
          {proofs.length > 0 && (
            <div className="dare-card p-4">
              <h2 className="dare-kicker mb-2">Proof</h2>
              {proofs.map((proof) => (
                <div key={String(proof.id)} className="text-sm mb-2" style={{ color: '#fff' }}>
                  <p>{String(proof.aiVerdict ?? 'pending')} · {String(proof.reviewStatus)}</p>
                  {proof.aiRationale ? <p className="text-xs mt-1" style={{ color: '#c4bdd6' }}>{String(proof.aiRationale)}</p> : null}
                  <video className="mt-2 w-full rounded-lg" controls src={`/api/proofs/${proof.id}/media`} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
