'use client'

import { useEffect, useState } from 'react'
import AuthGuard from '@/app/components/AuthGuard'

interface QueueRow {
  proof: { id: string; aiVerdict: string | null; aiRationale: string | null; aiConfidence: number | null; durationS: number }
  dare: { id: string; title: string; rules: string; deadlineAt: string } | null
}

export default function ReviewPage() {
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [error, setError] = useState('')

  async function load() {
    const response = await fetch('/api/review')
    const body = await response.json()
    if (!response.ok) {
      setError(body.error === 'forbidden' ? 'Only an admin can open the queue.' : body.error)
      setQueue([])
      return
    }
    setError('')
    setQueue(body.queue ?? [])
  }

  useEffect(() => { load() }, [])

  async function act(id: string, action: 'approve' | 'reject' | 'retake') {
    const response = await fetch(`/api/review/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const body = await response.json()
    if (!response.ok) setError(body.error ?? 'Action failed')
    await load()
  }

  return (
    <AuthGuard>
          <div className="dare-page">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <p className="dare-kicker">Admin</p>
          <h1 className="font-display text-4xl mt-2 mb-5" style={{ color: '#fff' }}>Review queue</h1>
          {error && <p className="text-sm mb-4" style={{ color: '#ffb087' }}>{error}</p>}
          {queue.length === 0 && !error && (
            <div className="dare-card dare-empty">
              <div className="dare-orb" aria-hidden />
              <h2 className="font-display text-3xl" style={{ color: '#fff' }}>Nothing is waiting.</h2>
              <p className="text-sm mt-2" style={{ color: '#c4bdd6' }}>Proofs that need a person show up here.</p>
            </div>
          )}
          {queue.map((row) => (
            <article key={row.proof.id} className="dare-card p-5 mb-4">
              <h2 className="font-display text-2xl mb-1" style={{ color: '#fff' }}>{row.dare?.title ?? 'Dare'}</h2>
              <p className="text-sm mb-2" style={{ color: '#c4bdd6' }}>{row.dare?.rules}</p>
              <p className="text-xs mb-2 dare-kicker">
                AI {row.proof.aiVerdict ?? 'n/a'} {row.proof.aiConfidence ?? ''} — {row.proof.aiRationale}
              </p>
              <video controls className="w-full rounded-xl mb-3" src={`/api/proofs/${row.proof.id}/media`} />
              <div className="flex gap-2">
                <button type="button" onClick={() => act(row.proof.id, 'approve')} className="dare-btn-mint flex-1 py-2 text-sm">Approve</button>
                <button type="button" onClick={() => act(row.proof.id, 'retake')} className="dare-btn-ghost flex-1 py-2 text-sm">Retake</button>
                <button type="button" onClick={() => act(row.proof.id, 'reject')} className="dare-btn-ghost flex-1 py-2 text-sm" style={{ color: '#ffb4bc' }}>Reject</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AuthGuard>
  )
}
