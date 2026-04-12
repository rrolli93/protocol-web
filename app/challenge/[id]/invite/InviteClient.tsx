'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPillar } from '@/lib/pillars'

const mono = { fontFamily: "'JetBrains Mono', monospace" }

interface ChallengeData {
  id: string
  title: string
  description?: string
  pillar: string
  stake_per_user: number
  starts_at?: string
  ends_at?: string
  status: string
  goal_value?: number
  goal_unit?: string
  goal_frequency?: string
  creator_id?: string
  cover_emoji?: string
  max_participants?: number
}

interface LeaderboardEntry {
  user_id: string
  username: string
  current_score: number
  rank: number
}

interface Props {
  challenge: ChallengeData
  leaderboard: LeaderboardEntry[]
  participantCount: number
  challengeId: string
}

function avatarColor(userId: string) {
  const colors = ['#6C63FF', '#00FF87', '#FF8C42', '#FF4757', '#1E90FF', '#FFA502', '#9B8DFF', '#00CFFF']
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function getDaysLeft(challenge: ChallengeData): number {
  const endDate = challenge.ends_at
  if (!endDate) return 0
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function getGoalString(challenge: ChallengeData): string {
  if (!challenge.goal_value) return ''
  const freq = challenge.goal_frequency === 'daily' ? '/day'
    : challenge.goal_frequency === 'weekly' ? '/week'
    : ''
  return `${challenge.goal_value} ${challenge.goal_unit ?? ''}${freq}`.trim()
}

function RankBadge({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
  if (medals[rank]) return <span style={{ fontSize: '1.2rem' }}>{medals[rank]}</span>
  return (
    <span
      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: '#1A1A2E', color: '#8888AA', ...mono }}
    >
      {rank}
    </span>
  )
}

function ScoreBar({ score, pillarColor }: { score: number; pillarColor: string }) {
  const pct = Math.min(100, Math.round(score))
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1A1A2E' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: pillarColor }}
      />
    </div>
  )
}

export default function InviteClient({ challenge, leaderboard, participantCount, challengeId }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const pillar = getPillar(challenge.pillar)
  const pillarColor = pillar?.color ?? '#6C63FF'
  const emoji = challenge.cover_emoji ?? pillar?.emoji ?? '🏆'
  const daysLeft = getDaysLeft(challenge)
  const goalStr = getGoalString(challenge)
  const pot = (challenge.stake_per_user ?? 0) * participantCount
  const isEnded = challenge.status === 'settled' || daysLeft === 0

  const pageUrl = typeof window !== 'undefined' ? window.location.href : `https://protocol-web-theta.vercel.app/challenge/${challengeId}/invite`

  function copyLink() {
    navigator.clipboard.writeText(pageUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleJoin() {
    router.push(`/signup?redirect=/challenge/${challengeId}/invite`)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${pillarColor}22 0%, transparent 70%)`,
          zIndex: 0,
        }}
      />

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-12 pb-40">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}
            >
              P
            </div>
            <span className="text-sm font-bold tracking-widest uppercase" style={{ color: '#ffffff', ...mono }}>
              Protocol
            </span>
          </div>
          <span
            className="text-xs px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: isEnded ? '#1A1A2E' : 'rgba(0,255,135,0.1)',
              color: isEnded ? '#8888AA' : '#00FF87',
              border: `1px solid ${isEnded ? '#1A1A2E' : 'rgba(0,255,135,0.3)'}`,
              ...mono,
            }}
          >
            {isEnded ? 'Ended' : `${daysLeft}d left`}
          </span>
        </div>

        {/* Challenge Hero Card */}
        <div
          className="rounded-2xl p-6 mb-4"
          style={{
            backgroundColor: '#0D0D1A',
            border: `1px solid ${pillarColor}33`,
            boxShadow: `0 0 40px 0 ${pillarColor}18`,
          }}
        >
          <div className="flex items-start justify-between mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
              style={{ backgroundColor: `${pillarColor}18`, border: `1px solid ${pillarColor}33` }}
            >
              {emoji}
            </div>
            <span
              className="text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider"
              style={{ backgroundColor: `${pillarColor}22`, color: pillarColor, border: `1px solid ${pillarColor}44`, ...mono }}
            >
              {pillar?.label ?? challenge.pillar}
            </span>
          </div>

          <h1
            className="text-2xl font-bold mb-2 leading-tight"
            style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {challenge.title}
          </h1>

          {challenge.description && (
            <p className="text-sm mb-5 leading-relaxed" style={{ color: '#8888AA' }}>
              {challenge.description}
            </p>
          )}

          {goalStr && (
            <div
              className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl"
              style={{ backgroundColor: `${pillarColor}12`, border: `1px solid ${pillarColor}33` }}
            >
              <span className="text-sm font-semibold" style={{ color: '#8888AA' }}>Goal</span>
              <span className="text-sm font-bold ml-auto" style={{ color: pillarColor, ...mono }}>
                {goalStr}
              </span>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Pot Size', value: `$${pot}`, sub: 'USDC', color: '#FFD700' },
              { label: 'Players', value: `${participantCount}`, sub: 'joined', color: '#ffffff' },
              { label: 'Stake', value: `$${challenge.stake_per_user}`, sub: 'to join', color: '#6C63FF' },
            ].map(s => (
              <div
                key={s.label}
                className="flex flex-col items-center py-4 rounded-xl"
                style={{ backgroundColor: '#0A0A0F', border: '1px solid #1A1A2E' }}
              >
                <span className="text-xs mb-1" style={{ color: '#8888AA' }}>{s.label}</span>
                <span className="text-xl font-bold" style={{ color: s.color, ...mono }}>{s.value}</span>
                <span className="text-xs" style={{ color: '#8888AA' }}>{s.sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div
            className="rounded-2xl p-5 mb-4"
            style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#8888AA', ...mono }}>
                Top Performers
              </h2>
              <span className="text-xs" style={{ color: '#8888AA' }}>
                {participantCount} competing
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {leaderboard.map((entry) => (
                <div key={entry.user_id} className="flex items-center gap-3">
                  <RankBadge rank={entry.rank} />
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: avatarColor(entry.user_id), color: '#0A0A0F' }}
                  >
                    {entry.username?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-sm font-semibold truncate"
                        style={{ color: entry.rank === 1 ? '#FFD700' : '#ffffff' }}
                      >
                        {entry.username}
                      </span>
                      <span className="text-xs ml-2 flex-shrink-0" style={{ color: '#8888AA', ...mono }}>
                        {Math.min(100, Math.round(entry.current_score))}%
                      </span>
                    </div>
                    <ScoreBar score={entry.current_score} pillarColor={pillarColor} />
                  </div>
                </div>
              ))}
            </div>

            {participantCount > 3 && (
              <p className="text-xs text-center mt-4" style={{ color: '#8888AA' }}>
                +{participantCount - 3} more competing
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {leaderboard.length === 0 && (
          <div
            className="rounded-2xl p-5 mb-4 text-center"
            style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E' }}
          >
            <div className="text-3xl mb-2">🚀</div>
            <p className="text-sm font-semibold mb-1" style={{ color: '#ffffff' }}>Be the first to join!</p>
            <p className="text-xs" style={{ color: '#8888AA' }}>No one has entered yet. Start the challenge and own the leaderboard.</p>
          </div>
        )}

        {/* Social proof */}
        <div
          className="rounded-2xl p-4 mb-4 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(108, 99, 255, 0.08)', border: '1px solid rgba(108, 99, 255, 0.2)' }}
        >
          <div className="text-2xl">💸</div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>Win real money</p>
            <p className="text-xs" style={{ color: '#8888AA' }}>
              Hit 100% of your goal → split the pot. Lose = forfeit your stake.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E' }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#8888AA', ...mono }}>
            How it works
          </h3>
          <div className="flex flex-col gap-3">
            {[
              { icon: '🔒', title: 'Stake USDC', desc: `Lock $${challenge.stake_per_user} to enter` },
              { icon: '📊', title: 'Track Progress', desc: 'Connect Strava or log manually' },
              { icon: '🏆', title: 'Win the Pot', desc: 'Hit 100% goal → share the pool' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: '#0A0A0F', border: '1px solid #1A1A2E' }}
                >
                  {step.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>{step.title}</p>
                  <p className="text-xs" style={{ color: '#8888AA' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Share row */}
        <div className="flex gap-3 mb-2">
          <button
            onClick={copyLink}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-all"
            style={{
              color: copied ? '#00FF87' : '#8888AA',
              borderColor: copied ? 'rgba(0,255,135,0.3)' : '#1A1A2E',
              backgroundColor: 'transparent',
              ...mono,
            }}
          >
            {copied ? '✓ Copied!' : '🔗 Copy Link'}
          </button>
          <a
            href={`https://twitter.com/intent/tweet?text=I%27m%20competing%20in%20${encodeURIComponent(challenge.title)}%20%E2%80%94%20$${pot}%20pot%20on%20%40protocol_app.%20Join%20me!&url=${encodeURIComponent(pageUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 rounded-xl text-sm font-semibold border text-center transition-all hover:opacity-80"
            style={{ color: '#ffffff', borderColor: '#1A1A2E', backgroundColor: '#0D0D1A', ...mono }}
          >
            𝕏 Share
          </a>
        </div>

      </div>

      {/* Fixed CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 py-5"
        style={{
          backgroundColor: '#0A0A0F',
          borderTop: '1px solid #1A1A2E',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-lg mx-auto">
          {isEnded ? (
            <div
              className="w-full py-4 rounded-xl text-center text-sm font-semibold"
              style={{ backgroundColor: '#1A1A2E', color: '#8888AA', ...mono }}
            >
              Challenge Ended
            </div>
          ) : (
            <>
              <button
                onClick={handleJoin}
                className="w-full py-4 rounded-xl font-bold text-base transition-all active:scale-[0.99]"
                style={{
                  background: 'linear-gradient(135deg, #6C63FF 0%, #9B8DFF 100%)',
                  color: '#ffffff',
                  boxShadow: '0 0 30px rgba(108,99,255,0.4)',
                  ...mono,
                }}
              >
                🚀 Sign Up & Join Challenge
              </button>
              <p className="text-xs text-center mt-2" style={{ color: '#8888AA' }}>
                Already have an account?{' '}
                <button
                  onClick={() => router.push(`/login?redirect=/challenge/${challengeId}/invite`)}
                  style={{ color: '#6C63FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Log in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
