'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient, Challenge, MOCK_CHALLENGES, PILLARS } from '@/lib/supabase'
import AuthGuard from '@/app/components/AuthGuard'
import ChallengeCard from '@/app/components/ChallengeCard'
import StatsRow from '@/app/components/StatsRow'
import { buildStravaAuthUrl } from '@/lib/strava'

interface Profile {
  id: string
  username: string
  display_name?: string
  challenges_won?: number
  usdc_earned?: number
  streak?: number
}

function ProfilePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [stravaConnected, setStravaConnected] = useState(false)
  const [stravaLoading, setStravaLoading] = useState(false)

  // Check if just redirected from Strava
  const stravaParam = searchParams.get('strava')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: p } = await supabase
        .from('users')
        .select('id, username, display_name, challenges_won, usdc_earned, streak')
        .eq('id', session.user.id)
        .single()

      if (p) {
        setProfile(p as Profile)
      } else {
        setProfile({
          id: session.user.id,
          username: session.user.email?.split('@')[0] ?? 'challenger',
          display_name: session.user.email?.split('@')[0],
        })
      }

      // Check Strava connection
      const { data: integration } = await supabase
        .from('user_integrations')
        .select('connected')
        .eq('user_id', session.user.id)
        .eq('provider', 'strava')
        .single()
      setStravaConnected(integration?.connected === true)

      // Active challenges
      const { data: parts } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', session.user.id)

      if (parts && parts.length > 0) {
        const ids = parts.map((p: { challenge_id: string }) => p.challenge_id)
        const { data: challengeData } = await supabase
          .from('challenges')
          .select('*')
          .in('id', ids)
          .eq('status', 'active')
        const list = (challengeData ?? []) as Challenge[]
        setChallenges(list.length > 0 ? list : MOCK_CHALLENGES)
      } else {
        setChallenges(MOCK_CHALLENGES)
      }

      setLoading(false)
    }
    load()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? 'PR'

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#6C63FF', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-3"
                  style={{ backgroundColor: '#6C63FF', color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {initials}
                </div>
                <h1
                  className="text-xl font-bold"
                  style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {profile?.display_name ?? profile?.username}
                </h1>
                <p className="text-sm" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                  @{profile?.username}
                </p>
              </div>

              {/* Stats */}
              <div className="mb-6">
                <StatsRow
                  stats={[
                    { label: 'WON', value: profile?.challenges_won ?? 0, color: '#00FF87' },
                    { label: 'EARNED', value: `$${profile?.usdc_earned ?? 0}`, color: '#00FF87' },
                    { label: 'STREAK', value: `${profile?.streak ?? 0}d`, color: '#6C63FF' },
                  ]}
                />
              </div>

              {/* Integrations */}
              <div
                className="rounded-xl border p-4 mb-6"
                style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}
              >
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  INTEGRATIONS
                </h2>
                {stravaParam === 'connected' && (
                  <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#00FF8722', color: '#00FF87', fontFamily: "'JetBrains Mono', monospace" }}>
                    ✓ Strava connected successfully
                  </div>
                )}
                {stravaParam === 'error' && (
                  <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FF475722', color: '#FF4757', fontFamily: "'JetBrains Mono', monospace" }}>
                    ✗ Strava connection failed. Try again.
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🟠</span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>Strava</p>
                        <p className="text-xs" style={{ color: stravaConnected ? '#00FF87' : '#8888AA' }}>
                          {stravaConnected ? 'Connected — workouts synced' : 'Auto-track workouts'}
                        </p>
                      </div>
                    </div>
                    {stravaConnected ? (
                      <span
                        className="px-3 py-1 rounded-lg text-xs"
                        style={{ color: '#00FF87', backgroundColor: '#00FF8722', fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        ✓ Connected
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setStravaLoading(true)
                          window.location.href = buildStravaAuthUrl(profile?.id ?? '')
                        }}
                        disabled={stravaLoading}
                        className="px-3 py-1 rounded-lg text-xs border transition-all active:scale-95"
                        style={{
                          color: stravaLoading ? '#8888AA' : '#FC4C02',
                          borderColor: stravaLoading ? '#8888AA33' : '#FC4C0255',
                          backgroundColor: stravaLoading ? 'transparent' : '#FC4C0211',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {stravaLoading ? 'Connecting...' : 'Connect'}
                      </button>
                    )}
                  </div>
                  <div
                    className="h-px"
                    style={{ backgroundColor: '#1A1A2E' }}
                  />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🍎</span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>Apple Health</p>
                        <p className="text-xs" style={{ color: '#8888AA' }}>Not available on web</p>
                      </div>
                    </div>
                    <span
                      className="px-3 py-1 rounded-lg text-xs"
                      style={{ color: '#8888AA', backgroundColor: '#1A1A2E', fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      N/A
                    </span>
                  </div>
                </div>
              </div>

              {/* Pillars */}
              <div className="mb-6">
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  PILLARS
                </h2>
                <div className="flex flex-wrap gap-2">
                  {PILLARS.map(p => (
                    <span
                      key={p.key}
                      className="px-3 py-1.5 rounded-full text-sm"
                      style={{
                        backgroundColor: `${p.color}18`,
                        color: p.color,
                        border: `1px solid ${p.color}33`,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {p.emoji} {p.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Active challenges */}
              <div className="mb-8">
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  ACTIVE CHALLENGES
                </h2>
                <div className="flex flex-col gap-3">
                  {challenges.slice(0, 5).map(c => (
                    <ChallengeCard key={c.id} challenge={c} compact />
                  ))}
                </div>
              </div>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="w-full py-3 rounded-xl font-semibold text-sm border transition-all hover:border-red-500 hover:bg-red-500/10 active:scale-95"
                style={{
                  color: '#FF4757',
                  borderColor: 'rgba(255,71,87,0.3)',
                  backgroundColor: 'transparent',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageInner />
    </Suspense>
  )
}
