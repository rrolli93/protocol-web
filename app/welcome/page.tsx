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
    <main className="dare-page flex items-center justify-center px-4 py-12">
      <form onSubmit={save} className="dare-card w-full max-w-sm p-6">
        <p className="dare-kicker mb-2">DARE</p>
        <h1 className="font-display text-3xl mb-2" style={{ color: '#fff' }}>Finish your profile</h1>
        <p className="text-sm mb-4" style={{ color: '#c4bdd6' }}>Google signed you in. Pick a name and confirm you are 18 or older. Then we will take you back.</p>
        <label className="dare-kicker block mb-1" htmlFor="welcome-handle">Name</label>
        <input id="welcome-handle" aria-label="Name" value={handle} onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/\s/g, ''))} required minLength={3} className="dare-input mb-3" />
        <label className="dare-kicker block mb-1" htmlFor="welcome-dob">Date of birth</label>
        <input id="welcome-dob" aria-label="Date of birth" type="date" value={dob} onChange={(event) => setDob(event.target.value)} required className="dare-input mb-3" />
        <label className="flex items-start gap-2 text-sm mb-4" style={{ color: '#e7e2f4' }}>
          <input type="checkbox" checked={ageOk} onChange={(event) => setAgeOk(event.target.checked)} className="mt-1" />
          I confirm I am 18 or older.
        </label>
        {error && <p className="text-sm mb-3" style={{ color: '#ffb4bc' }}>{error}</p>}
        <button className="dare-btn w-full py-3">Continue</button>
      </form>
    </main>
  )
}

export default function WelcomePage() {
  return <Suspense><WelcomeForm /></Suspense>
}
