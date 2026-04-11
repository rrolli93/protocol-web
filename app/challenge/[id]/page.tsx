'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, Challenge, PILLARS, MOCK_CHALLENGES } from '@/lib/supabase'
import AuthGuard from '@/app/components/AuthGuard'
import PillarBadge from '@/app/components/PillarBadge'
import ProgressBar from '@/app/components/ProgressBar'
import StatsRow from '@/app/components/StatsRow'

interface Participant {
  user_id: string
  progress: number
  joined_at: string
  username?: string
}

export default function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isParticipating, setIsParticipating] = useState(false)
  const [myProgress, setMyProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)

      // Fetch challenge
      let challengeData: Challenge | null = null
      if (id.startsWith('mock-')) {
        challengeData = MOCK_CHALLENGES.find(c => c.id === id) ?? null
      } else {
        const { data } = await supabase.from('challenges').select('*').eq('id', id).single()
        challengeData = data as Challenge
      }

      if (!challengeData) {
        router.push('/dashboard')
        return
      }
      setChallenge(challengeData)

      // Fetch participants with current_score
      const { data: parts } = await supabase
        .from('challenge_participants')
        .select('user_id, current_score, joined_at')
        .eq('challenge_id', id)

      if (parts && parts.length > 0) {
        const userIds = parts.map((p: { user_id: string }) => p.user_id)
        const { data: users } = await supabase
          .from('users')
          .select('id, username')
          .in('id', userIds)

        const userMap: Record<string, string> = {}
        if (users) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          users.forEach((u: any) => { userMap[u.id] = u.username })
        }

        // Compute progress % from current_score vs goal
        const ch = challengeData
        const totalDays = ch.duration_days ?? 30
        const goalTotal = (ch.goal_value ?? 0) * totalDays
        const elapsedDays = ch.starts_at
          ? Math.min(totalDays, (Date.now() - new Date(ch.starts_at).getTime()) / (1000 * 60 * 60 * 24))
          : totalDays

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enriched = parts.map((p: any) => ({
          ...p,
          username: userMap[p.user_id] ?? 'challenger',
          progress: goalTotal > 0
            ? Math.min(100, Math.round((Number(p.current_score || 0) / goalTotal) * 100))
            : Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
        }))

        enriched.sort((a: Participant, b: Participant) => b.progress - a.progress)
        setParticipants(enriched)

        const myPart = enriched.find((p: Participant) => p.user_id === session.user.id)
        if (myPart) {
          setIsParticipating(true)
          setMyProgress(myPart.progress)
        }
      } else {
        // Mock participants when no real data
        setParticipants([
          { user_id: 'a', progress: 85, joined_at: '', username: 'alex_runs' },
          { user_id: 'b', progress: 62, joined_at: '', username: 'fitnessbro' },
          { user_id: 'c', progress: 45, joined_at: '', username: 'morning_warrior' },
        ])
      }

      setLoading(false)
    }
    load()
  }, [id, router])

  async function handleJoin() {
    setJoining(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await supabase.from('challenge_participants').insert({
      challenge_id: id,
      user_id: session.user.id,
      current_score: 0,
    })

    setIsParticipating(true)
    setJoining(false)
  }

  const pillar = PILLARS.find(p => p.key === challenge?.pillar?.toLowerCase())
  const emoji = pillar?.emoji ?? '🏆'
  const pot = (challenge?.pot_amount ?? (challenge?.stake_per_user ?? 0) * participants.length)
  const daysLeft = challenge?.days_left ?? challenge?.duration_days ?? 0

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0A0F' }}>
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#6C63FF', borderTopColor: 'transparent' }} />
        </div>
      </AuthGuard>
    )
  }

  if (!challenge) return null

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Hero */}
          <div
            className="rounded-xl p-6 mb-6 border text-center"
            style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}
          >
            <div className="text-5xl mb-3">{emoji}</div>
            <h1
              className="text-2xl font-bold mb-2"
              style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {challenge.title}
            </h1>
            <p className="text-sm mb-3" style={{ color: '#8888AA' }}>{challenge.description}</p>
            <div className="flex items-center justify-center gap-3">
              <PillarBadge pillar={challenge.pillar} />
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: challenge.status === 'active' ? 'rgba(0,255,135,0.1)' : 'rgba(136,136,170,0.1)',
                  color: challenge.status === 'active' ? '#00FF87' : '#8888AA',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {challenge.status?.toUpperCase() ?? 'ACTIVE'}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6">
            <StatsRow
              stats={[
                { label: 'PARTICIPANTS', value: participants.length, color: '#6C63FF' },
                { label: 'POT', value: `$${pot}`, color: '#00FF87' },
                { label: 'DAYS LEFT', value: daysLeft, color: '#FF8C42' },
              ]}
            />
          </div>

          {/* My progress */}
          {isParticipating && (
            <div
              className="rounded-xl p-4 mb-6 border"
              style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}
            >
              <h2
                className="text-sm font-semibold mb-3"
                style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
              >
                YOUR PROGRESS
              </h2>
              <ProgressBar value={myProgress} showLabel />
            </div>
          )}

          {/* Leaderboard */}
          <div
            className="rounded-xl p-4 mb-6 border"
            style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}
          >
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
            >
              LEADERBOARD
            </h2>
            <div className="flex flex-col gap-3">
              {participants.map((p, i) => (
                <div key={p.user_id} className="flex items-center gap-3">
                  <span
                    className="w-6 text-center text-xs font-bold shrink-0"
                    style={{
                      color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#8888AA',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      backgroundColor: p.user_id === userId ? '#6C63FF' : '#1A1A2E',
                      color: '#ffffff',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {(p.username ?? 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span
                        className="text-xs font-medium"
                        style={{ color: p.user_id === userId ? '#6C63FF' : '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {p.username ?? 'challenger'}
                        {p.user_id === userId && ' (you)'}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {p.progress}%
                      </span>
                    </div>
                    <ProgressBar value={p.progress} height={4} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Join button */}
          {!isParticipating && (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: '#6C63FF', color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {joining ? 'Joining...' : `🚀 Join for $${challenge.stake_per_user} USDC`}
            </button>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
