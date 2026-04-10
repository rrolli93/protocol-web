'use client'

import { PILLARS } from '@/lib/supabase'

interface PillarBadgeProps {
  pillar: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export default function PillarBadge({ pillar, size = 'md', showLabel = true }: PillarBadgeProps) {
  const found = PILLARS.find(p => p.key === pillar.toLowerCase())
  const emoji = found?.emoji ?? '🏆'
  const label = found?.label ?? pillar
  const color = found?.color ?? '#6C63FF'

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-1.5 gap-2',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${color}18`,
        color: color,
        border: `1px solid ${color}33`,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <span>{emoji}</span>
      {showLabel && <span>{label}</span>}
    </span>
  )
}
