'use client'

import { useEffect, useState } from 'react'
import AuthGuard from '@/app/components/AuthGuard'

const mono = { fontFamily: "'JetBrains Mono', monospace" }

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
      <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-xl font-bold mb-4" style={{ color: '#ffffff', ...mono }}>Review queue</h1>
          {error && <p className="text-sm mb-4" style={{ color: '#FF8C42' }}>{error}</p>}
          {queue.length === 0 && !error && <p className="text-sm" style={{ color: '#8888AA' }}>Nothing is waiting.</p>}
          {queue.map((row) => (
            <article key={row.proof.id} className="rounded-xl border p-4 mb-4" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
              <h2 className="font-semibold mb-1" style={{ color: '#ffffff', ...mono }}>{row.dare?.title ?? 'Dare'}</h2>
              <p className="text-sm mb-2" style={{ color: '#8888AA' }}>{row.dare?.rules}</p>
              <p className="text-xs mb-2" style={{ color: '#6C63FF', ...mono }}>
                AI {row.proof.aiVerdict ?? 'n/a'} {row.proof.aiConfidence ?? ''} — {row.proof.aiRationale}
              </p>
              <video controls className="w-full rounded-lg mb-3" src={`/api/proofs/${row.proof.id}/media`} />
              <div className="flex gap-2">
                <button onClick={() => act(row.proof.id, 'approve')} className="flex-1 py-2 rounded-lg text-sm" style={{ backgroundColor: '#00FF87', color: '#0A0A0F', ...mono }}>Approve</button>
                <button onClick={() => act(row.proof.id, 'retake')} className="flex-1 py-2 rounded-lg text-sm" style={{ backgroundColor: '#1A1A2E', color: '#ffffff', ...mono }}>Retake</button>
                <button onClick={() => act(row.proof.id, 'reject')} className="flex-1 py-2 rounded-lg text-sm" style={{ backgroundColor: '#FF4757', color: '#ffffff', ...mono }}>Reject</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AuthGuard>
  )
}
