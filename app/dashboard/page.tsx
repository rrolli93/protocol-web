'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, Challenge, MOCK_CHALLENGES } from '@/lib/supabase'
import AuthGuard from '@/app/components/AuthGuard'
import ChallengeCard from '@/app/components/ChallengeCard'
import StatsRow from '@/app/components/StatsRow'

export default function DashboardPage() {
  const [username, setUsername] = useState('Challenger')
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([])
  const [trending, setTrending] = useState<Challenge[]>([])
  const [stats, setStats] = useState({ active: 0, won: 0, earned: '0' })
  const [loading, setLoading] = useState(true)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Profile
      const { data: profile } = await supabase
        .from('users')
        .select('username, challenges_won, usdc_earned')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = profile as any
        setUsername(p.username || session.user.email?.split('@')[0] || 'Challenger')
        setStats({
          active: 0,
          won: p.challenges_won ?? 0,
          earned: `$${p.usdc_earned ?? 0}`,
        })
      }

      // My challenges
      const { data: participations } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', session.user.id)

      if (participations && participations.length > 0) {
        const ids = participations.map((p: { challenge_id: string }) => p.challenge_id)
        const { data: challenges } = await supabase
          .from('challenges')
          .select('*')
          .in('id', ids)
          .eq('status', 'active')

        const list = (challenges ?? []) as Challenge[]
        setMyChallenges(list.length > 0 ? list : MOCK_CHALLENGES)
        setStats(s => ({ ...s, active: list.length }))
      } else {
        setMyChallenges(MOCK_CHALLENGES)
      }

      // Trending
      const { data: trendingData } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_public', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(6)

      const trendList = (trendingData ?? []) as Challenge[]
      setTrending(trendList.length > 0 ? trendList : MOCK_CHALLENGES)

      setLoading(false)
    }
    load()
  }, [])

  return (
    <AuthGuard>
      <div
        className="min-h-screen"
        style={{ backgroundColor: '#0A0A0F' }}
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1
                className="text-xl font-bold"
                style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {greeting}, {username} 👋
              </h1>
              <p className="text-sm mt-0.5" style={{ color: '#8888AA' }}>
                Keep pushing. Every rep counts.
              </p>
            </div>
            <Link
              href="/create"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{
                backgroundColor: '#6C63FF',
                color: '#ffffff',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              + New
            </Link>
          </div>

          {/* Stats */}
          <div className="mb-6">
            <StatsRow
              stats={[
                { label: 'ACTIVE', value: stats.active, color: '#6C63FF' },
                { label: 'WON', value: stats.won, color: '#00FF87' },
                { label: 'EARNED', value: stats.earned, color: '#00FF87' },
              ]}
            />
          </div>

          {/* My Challenges */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-sm font-semibold tracking-wider"
                style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
              >
                YOUR CHALLENGES
              </h2>
              <Link
                href="/explore"
                className="text-xs hover:underline"
                style={{ color: '#6C63FF', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Browse all →
              </Link>
            </div>

            {loading ? (
              <div className="flex gap-4 overflow-hidden">
                {[1, 2].map(i => (
                  <div
                    key={i}
                    className="w-64 h-40 rounded-xl animate-pulse shrink-0"
                    style={{ backgroundColor: '#0D0D1A' }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myChallenges.slice(0, 3).map(c => (
                  <ChallengeCard key={c.id} challenge={c} />
                ))}
              </div>
            )}
          </section>

          {/* Trending */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-sm font-semibold tracking-wider"
                style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
              >
                TRENDING
              </h2>
              <Link
                href="/explore"
                className="text-xs hover:underline"
                style={{ color: '#6C63FF', fontFamily: "'JetBrains Mono', monospace" }}
              >
                See all →
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <div
                    key={i}
                    className="h-40 rounded-xl animate-pulse"
                    style={{ backgroundColor: '#0D0D1A' }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trending.slice(0, 3).map(c => (
                  <ChallengeCard key={c.id} challenge={c} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AuthGuard>
  )
}
