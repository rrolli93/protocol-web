'use client'

import { useEffect, useState } from 'react'
import { createClient, Challenge, MOCK_CHALLENGES, PILLARS } from '@/lib/supabase'
import AuthGuard from '@/app/components/AuthGuard'
import ChallengeCard from '@/app/components/ChallengeCard'
import { useRouter } from 'next/navigation'

export default function ExplorePage() {
  const router = useRouter()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [filtered, setFiltered] = useState<Challenge[]>([])
  const [search, setSearch] = useState('')
  const [activePillar, setActivePillar] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50)

      const list = (data ?? []) as Challenge[]
      const result = list.length > 0 ? list : MOCK_CHALLENGES
      setChallenges(result)
      setFiltered(result)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    let result = challenges
    if (activePillar !== 'all') {
      result = result.filter(c => c.pillar?.toLowerCase() === activePillar)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [search, activePillar, challenges])

  async function handleJoin(challengeId: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { error } = await supabase.from('challenge_participants').insert({
      challenge_id: challengeId,
      user_id: session.user.id,
      progress: 0,
      joined_at: new Date().toISOString(),
    })

    if (!error) {
      router.push(`/challenge/${challengeId}`)
    }
  }

  const pillars = [{ key: 'all', label: 'All', emoji: '🔥' }, ...PILLARS]

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <h1
              className="text-xl font-bold mb-1"
              style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
            >
              Explore Challenges
            </h1>
            <p className="text-sm" style={{ color: '#8888AA' }}>
              Find your next challenge and put money on it
            </p>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search challenges..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: '#0D0D1A',
                border: '1px solid #1A1A2E',
                color: '#ffffff',
                fontFamily: "'Inter', sans-serif",
              }}
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: '#8888AA' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
            </svg>
          </div>

          {/* Pillar filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            {pillars.map(p => (
              <button
                key={p.key}
                onClick={() => setActivePillar(p.key)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium shrink-0 transition-all"
                style={{
                  backgroundColor: activePillar === p.key ? '#6C63FF' : '#0D0D1A',
                  color: activePillar === p.key ? '#ffffff' : '#8888AA',
                  border: `1px solid ${activePillar === p.key ? '#6C63FF' : '#1A1A2E'}`,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <span>{p.emoji}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Count */}
          <p className="text-xs mb-4" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
            {filtered.length} challenge{filtered.length !== 1 ? 's' : ''} found
          </p>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="h-44 rounded-xl animate-pulse"
                  style={{ backgroundColor: '#0D0D1A' }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔍</div>
              <p style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>No challenges found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map(c => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  showJoin
                  onJoin={handleJoin}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
