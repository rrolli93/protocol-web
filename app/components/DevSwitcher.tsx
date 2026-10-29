'use client'

import { useEffect, useState } from 'react'

export default function DevSwitcher() {
  const [enabled, setEnabled] = useState(false)
  const [demo, setDemo] = useState(false)
  const [handle, setHandle] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const config = await fetch('/api/config').then((response) => response.json()).catch(() => null)
      if ((!config?.devStore && !config?.simulatedPayments) || cancelled) return
      setEnabled(true)
      setDemo(Boolean(config.devStore))
      const me = await fetch('/api/me')
      if (!me.ok || cancelled) return
      const body = await me.json()
      setHandle(body.user?.handle ?? null)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!enabled) return null

  async function pick(persona: string) {
    await fetch('/api/dev/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ persona }),
    })
    window.location.reload()
  }

  return (
    <div className="px-4 py-2 text-xs flex flex-wrap items-center gap-2" style={{ backgroundColor: '#141422', color: '#8888AA' }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {demo ? `Demo — no Supabase account connected. Data stays in this session.${handle ? ` Signed in as ${handle}.` : ''}` : 'Stripe is not configured. Checkout is simulated and does not charge a card.'}
      </span>
      {demo && (['doer', 'funder', 'admin'] as const).map((persona) => (
        <button key={persona} onClick={() => pick(persona)} className="px-2 py-1 rounded" style={{ backgroundColor: '#1A1A2E', color: '#ffffff' }}>
          {persona}
        </button>
      ))}
    </div>
  )
}
