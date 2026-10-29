'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AuthGuard from '@/app/components/AuthGuard'

interface DareRow {
  id: string
  title: string
  status: string
  mode: string
  deadlineAt: string
}

const mono = { fontFamily: "'JetBrains Mono', monospace" }

export default function DashboardPage() {
  const [handle, setHandle] = useState('friend')
  const [dares, setDares] = useState<DareRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/me').then(async (response) => {
      if (!response.ok) {
        setError('Sign in to see your dares.')
        return
      }
      const body = await response.json()
      setHandle(body.user?.handle ?? 'friend')
      setDares(body.dares ?? [])
    }).catch(() => setError('Could not load dares.'))
  }, [])

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#ffffff', ...mono }}>Hello, {handle}</h1>
              <p className="text-sm mt-1" style={{ color: '#8888AA' }}>Dares you created, do, or fund. The doer never puts money in.</p>
            </div>
            <Link href="/create" className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}>Create</Link>
          </div>
          {error && <p className="text-sm mb-4" style={{ color: '#FF8C42' }}>{error}</p>}
          {dares.length === 0 && !error && <p className="text-sm" style={{ color: '#8888AA' }}>No dares yet.</p>}
          <div className="flex flex-col gap-3">
            {dares.map((dare) => (
              <Link key={dare.id} href={`/dare/${dare.id}`} className="rounded-xl border p-4" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
                <p className="font-semibold" style={{ color: '#ffffff', ...mono }}>{dare.title}</p>
                <p className="text-xs mt-1" style={{ color: '#8888AA', ...mono }}>{dare.mode} · {dare.status}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
