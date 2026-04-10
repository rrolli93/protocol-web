'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, PILLARS } from '@/lib/supabase'
import AuthGuard from '@/app/components/AuthGuard'

const DURATIONS = [7, 14, 30, 60]
const STAKES = [5, 10, 25, 50]

export default function CreatePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [pillar, setPillar] = useState('')
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [duration, setDuration] = useState(30)
  const [isPublic, setIsPublic] = useState(true)
  const [stake, setStake] = useState(25)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalSteps = 4
  const selectedPillar = PILLARS.find(p => p.key === pillar)

  async function handleDeploy() {
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data, error: insertError } = await supabase
      .from('challenges')
      .insert({
        name,
        pillar,
        goal,
        duration_days: duration,
        is_public: isPublic,
        stake_amount: stake,
        status: 'active',
        creator_id: session.user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const challenge = data as any
    await supabase.from('challenge_participants').insert({
      challenge_id: challenge.id,
      user_id: session.user.id,
      progress: 0,
      joined_at: new Date().toISOString(),
    })

    router.push(`/challenge/${challenge.id}`)
  }

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-md mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#8888AA' }}
              >
                ←
              </button>
            )}
            <div>
              <h1
                className="text-xl font-bold"
                style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Create Challenge
              </h1>
              <p className="text-xs" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                Step {step + 1} of {totalSteps}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 rounded-full mb-8" style={{ backgroundColor: '#1A1A2E' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / totalSteps) * 100}%`, backgroundColor: '#6C63FF' }}
            />
          </div>

          {/* Step 0: Pillar */}
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2" style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                What pillar?
              </h2>
              <p className="text-sm mb-6" style={{ color: '#8888AA' }}>Choose the type of challenge</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {PILLARS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPillar(p.key)}
                    className="rounded-xl p-5 flex flex-col items-center gap-2 border transition-all"
                    style={{
                      backgroundColor: pillar === p.key ? `${p.color}18` : '#0D0D1A',
                      borderColor: pillar === p.key ? p.color : '#1A1A2E',
                    }}
                  >
                    <span className="text-3xl">{p.emoji}</span>
                    <span
                      className="font-semibold text-sm"
                      style={{ color: pillar === p.key ? p.color : '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                disabled={!pillar}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#6C63FF', color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 1: Details */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold mb-6" style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                {selectedPillar?.emoji} Challenge Details
              </h2>

              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                    NAME
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. 30-Day Morning Run"
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E', color: '#ffffff', fontFamily: "'Inter', sans-serif" }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                    GOAL
                  </label>
                  <textarea
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    placeholder="e.g. Run 5km every morning"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                    style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E', color: '#ffffff', fontFamily: "'Inter', sans-serif" }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                    DURATION
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {DURATIONS.map(d => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className="py-2 rounded-lg text-sm font-medium border transition-all"
                        style={{
                          backgroundColor: duration === d ? '#6C63FF' : '#0D0D1A',
                          borderColor: duration === d ? '#6C63FF' : '#1A1A2E',
                          color: duration === d ? '#ffffff' : '#8888AA',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                    Public Challenge
                  </span>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className="w-12 h-6 rounded-full transition-colors relative"
                    style={{ backgroundColor: isPublic ? '#6C63FF' : '#1A1A2E' }}
                  >
                    <div
                      className="w-5 h-5 rounded-full absolute top-0.5 transition-all"
                      style={{ backgroundColor: '#ffffff', left: isPublic ? '26px' : '2px' }}
                    />
                  </button>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!name.trim() || !goal.trim()}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#6C63FF', color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: Stake */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold mb-2" style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                Choose your stake
              </h2>
              <p className="text-sm mb-6" style={{ color: '#8888AA' }}>
                How much USDC are you willing to bet on yourself?
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {STAKES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStake(s)}
                    className="py-5 rounded-xl border flex flex-col items-center gap-1 transition-all"
                    style={{
                      backgroundColor: stake === s ? 'rgba(0,255,135,0.1)' : '#0D0D1A',
                      borderColor: stake === s ? '#00FF87' : '#1A1A2E',
                    }}
                  >
                    <span
                      className="text-2xl font-bold"
                      style={{ color: stake === s ? '#00FF87' : '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      ${s}
                    </span>
                    <span className="text-xs" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                      USDC
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(3)}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                style={{ backgroundColor: '#6C63FF', color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold mb-6" style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                Confirm & Deploy
              </h2>

              <div className="rounded-xl border p-4 mb-6 flex flex-col gap-3" style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}>
                {[
                  { label: 'Pillar', value: `${selectedPillar?.emoji} ${selectedPillar?.label}` },
                  { label: 'Name', value: name },
                  { label: 'Goal', value: goal },
                  { label: 'Duration', value: `${duration} days` },
                  { label: 'Visibility', value: isPublic ? '🌐 Public' : '🔒 Private' },
                  { label: 'Stake', value: `$${stake} USDC` },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-start gap-4">
                    <span className="text-xs shrink-0" style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.label.toUpperCase()}
                    </span>
                    <span className="text-sm text-right" style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm px-3 py-2 rounded-lg mb-4" style={{ color: '#FF4757', backgroundColor: 'rgba(255,71,87,0.1)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {error}
                </p>
              )}

              <button
                onClick={handleDeploy}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: '#00FF87', color: '#0A0A0F', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {loading ? 'Deploying...' : '🚀 Deploy Challenge'}
              </button>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
