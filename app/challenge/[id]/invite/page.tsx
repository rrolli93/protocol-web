'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getPillar, PILLARS } from '@/lib/pillars'

const mono = { fontFamily: "'JetBrains Mono', monospace" }

interface ChallengeData {
  id: string
  title: string
  description?: string
  pillar: string
  stake_per_user: number
  start_date?: string
  end_date?: string
  starts_at?: string
  ends_at?: string
  status: string
  goal_value?: number
  goal_unit?: string
  goal_frequency?: string
  created_by?: string
  creator_id?: string
}

interface LeaderboardEntry {
  user_id: string
  username: string
  current_score: number
  rank: number
}

function avatarColor(userId: string) {
  const colors = ['#6C63FF', '#00FF87', '#FF8C42', '#FF4757', '#1E90FF', '#FFA502', '#9B8DFF', '#00CFFF']
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function getDaysLeft(challenge: ChallengeData): number {
  const endDate = challenge.end_date || challenge.ends_at
  if (!endDate) return 0
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function getGoalString(challenge: ChallengeData): string {
  if (!challenge.goal_value) return ''
  const freq = challenge.goal_frequency === 'daily' ? '/day'
    : challenge.goal_frequency === 'weekly' ? '/week'
    : ''
  return `${challenge.goal_value} ${challenge.goal_unit || ''}${freq}`.trim()
}

function RankBadge({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
  if (medals[rank]) return <span style={{ fontSize: '1.2rem' }}>{medals[rank]}</span>
  return (
    <span
      className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
      style={{ backgroundColor: '#1A1A2E', color: '#8888AA', ...mono }}
    >
      {rank}
    </span>
  )
}

function ScoreBar({ score, pillarColor }: { score: number; pillarColor: string }) {
  const pct = Math.min(100, score)
  return (
    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1A1A2E' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#00FF87' : pillarColor }}
      />
    </div>
  )
}

export default function ChallengeInvitePage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const [challenge, setChallenge] = useState<ChallengeData | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isParticipating, setIsParticipating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  async function load() {
    const supabase = createClient()

    // Check auth status
    const { data: { session } } = await supabase.auth.getSession()
    setIsLoggedIn(!!session)

    // Fetch challenge — use start_date/end_date columns as per task spec
    const { data: c, error } = await supabase
      .from('challenges')
      .select('id, title, description, pillar, stake_per_user, starts_at, ends_at, status, goal_value, goal_unit, goal_frequency, creator_id, cover_emoji, max_participants')
      .eq('id', id)
      .single()

    if (error || !c) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setChallenge(c as ChallengeData)

    // Fetch participants
    const { data: parts } = await supabase
      .from('challenge_participants')
      .select('user_id, current_score, joined_at')
      .eq('challenge_id', id)

    const count = parts?.length ?? 0
    setParticipantCount(count)

    // Check if current user is already participating
    if (session && parts) {
      setIsParticipating(parts.some(p => p.user_id === session.user.id))
    }

    // Build leaderboard top 3
    if (parts && parts.length > 0) {
      const userIds = parts.map(p => p.user_id)
      const { data: users } = await supabase
        .from('users')
        .select('id, username')
        .in('id', userIds)

      const usernameMap: Record<string, string> = {}
      users?.forEach(u => { usernameMap[u.id] = u.username })

      const sorted = [...parts]
        .sort((a, b) => (b.current_score ?? 0) - (a.current_score ?? 0))
        .slice(0, 3)
        .map((p, i) => ({
          user_id: p.user_id,
          username: usernameMap[p.user_id] || 'Anonymous',
          current_score: p.current_score ?? 0,
          rank: i + 1,
        }))

      setLeaderboard(sorted)
    }

    setLoading(false)
  }

  async function handleJoin() {
    if (!isLoggedIn) {
      // Redirect to signup with return URL
      router.push(`/signup?redirect=/challenge/${id}/invite`)
      return
    }
    setJoining(true)
    setJoinError('')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push(`/signup?redirect=/challenge/${id}/invite`)
      return
    }

    // Insert participant
    const { error } = await supabase
      .from('challenge_participants')
      .insert({ challenge_id: id, user_id: session.user.id, current_score: 0 })

    if (error) {
      if (error.code === '23505') {
        // Already a participant
        router.push(`/challenge/${id}`)
        return
      }
      setJoinError('Could not join challenge. Please try again.')
      setJoining(false)
      return
    }

    router.push(`/challenge/${id}`)
  }

  function copyLink() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#6C63FF', borderTopColor: 'transparent' }}
          />
          <span style={{ color: '#8888AA', ...mono, fontSize: '0.875rem' }}>Loading challenge...</span>
        </div>
      </div>
    )
  }

  if (notFound || !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#ffffff' }}>Challenge Not Found</h1>
          <p className="mb-6" style={{ color: '#8888AA' }}>This challenge doesn't exist or has been removed.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 rounded-xl font-semibold"
            style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}
          >
            Explore Challenges
          </button>
        </div>
      </div>
    )
  }

  const pillar = getPillar(challenge.pillar)
  const pillarColor = pillar?.color ?? '#6C63FF'
  const emoji = pillar?.emoji ?? '🏆'
  const daysLeft = getDaysLeft(challenge)
  const goalStr = getGoalString(challenge)
  const pot = (challenge.stake_per_user ?? 0) * participantCount
  const isEnded = challenge.status === 'settled' || daysLeft === 0

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

        {/* Header — Protocol brand */}
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
          {/* Emoji + Pillar badge */}
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

          {/* Title */}
          <h1
            className="text-2xl font-bold mb-2 leading-tight"
            style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {challenge.title}
          </h1>

          {/* Description */}
          {challenge.description && (
            <p className="text-sm mb-5 leading-relaxed" style={{ color: '#8888AA' }}>
              {challenge.description}
            </p>
          )}

          {/* Goal */}
          {goalStr && (
            <div
              className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl"
              style={{ backgroundColor: `${pillarColor}12`, border: `1px solid ${pillarColor}33` }}
            >
              <span className="text-sm font-semibold" style={{ color: '#8888AA' }}>Goal</span>
              <span
                className="text-sm font-bold ml-auto"
                style={{ color: pillarColor, ...mono }}
              >
                {goalStr}
              </span>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className="flex flex-col items-center py-4 rounded-xl"
              style={{ backgroundColor: '#0A0A0F', border: '1px solid #1A1A2E' }}
            >
              <span className="text-xs mb-1" style={{ color: '#8888AA' }}>Pot Size</span>
              <span className="text-xl font-bold" style={{ color: '#FFD700', ...mono }}>
                ${pot}
              </span>
              <span className="text-xs" style={{ color: '#8888AA' }}>USDC</span>
            </div>
            <div
              className="flex flex-col items-center py-4 rounded-xl"
              style={{ backgroundColor: '#0A0A0F', border: '1px solid #1A1A2E' }}
            >
              <span className="text-xs mb-1" style={{ color: '#8888AA' }}>Players</span>
              <span className="text-xl font-bold" style={{ color: '#ffffff', ...mono }}>
                {participantCount}
              </span>
              <span className="text-xs" style={{ color: '#8888AA' }}>joined</span>
            </div>
            <div
              className="flex flex-col items-center py-4 rounded-xl"
              style={{ backgroundColor: '#0A0A0F', border: '1px solid #1A1A2E' }}
            >
              <span className="text-xs mb-1" style={{ color: '#8888AA' }}>Stake</span>
              <span className="text-xl font-bold" style={{ color: '#6C63FF', ...mono }}>
                ${challenge.stake_per_user}
              </span>
              <span className="text-xs" style={{ color: '#8888AA' }}>to join</span>
            </div>
          </div>
        </div>

        {/* Leaderboard Preview */}
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

                  {/* Avatar */}
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

        {/* Empty state — no participants yet */}
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

        {/* Social proof banner */}
        <div
          className="rounded-2xl p-4 mb-4 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(108, 99, 255, 0.08)', border: '1px solid rgba(108, 99, 255, 0.2)' }}
        >
          <div className="text-2xl">💸</div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>Win real money</p>
            <p className="text-xs" style={{ color: '#8888AA' }}>
              Hit your goal → split the pot. Lose = forfeit your stake.
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
              { icon: '🏆', title: 'Win the Pot', desc: 'Hit your goal → share the pool' },
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
            href={`https://twitter.com/intent/tweet?text=I%27m%20competing%20in%20${encodeURIComponent(challenge.title)}%20%E2%80%94%20$${pot}%20pot%20on%20%40protocol_app.%20Join%20me!&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
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
          ) : isParticipating ? (
            <button
              onClick={() => router.push(`/challenge/${id}`)}
              className="w-full py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 active:scale-[0.99]"
              style={{ backgroundColor: 'rgba(0,255,135,0.12)', color: '#00FF87', border: '1px solid rgba(0,255,135,0.3)', ...mono }}
            >
              ✓ View Your Challenge
            </button>
          ) : (
            <>
              {joinError && (
                <p className="text-xs text-center mb-2" style={{ color: '#FF4757' }}>{joinError}</p>
              )}
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-4 rounded-xl font-bold text-base transition-all active:scale-[0.99] disabled:opacity-50"
                style={{
                  background: joining ? '#6C63FF' : 'linear-gradient(135deg, #6C63FF 0%, #9B8DFF 100%)',
                  color: '#ffffff',
                  boxShadow: '0 0 30px rgba(108,99,255,0.4)',
                  ...mono,
                }}
              >
                {joining ? 'Joining...' : isLoggedIn ? `🚀 Join for $${challenge.stake_per_user} USDC` : '🚀 Sign Up & Join Challenge'}
              </button>
              {!isLoggedIn && (
                <p className="text-xs text-center mt-2" style={{ color: '#8888AA' }}>
                  Already have an account?{' '}
                  <button
                    onClick={() => router.push(`/login?redirect=/challenge/${id}/invite`)}
                    style={{ color: '#6C63FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Log in
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
