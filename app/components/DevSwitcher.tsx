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
    <div className="dare-testbar">
      <span className="dare-pill">Test mode</span>
      <span>
        {demo
          ? `Demo data stays in this browser.${handle ? ` Signed in as ${handle}.` : ''}`
          : 'Checkout is simulated and does not charge a card.'}
      </span>
      {demo && (['doer', 'funder', 'admin'] as const).map((persona) => (
        <button key={persona} type="button" onClick={() => pick(persona)} className="dare-chip">
          {persona}
        </button>
      ))}
    </div>
  )
}
