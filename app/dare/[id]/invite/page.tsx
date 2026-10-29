'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { priceBounty, type FeeConfig } from '@/lib/dare/money'
import CryptoRail from '@/app/components/CryptoRail'
import type { FailOutcome } from '@/lib/dare/types'

const mono = { fontFamily: "'JetBrains Mono', monospace" }

export default function InvitePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [dare, setDare] = useState<Record<string, unknown> | null>(null)
  const [missing, setMissing] = useState(false)
  const [paidMode, setPaidMode] = useState(false)
  const [simulated, setSimulated] = useState(false)
  const [cryptoRail, setCryptoRail] = useState(false)
  const [escrowAddress, setEscrowAddress] = useState<string | null>(null)
  const [fees, setFees] = useState<FeeConfig | null>(null)
  const [failOutcome, setFailOutcome] = useState<FailOutcome>('refund')
  const [amount, setAmount] = useState(2500)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    const response = await fetch(`/api/dares/${id}`)
    if (!response.ok) {
      setMissing(true)
      return
    }
    const body = await response.json()
    setDare(body.dare)
    if (body.dare?.failOutcome === 'charity') setFailOutcome('charity')
  }

  useEffect(() => {
    if (!id) return
    load()
    fetch('/api/config').then((response) => response.json()).then((body) => {
      setPaidMode(Boolean(body.paidMode))
      setSimulated(Boolean(body.simulatedPayments))
      setCryptoRail(Boolean(body.cryptoRail))
      setEscrowAddress(body.escrowAddress ?? null)
      if (body.fees) {
        setFees(body.fees)
        setAmount(body.fees.minBountyCents ?? 2000)
      }
    }).catch(() => {})
  }, [id])

  async function accept() {
    setBusy(true)
    setMessage('')
    const response = await fetch(`/api/dares/${id}/accept`, { method: 'POST' })
    const body = await response.json()
    setBusy(false)
    if (response.status === 401) {
      window.location.href = `/login?next=${encodeURIComponent(`/dare/${id}/invite`)}`
      return
    }
    if (!response.ok) {
      setMessage(body.error ?? 'Could not accept')
      return
    }
    setDare(body.dare)
  }

  async function fund() {
    setBusy(true)
    setMessage('')
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dareId: id, amountCents: amount, failOutcome }),
    })
    const body = await response.json()
    setBusy(false)
    if (response.status === 401) {
      window.location.href = `/login?next=${encodeURIComponent(`/dare/${id}/invite`)}`
      return
    }
    if (!response.ok) {
      setMessage(body.error ?? 'Checkout failed')
      return
    }
    window.location.href = body.url
  }

  function copy() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (missing) {
    return <main className="min-h-screen px-4 py-16 text-center" style={{ backgroundColor: '#0A0A0F', color: '#ffffff' }}>Dare not found.</main>
  }
  if (!dare) {
    return <main className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }} />
  }

  const viewer = dare.viewer as { isDoer: boolean; isFunder: boolean }
  const bounty = Number(dare.bountyCents ?? 0)

  return (
    <main className="dare-page px-4 py-10">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="font-display text-lg font-extrabold" style={{ color: '#fff' }}>DARE</Link>
        <p className="dare-kicker mt-6">Dare a friend for a good cause</p>
        <h1 className="font-display text-4xl mt-2 mb-3" style={{ color: '#fff' }}>{String(dare.title)}</h1>
        <p className="text-sm mb-5" style={{ color: '#c4bdd6' }}>{String(dare.rules)}</p>
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          {[
            ['BOUNTY', bounty ? `CHF ${(bounty / 100).toFixed(0)}` : 'Open'],
            ['STATUS', String(dare.status)],
            ['MODE', String(dare.mode)],
          ].map(([label, value]) => (
            <div key={label} className="dare-card p-3">
              <p className="text-sm" style={{ color: '#ffffff', ...mono }}>{value}</p>
              <p className="text-xs mt-1" style={{ color: '#8888AA', ...mono }}>{label}</p>
            </div>
          ))}
        </div>
        <div className="dare-card p-4 mb-4">
          <p className="text-sm" style={{ color: '#ffffff' }}>The doer never pays.</p>
          <p className="text-xs mt-2" style={{ color: '#8888AA' }}>A funder pays the bounty. The doer puts in nothing. There is no shared pool, and nobody is paid if the doer misses.</p>
        </div>
        {message && <p className="text-sm mb-3" style={{ color: '#FF8C42' }}>{message}</p>}
        {dare.mode === 'funded' && dare.status === 'open' && !viewer.isDoer && (
          <button onClick={accept} disabled={busy} className="dare-btn w-full py-3 mb-3">
            I will do this
          </button>
        )}
        {dare.mode === 'funded' && !viewer.isDoer && (dare.status === 'open' || dare.status === 'accepted') && (
          <div className="mb-4">
            <div className="grid grid-cols-4 gap-2 mb-2">
              {(fees ? [fees.minBountyCents, 5000, 10000].filter((cents, index, list) => cents >= fees.minBountyCents && cents <= fees.maxBountyCents && list.indexOf(cents) === index) : [2000, 5000, 10000]).map((cents) => (
                <button key={cents} onClick={() => setAmount(cents)} className="py-2 rounded-lg text-xs" style={{ backgroundColor: amount === cents ? '#00FF87' : '#0D0D1A', color: amount === cents ? '#0A0A0F' : '#ffffff', ...mono }}>
                  {cents / 100}
                </button>
              ))}
            </div>
            {dare.charity ? (
              <label className="flex items-center gap-2 text-sm mb-2" style={{ color: '#ffffff' }}>
                <input type="checkbox" checked={failOutcome === 'charity'} onChange={(event) => setFailOutcome(event.target.checked ? 'charity' : 'refund')} />
                If this is missed, give the bounty to {String((dare.charity as { name: string }).name)} instead of refunding me
              </label>
            ) : null}
            {fees && (
              <div className="rounded-xl border p-3 mb-3 text-sm" style={{ borderColor: '#1A1A2E', color: '#cccccc' }}>
                {priceBounty(amount, fees, dare.charity ? failOutcome : 'refund').lines.map((line) => (
                  <p key={line} className="mb-1">{line}</p>
                ))}
                {simulated && !paidMode && <p style={{ color: '#FF8C42' }}>Demo checkout. No card is charged.</p>}
              </div>
            )}
            <button onClick={fund} disabled={busy || (!paidMode && !simulated)} className="dare-btn-mint w-full py-3 disabled:opacity-40">
              {paidMode || simulated ? 'Pay this bounty' : 'Paid mode is off'}
            </button>
          </div>
        )}
        {cryptoRail && <CryptoRail dareId={String(dare.id)} escrowAddress={escrowAddress} />}
        <div className="flex gap-2">
          <button onClick={copy} className="dare-btn-ghost flex-1 py-3 text-sm">{copied ? 'Copied' : 'Copy link'}</button>
          <Link href={`/dare/${id}`} className="dare-btn-ghost flex-1 py-3 text-sm text-center">Open dare</Link>
        </div>
        <img alt="Share card" src={`/api/og?dare=${id}`} className="mt-6 w-full rounded-xl" />
      </div>
    </main>
  )
}
