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
    <main className="min-h-screen px-4 py-10" style={{ backgroundColor: '#0A0A0F' }}>
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-sm" style={{ color: '#6C63FF', ...mono }}>DARE</Link>
        <h1 className="text-3xl font-bold mt-4 mb-2" style={{ color: '#ffffff', ...mono }}>{String(dare.title)}</h1>
        <p className="text-sm mb-4" style={{ color: '#8888AA' }}>{String(dare.rules)}</p>
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          {[
            ['BOUNTY', bounty ? `CHF ${(bounty / 100).toFixed(0)}` : 'Open'],
            ['STATUS', String(dare.status)],
            ['MODE', String(dare.mode)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border p-3" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
              <p className="text-sm" style={{ color: '#ffffff', ...mono }}>{value}</p>
              <p className="text-xs mt-1" style={{ color: '#8888AA', ...mono }}>{label}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
          <p className="text-sm" style={{ color: '#ffffff' }}>The doer stakes nothing.</p>
          <p className="text-xs mt-2" style={{ color: '#8888AA' }}>A funder pays the bounty. The doer puts in nothing. There is no shared pot and nobody wins by betting against the doer.</p>
        </div>
        {message && <p className="text-sm mb-3" style={{ color: '#FF8C42' }}>{message}</p>}
        {dare.mode === 'funded' && dare.status === 'open' && !viewer.isDoer && (
          <button onClick={accept} disabled={busy} className="w-full py-3 rounded-xl mb-3 font-semibold" style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}>
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
            <button onClick={fund} disabled={busy || (!paidMode && !simulated)} className="w-full py-3 rounded-xl font-semibold disabled:opacity-40" style={{ backgroundColor: '#00FF87', color: '#0A0A0F', ...mono }}>
              {paidMode || simulated ? 'Pay this bounty' : 'Paid mode is off'}
            </button>
          </div>
        )}
        {cryptoRail && <CryptoRail dareId={String(dare.id)} escrowAddress={escrowAddress} />}
        <div className="flex gap-2">
          <button onClick={copy} className="flex-1 py-3 rounded-xl border text-sm" style={{ borderColor: '#1A1A2E', color: '#ffffff', ...mono }}>{copied ? 'Copied' : 'Copy link'}</button>
          <Link href={`/dare/${id}`} className="flex-1 py-3 rounded-xl border text-sm text-center" style={{ borderColor: '#1A1A2E', color: '#ffffff', ...mono }}>Open dare</Link>
        </div>
        <img alt="Share card" src={`/api/og?dare=${id}`} className="mt-6 w-full rounded-xl" />
      </div>
    </main>
  )
}
