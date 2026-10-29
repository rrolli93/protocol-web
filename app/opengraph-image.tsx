import { ImageResponse } from 'next/og'

export const alt = 'Dare — friends fund the challenge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#0A0A0F', color: '#fff', padding: '72px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', fontSize: 28, color: '#6C63FF', letterSpacing: 8 }}>DARE</div>
        <div style={{ display: 'flex', fontSize: 72, marginTop: 20 }}>Friends fund the challenge.</div>
        <div style={{ display: 'flex', fontSize: 32, marginTop: 24, color: '#8888AA' }}>The doer never pays. Done pays the doer. Missed refunds the funder.</div>
      </div>
    ),
    { ...size },
  )
}
