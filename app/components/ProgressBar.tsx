'use client'

interface ProgressBarProps {
  value: number // 0–100
  height?: number
  showLabel?: boolean
  color?: string
}

export default function ProgressBar({
  value,
  height = 6,
  showLabel = false,
  color = '#6C63FF',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
            Progress
          </span>
          <span className="text-xs font-semibold" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
            {clamped}%
          </span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: `${height}px`, backgroundColor: '#1A1A2E' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
