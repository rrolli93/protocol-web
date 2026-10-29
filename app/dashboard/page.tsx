'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AuthGuard from '@/app/components/AuthGuard'
import DareCard, { type DareCardData } from '@/app/components/DareCard'

export default function DashboardPage() {
  const [handle, setHandle] = useState('friend')
  const [dares, setDares] = useState<DareCardData[]>([])
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
      <div className="dare-page">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="dare-kicker">Your dares</p>
              <h1 className="font-display text-3xl md:text-4xl mt-2" style={{ color: '#fff' }}>Hello, {handle}</h1>
              <p className="text-sm mt-2" style={{ color: '#c4bdd6' }}>Dares you created, do, or fund. The doer never puts money in.</p>
            </div>
            <Link href="/create" className="dare-btn px-4 py-2 text-sm shrink-0">Create</Link>
          </div>
          {error && <p className="text-sm mb-4" style={{ color: '#ffb087' }}>{error}</p>}
          {dares.length === 0 && !error && (
            <div className="dare-card dare-empty">
              <div className="dare-orb" aria-hidden />
              <h2 className="font-display text-3xl" style={{ color: '#fff' }}>No dares yet.</h2>
              <p className="text-sm mt-2 max-w-sm mx-auto" style={{ color: '#c4bdd6' }}>
                Dare a friend for a good cause. They do the challenge. A friend can fund it. The doer never puts money in.
              </p>
              <Link href="/create" className="dare-btn mt-6 px-5 py-3 text-sm">Create a dare</Link>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {dares.map((dare) => <DareCard key={dare.id} dare={dare} />)}
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
