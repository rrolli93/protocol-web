import Link from 'next/link'

export interface DareCardData {
  id: string
  title: string
  status: string
  mode: string
  category?: string
  deadlineAt: string
  bountyCents: number
  funderCount: number
  progress: number
}

function money(cents: number) {
  if (!cents) return 'Open'
  return `CHF ${Math.round(cents / 100)}`
}

function when(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function DareCard({ dare }: { dare: DareCardData }) {
  const progress = Math.max(0, Math.min(100, dare.progress))
  return (
    <Link href={`/dare/${dare.id}`} className="dare-card dare-card-link block p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="dare-kicker">{dare.category ?? dare.mode}</p>
          <h3 className="font-display text-xl mt-1 truncate" style={{ color: '#fff' }}>{dare.title}</h3>
        </div>
        <span className="dare-status">{dare.status.replace(/_/g, ' ')}</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['Bounty', money(dare.bountyCents)],
          ['Deadline', when(dare.deadlineAt)],
          ['Funders', String(dare.funderCount)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] uppercase tracking-wider" style={{ color: '#9d96b4' }}>{label}</dt>
            <dd className="text-sm mt-1 font-medium" style={{ color: '#fff' }}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <div className="flex justify-between text-[11px] mb-1" style={{ color: '#c4bdd6' }}>
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="dare-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${dare.title} progress`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Link>
  )
}
