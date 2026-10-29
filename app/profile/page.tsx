'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient, Challenge, PILLARS } from '@/lib/supabase'
import AuthGuard from '@/app/components/AuthGuard'
import ChallengeCard from '@/app/components/ChallengeCard'
import DareCard, { type DareCardData } from '@/app/components/DareCard'
import StatsRow from '@/app/components/StatsRow'
import { buildStravaAuthUrl } from '@/lib/strava'
import { buildOuraAuthUrl } from '@/lib/oura'

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
  const [authUserId, setAuthUserId] = useState<string>('')
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [ownDares, setOwnDares] = useState<DareCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [stravaConnected, setStravaConnected] = useState(false)
  const [ouraConnected, setOuraConnected] = useState(false)
  const [stravaLoading, setStravaLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  // Check if just redirected from Strava or Oura
  const stravaParam = searchParams.get('strava')
  const ouraParam = searchParams.get('oura')

  useEffect(() => {
    async function load() {
      const me = await fetch('/api/me')
      if (me.ok) {
        const body = await me.json()
        setProfile({
          id: body.user.id,
          username: body.user.handle,
          display_name: body.user.displayName ?? body.user.handle,
        })
        setOwnDares(body.dares ?? [])
      }

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }
      setAuthUserId(session.user.id)

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

      // Check integration flags
      const { data: connCheck } = await supabase
        .from('users')
        .select('strava_connected, oura_connected')
        .eq('id', session.user.id)
        .single()
      setStravaConnected(connCheck?.strava_connected === true)
      setOuraConnected(connCheck?.oura_connected === true)

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
        setChallenges(list)
      } else {
        setChallenges([])
      }

      setLoading(false)
    }
    load()
  }, [])

  async function handleStravaSync() {
    if (!authUserId) return
    setSyncLoading(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUserId }),
      })
      const data = await res.json()
      if (data.ok) {
        const synced = data.results?.[0]?.activities_synced ?? 0
        setSyncResult(`✓ Synced ${synced} new activit${synced === 1 ? 'y' : 'ies'}`)
      } else {
        setSyncResult(`✗ ${data.error ?? 'Sync failed'}`)
      }
    } catch {
      setSyncResult('✗ Sync request failed')
    }
    setSyncLoading(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? 'PR'

  return (
    <AuthGuard>
      <div className="dare-page">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#6C63FF', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              {/* Avatar */}
              <div className="flex flex-col items-center mb-8">
                <div
                  className="dare-hero-mark w-20 h-20 text-2xl mb-4"
                  style={{ width: 84, height: 84, borderRadius: 28, fontSize: 28 }}
                >
                  {initials}
                </div>
                <h1 className="font-display text-3xl" style={{ color: '#fff' }}>
                  {profile?.display_name ?? profile?.username}
                </h1>
                <p className="text-sm mt-1" style={{ color: '#c4bdd6' }}>
                  @{profile?.username}
                </p>
              </div>

              {/* Stats */}
              <div className="mb-6">
                <StatsRow
                  stats={[
                    { label: 'DONE', value: profile?.challenges_won ?? 0, color: '#00FF87' },
                    { label: 'PARKED', value: 'off', color: '#8888AA' },
                    { label: 'STREAK', value: `${profile?.streak ?? 0}d`, color: '#6C63FF' },
                  ]}
                />
              </div>

              <div className="mb-8">
                <h2 className="dare-kicker mb-3">Your dares</h2>
                {ownDares.length === 0 && challenges.length === 0 ? (
                  <div className="dare-card dare-empty">
                    <h3 className="font-display text-2xl" style={{ color: '#fff' }}>No dares yet.</h3>
                    <p className="text-sm mt-2" style={{ color: '#c4bdd6' }}>Dare a friend for a good cause.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {ownDares.map((dare) => <DareCard key={dare.id} dare={dare} />)}
                    {challenges.slice(0, 5).map(c => (
                      <ChallengeCard key={c.id} challenge={c} compact />
                    ))}
                  </div>
                )}
              </div>

              {/* Integrations */}
              <div
                className="dare-card p-4 mb-6"
              >
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  INTEGRATIONS
                </h2>
                {syncResult && (
                  <div
                    className="mb-3 px-3 py-2 rounded-lg text-xs"
                    style={{
                      backgroundColor: syncResult.startsWith('✓') ? '#00FF8722' : '#FF475722',
                      color: syncResult.startsWith('✓') ? '#00FF87' : '#FF4757',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {syncResult}
                  </div>
                )}
                {ouraParam === 'connected' && (
                  <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#00FF8722', color: '#00FF87', fontFamily: "'JetBrains Mono', monospace" }}>
                    💍 Oura Ring connected successfully
                  </div>
                )}
                {ouraParam === 'error' && (
                  <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FF475722', color: '#FF4757', fontFamily: "'JetBrains Mono', monospace" }}>
                    ✗ Oura connection failed. Try again.
                  </div>
                )}
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleStravaSync}
                          disabled={syncLoading}
                          className="px-3 py-1 rounded-lg text-xs border transition-all"
                          style={{
                            color: syncLoading ? '#8888AA' : '#00FF87',
                            borderColor: syncLoading ? '#8888AA33' : '#00FF8733',
                            backgroundColor: 'transparent',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {syncLoading ? '⟳ Syncing...' : '⟳ Sync'}
                        </button>
                        <span
                          className="px-3 py-1 rounded-lg text-xs"
                          style={{ color: '#00FF87', backgroundColor: '#00FF8722', fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          ✓ Connected
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (!authUserId) return
                          setStravaLoading(true)
                          window.location.href = buildStravaAuthUrl(authUserId)
                        }}
                        disabled={stravaLoading || !authUserId}
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
                  <div className="h-px" style={{ backgroundColor: '#1A1A2E' }} />
                  {/* Oura Ring */}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💍</span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>Oura Ring</p>
                        <p className="text-xs" style={{ color: ouraConnected ? '#00FF87' : '#8888AA' }}>
                          {ouraConnected ? 'Connected — sleep & readiness synced' : 'Sleep, HRV & readiness data'}
                        </p>
                      </div>
                    </div>
                    {ouraConnected ? (
                      <span className="px-3 py-1 rounded-lg text-xs" style={{ color: '#00FF87', backgroundColor: '#00FF8722', fontFamily: "'JetBrains Mono', monospace" }}>
                        ✓ Connected
                      </span>
                    ) : (
                      <button
                        onClick={() => { if (authUserId) window.location.href = buildOuraAuthUrl(authUserId) }}
                        className="px-3 py-1 rounded-lg text-xs border transition-all"
                        style={{ color: '#9B8DFF', borderColor: '#9B8DFF55', backgroundColor: '#9B8DFF11', fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                  <div className="h-px" style={{ backgroundColor: '#1A1A2E' }} />
                  {/* Apple Health */}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🍎</span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>Apple Health</p>
                        <p className="text-xs" style={{ color: '#8888AA' }}>iOS app only</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg text-xs" style={{ color: '#8888AA', backgroundColor: '#1A1A2E', fontFamily: "'JetBrains Mono', monospace" }}>
                      Mobile
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

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="dare-btn-ghost w-full py-3 text-sm"
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
