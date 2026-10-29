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
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#07060d', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', position: 'absolute', top: -60, right: -20, width: 420, height: 420, borderRadius: 420, background: 'rgba(109,99,255,0.4)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px' }}>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 6, color: '#c9c2ff' }}>DARE</div>
          <div style={{ display: 'flex', fontSize: 64, marginTop: 22, lineHeight: 1.05 }}>{title}</div>
          <div style={{ display: 'flex', fontSize: 34, marginTop: 26, color: '#7dffe0' }}>{result}</div>
          <div style={{ display: 'flex', fontSize: 28, marginTop: 14, color: '#c4bdd6' }}>{amount} · the doer never pays</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
