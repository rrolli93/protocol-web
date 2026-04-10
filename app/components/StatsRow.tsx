'use client'

interface Stat {
  label: string
  value: string | number
  color?: string
}

interface StatsRowProps {
  stats: Stat[]
}

export default function StatsRow({ stats }: StatsRowProps) {
  return (
    <div
      className="grid gap-px rounded-xl overflow-hidden"
      style={{
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        backgroundColor: '#1A1A2E',
      }}
    >
      {stats.map((stat, i) => (
        <div
          key={i}
          className="flex flex-col items-center justify-center py-4 px-2"
          style={{ backgroundColor: '#0D0D1A' }}
        >
          <span
            className="text-xl font-bold"
            style={{
              color: stat.color ?? '#6C63FF',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {stat.value}
          </span>
          <span
            className="text-xs mt-1 text-center"
            style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  )
}
