'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeNextPath } from '@/lib/dare/auth-google'

function WelcomeForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const [handle, setHandle] = useState('')
  const [dob, setDob] = useState('')
  const [ageOk, setAgeOk] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/me').then(async (response) => {
      if (!response.ok) {
        router.replace(`/login?next=${encodeURIComponent(next)}`)
        return
      }
      const body = await response.json()
      setHandle(body.user?.handle ?? '')
      if (body.user?.ageConfirmed) router.replace(next)
    }).catch(() => {})
  }, [next, router])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!ageOk || !dob) {
      setError('Confirm you are 18 or older and enter your date of birth.')
      return
    }
    const response = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle, displayName: handle, dob, ageConfirmed: true }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(body.error ?? 'Could not save your profile')
      return
    }
    router.replace(next)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0F' }}>
      <form onSubmit={save} className="w-full max-w-sm rounded-xl border p-6" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
        <p className="text-xs mb-2" style={{ color: '#6C63FF', fontFamily: "'JetBrains Mono', monospace" }}>DARE</p>
        <h1 className="text-xl font-bold mb-2" style={{ color: '#ffffff' }}>Finish your profile</h1>
        <p className="text-sm mb-4" style={{ color: '#8888AA' }}>Google signed you in. Pick a name and confirm you are 18 or older. Then we will take you back.</p>
        <label className="block text-xs mb-1" style={{ color: '#8888AA' }} htmlFor="welcome-handle">NAME</label>
        <input id="welcome-handle" aria-label="Name" value={handle} onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/\s/g, ''))} required minLength={3} className="w-full mb-3 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#0A0A0F', color: '#ffffff', border: '1px solid #1A1A2E' }} />
        <label className="block text-xs mb-1" style={{ color: '#8888AA' }} htmlFor="welcome-dob">DATE OF BIRTH</label>
        <input id="welcome-dob" aria-label="Date of birth" type="date" value={dob} onChange={(event) => setDob(event.target.value)} required className="w-full mb-3 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#0A0A0F', color: '#ffffff', border: '1px solid #1A1A2E' }} />
        <label className="flex items-start gap-2 text-sm mb-4" style={{ color: '#cccccc' }}>
          <input type="checkbox" checked={ageOk} onChange={(event) => setAgeOk(event.target.checked)} className="mt-1" />
          I confirm I am 18 or older.
        </label>
        {error && <p className="text-sm mb-3" style={{ color: '#FF4757' }}>{error}</p>}
        <button className="w-full py-3 rounded-lg font-semibold" style={{ backgroundColor: '#6C63FF', color: '#ffffff' }}>Continue</button>
      </form>
    </main>
  )
}

export default function WelcomePage() {
  return <Suspense><WelcomeForm /></Suspense>
}
