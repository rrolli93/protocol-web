'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import AuthGuard from '@/app/components/AuthGuard'

const mono = { fontFamily: "'JetBrains Mono', monospace" }

export default function DarePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [dare, setDare] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState('')
  const [paidMode, setPaidMode] = useState(false)

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

  async function release() {
    const response = await fetch('/api/jobs/release', { method: 'POST' })
    const body = await response.json()
    setMessage(response.ok ? 'Settlement ran. Running it again does not pay twice.' : (body.error ?? 'Could not settle'))
    load()
  }

  if (!dare) {
    return <AuthGuard><div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }} /></AuthGuard>
  }

  const viewer = dare.viewer as { isDoer: boolean; isFunder: boolean; isAdmin: boolean }
  const proofs = (dare.proofs as Array<Record<string, unknown>>) ?? []

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-lg mx-auto px-4 py-6">
          <p className="text-xs mb-2" style={{ color: '#6C63FF', ...mono }}>{String(dare.status).toUpperCase()} · {String(dare.mode)}</p>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#ffffff', ...mono }}>{String(dare.title)}</h1>
          <p className="text-sm mb-4" style={{ color: '#8888AA' }}>{String(dare.rules)}</p>
          <p className="text-sm mb-4" style={{ color: '#00FF87', ...mono }}>
            Bounty {Number(dare.bountyCents) ? `CHF ${(Number(dare.bountyCents) / 100).toFixed(2)}` : 'not funded yet'}
            {paidMode ? '' : ' · paid mode off'}
          </p>
          {message && <p className="text-sm mb-3" style={{ color: '#FF8C42' }}>{message}</p>}
          <div className="flex flex-col gap-2 mb-6">
            {viewer.isDoer && dare.status === 'accepted' && (
              <Link href={`/dare/${id}/proof`} className="w-full py-3 rounded-xl text-center font-semibold" style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}>Record proof</Link>
            )}
            {viewer.isDoer && (dare.status === 'completed' || dare.status === 'paid_out') && dare.mode === 'funded' && (
              <button onClick={connect} className="w-full py-3 rounded-xl font-semibold" style={{ backgroundColor: '#0D0D1A', color: '#ffffff', border: '1px solid #1A1A2E', ...mono }}>Set up payout</button>
            )}
            {viewer.isFunder && dare.status === 'completed' && (
              <div className="rounded-xl border p-3" style={{ borderColor: '#1A1A2E' }}>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why should this be reviewed?" className="w-full mb-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#0D0D1A', color: '#ffffff' }} />
                <button onClick={dispute} className="w-full py-2 rounded-lg text-sm" style={{ backgroundColor: '#FF4757', color: '#ffffff', ...mono }}>Dispute within the window</button>
              </div>
            )}
            {viewer.isAdmin && <button onClick={release} className="w-full py-3 rounded-xl text-sm" style={{ backgroundColor: '#1A1A2E', color: '#ffffff', ...mono }}>Run payout / refund job</button>}
            <Link href={`/dare/${id}/invite`} className="text-center text-sm" style={{ color: '#6C63FF' }}>Share link</Link>
          </div>
          {proofs.length > 0 && (
            <div className="rounded-xl border p-4" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
              <h2 className="text-xs mb-2" style={{ color: '#8888AA', ...mono }}>PROOF</h2>
              {proofs.map((proof) => (
                <div key={String(proof.id)} className="text-sm mb-2" style={{ color: '#ffffff' }}>
                  <p>{String(proof.aiVerdict ?? 'pending')} · {String(proof.reviewStatus)}</p>
                  {proof.aiRationale ? <p className="text-xs mt-1" style={{ color: '#8888AA' }}>{String(proof.aiRationale)}</p> : null}
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
