'use client'

import Link from 'next/link'
import { Challenge, PILLARS } from '@/lib/supabase'
import PillarBadge from './PillarBadge'
import ProgressBar from './ProgressBar'

interface ChallengeCardProps {
  challenge: Challenge
  showJoin?: boolean
  onJoin?: (id: string) => void
  compact?: boolean
}

export default function ChallengeCard({ challenge, showJoin, onJoin, compact }: ChallengeCardProps) {
  const pillar = PILLARS.find(p => p.key === challenge.pillar?.toLowerCase())
  const emoji = challenge.cover_emoji || pillar?.emoji || '🏆'
  const progress = challenge.progress ?? 0
  const participants = challenge.participants_count ?? 0
  const pot = challenge.pot_amount ?? (challenge.stake_per_user ?? 0) * participants

  return (
    <div
      className="card-hover rounded-xl p-4 flex flex-col gap-3"
      style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0">{emoji}</span>
          <div className="min-w-0">
            <Link href={`/challenge/${challenge.id}`}>
              <h3
                className="font-semibold text-sm leading-tight truncate hover:text-purple-400 transition-colors"
                style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {challenge.title}
              </h3>
            </Link>
            {!compact && challenge.description && (
              <p className="text-xs mt-0.5 truncate" style={{ color: '#8888AA' }}>
                {challenge.description}
              </p>
            )}
          </div>
        </div>
        <PillarBadge pillar={challenge.pillar} size="sm" showLabel={false} />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
        <span>
          <span style={{ color: '#6C63FF' }}>👥</span> {participants}
        </span>
        <span>
          <span style={{ color: '#00FF87' }}>💰</span> ${pot} USDC
        </span>
        {challenge.days_left !== undefined && (
          <span>
            <span style={{ color: '#FF8C42' }}>⏳</span> {challenge.days_left}d left
          </span>
        )}
      </div>

      {/* Progress */}
      <ProgressBar value={progress} />

      {/* Join button */}
      {showJoin && onJoin && (
        <button
          onClick={() => onJoin(challenge.id)}
          className="w-full py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{
            backgroundColor: '#6C63FF',
            color: '#ffffff',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Join Challenge
        </button>
      )}
    </div>
  )
}
