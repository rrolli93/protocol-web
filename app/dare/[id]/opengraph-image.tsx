import { ImageResponse } from 'next/og'
import { formatChf } from '@/lib/dare/money'
import { getRepo } from '@/lib/dare/runtime'

export const alt = 'Dare'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let title = 'A dare'
  let result = 'The doer never pays'
  let amount = 'Open bounty'
  try {
    const repo = getRepo()
    const dare = await repo.getDare(id)
    if (dare) {
      title = dare.title
      const bounty = await repo.sumCaptured(dare.id)
      amount = bounty > 0 ? formatChf(bounty) : 'Open bounty'
      result = dare.status === 'paid_out' ? 'Paid out' : dare.status === 'refunded' ? 'Refunded' : dare.status === 'failed' ? 'Missed' : 'Friend-funded'
    }
  } catch {
    // Preview still renders if the store is unavailable.
  }
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#0A0A0F', color: '#fff', padding: '64px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', fontSize: 28, color: '#6C63FF', letterSpacing: 6 }}>DARE</div>
        <div style={{ display: 'flex', fontSize: 68, marginTop: 24, lineHeight: 1.1 }}>{title}</div>
        <div style={{ display: 'flex', fontSize: 36, marginTop: 28, color: '#00FF87' }}>{result}</div>
        <div style={{ display: 'flex', fontSize: 28, marginTop: 16, color: '#8888AA' }}>{amount} · the doer never pays</div>
      </div>
    ),
    { ...size },
  )
}
