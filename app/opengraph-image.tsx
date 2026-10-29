import { ImageResponse } from 'next/og'

export const alt = 'Dare — friends fund the challenge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#07060d', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', position: 'absolute', top: -80, right: -40, width: 520, height: 520, borderRadius: 520, background: 'rgba(109,99,255,0.45)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '72px', position: 'relative' }}>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 8, color: '#c9c2ff' }}>DARE</div>
          <div style={{ display: 'flex', fontSize: 28, marginTop: 28, color: '#d7d1ff' }}>Dare a friend for a good cause</div>
          <div style={{ display: 'flex', fontSize: 78, marginTop: 12, lineHeight: 1, letterSpacing: -2 }}>Friends fund the challenge.</div>
          <div style={{ display: 'flex', fontSize: 30, marginTop: 28, color: '#c4bdd6' }}>The doer never pays. Done pays the doer. Missed refunds the funder.</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
