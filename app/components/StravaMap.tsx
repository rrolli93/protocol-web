import { decodePolyline } from '@/lib/dare/strava-match'

export default function StravaMap({ polyline }: { polyline: string | null }) {
  const points = polyline ? decodePolyline(polyline) : []
  if (points.length < 2) {
    return <div className="dare-card h-36 grid place-items-center text-sm" style={{ color: '#c4bdd6' }}>No GPS line</div>
  }
  const lats = points.map((point) => point[0])
  const lngs = points.map((point) => point[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const width = 320
  const height = 140
  const pad = 12
  const dx = Math.max(maxLng - minLng, 0.0001)
  const dy = Math.max(maxLat - minLat, 0.0001)
  const path = points.map((point, index) => {
    const x = pad + ((point[1] - minLng) / dx) * (width - pad * 2)
    const y = pad + (1 - (point[0] - minLat) / dy) * (height - pad * 2)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 rounded-2xl" role="img" aria-label="Activity map" style={{ background: '#0c0b14' }}>
      <path d={path} fill="none" stroke="#b1a6ff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
