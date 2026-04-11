'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthGuard from '@/app/components/AuthGuard'
import { PILLARS, getDefaultTemplate, suggestChallengeName, type PillarTemplate } from '@/lib/pillars'

const DURATIONS = [7, 14, 21, 30, 60, 90]
const STAKES = [5, 10, 25, 50, 100]

const PAYOUT_INFO = `Winner-takes-all: the pot is split equally among all participants who meet their goal by the end date. 2% goes to Protocol. If no one completes the challenge, stakes are refunded.`

export default function CreatePage() {
  const router = useRouter()

  // Step state
  const [step, setStep] = useState(0)
  const TOTAL_STEPS = 5

  // Step 0: Pillar
  const [pillar, setPillar] = useState('')

  // Step 1: Goal (structured)
  const [template, setTemplate] = useState<PillarTemplate | null>(null)
  const [goalValue, setGoalValue] = useState<number>(0)
  const [goalUnit, setGoalUnit] = useState('')
  const [goalFrequency, setGoalFrequency] = useState<'daily' | 'weekly' | 'total'>('daily')

  // Step 2: Setup
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(30)
  const [customDuration, setCustomDuration] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [coverEmoji, setCoverEmoji] = useState('')

  // Step 3: Stake
  const [stake, setStake] = useState(25)
  const [customStake, setCustomStake] = useState('')

  // Step 4: Invite (post-deploy)
  const [deployedId, setDeployedId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedPillar = PILLARS.find(p => p.key === pillar)
  const effectiveDuration = customDuration ? parseInt(customDuration) : duration
  const effectiveStake = customStake ? parseFloat(customStake) : stake

  // Auto-populate when pillar is chosen
  useEffect(() => {
    if (!pillar) return
    const t = getDefaultTemplate(pillar)
    if (t) {
      setTemplate(t)
      setGoalValue(t.defaultValue)
      setGoalUnit(t.unit)
      setGoalFrequency(t.frequency)
    }
    setCoverEmoji(selectedPillar?.emoji ?? '')
  }, [pillar, selectedPillar?.emoji])

  // Auto-suggest name when goal/duration changes
  useEffect(() => {
    if (!pillar || !goalValue) return
    setName(suggestChallengeName(pillar, effectiveDuration, goalValue, goalUnit))
  }, [pillar, goalValue, goalUnit, effectiveDuration])

  function handlePreset(ex: { value: number; difficulty: string }) {
    setGoalValue(ex.value)
  }

  async function handleDeploy() {
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const now = new Date()
    const endsAt = new Date(now.getTime() + effectiveDuration * 24 * 60 * 60 * 1000)

    const { data, error: insertError } = await supabase
      .from('challenges')
      .insert({
        title: name.trim(),
        description: `${goalValue} ${goalUnit}/${goalFrequency === 'daily' ? 'day' : goalFrequency === 'weekly' ? 'week' : 'total'}`,
        pillar,
        goal_value: goalValue,
        goal_unit: goalUnit,
        goal_frequency: goalFrequency,
        duration_days: effectiveDuration,
        is_public: isPublic,
        stake_per_user: effectiveStake,
        status: 'active',
        creator_id: session.user.id,
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        cover_emoji: coverEmoji || selectedPillar?.emoji,
        max_participants: 0,
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
      current_score: 0,
    })

    setDeployedId(challenge.id)
    setInviteCode(challenge.invite_code)
    setLoading(false)
    setStep(4) // Invite step
  }

  function copyInviteLink() {
    if (!deployedId) return
    const url = `${window.location.origin}/challenge/${deployedId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const card = 'rounded-xl border p-4'
  const cardStyle = { backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }
  const mono = { fontFamily: "'JetBrains Mono', monospace" }

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-lg mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            {step > 0 && step < 4 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="p-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: '#8888AA' }}
              >
                ← Back
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#ffffff', ...mono }}>
                {step < 4 ? 'Create Challenge' : '🚀 Challenge Live'}
              </h1>
              {step < 4 && (
                <p className="text-xs mt-0.5" style={{ color: '#8888AA', ...mono }}>
                  Step {step + 1} of {TOTAL_STEPS}
                </p>
              )}
            </div>
          </div>

          {/* Progress dots */}
          {step < 4 && (
            <div className="flex gap-2 mb-8">
              {Array.from({ length: TOTAL_STEPS - 1 }).map((_, i) => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{ backgroundColor: i <= step ? '#6C63FF' : '#1A1A2E' }}
                />
              ))}
            </div>
          )}

          {/* ─── Step 0: Pillar ─── */}
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: '#ffffff', ...mono }}>What are you training?</h2>
              <p className="text-sm mb-6" style={{ color: '#8888AA' }}>Choose your challenge category</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {PILLARS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPillar(p.key)}
                    className="rounded-xl p-5 flex flex-col items-center gap-2 border transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      backgroundColor: pillar === p.key ? `${p.color}18` : '#0D0D1A',
                      borderColor: pillar === p.key ? p.color : '#1A1A2E',
                    }}
                  >
                    <span className="text-3xl">{p.emoji}</span>
                    <span className="font-semibold text-sm" style={{ color: pillar === p.key ? p.color : '#ffffff', ...mono }}>
                      {p.label}
                    </span>
                    <span className="text-xs text-center" style={{ color: '#8888AA', lineHeight: 1.3 }}>
                      via {p.dataSource.slice(0, 2).join(', ')}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                disabled={!pillar}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ─── Step 1: Goal ─── */}
          {step === 1 && template && (
            <div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: '#ffffff', ...mono }}>
                {selectedPillar?.emoji} Set your goal
              </h2>
              <p className="text-sm mb-6" style={{ color: '#8888AA' }}>
                {template.description}
              </p>

              {/* Preset difficulty options */}
              <div className="flex gap-2 mb-5">
                {template.examples.map(ex => (
                  <button
                    key={ex.label}
                    onClick={() => handlePreset(ex)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all"
                    style={{
                      backgroundColor: goalValue === ex.value ? '#6C63FF' : '#0D0D1A',
                      borderColor: goalValue === ex.value ? '#6C63FF' : '#1A1A2E',
                      color: goalValue === ex.value ? '#ffffff' : '#8888AA',
                      ...mono,
                    }}
                  >
                    {ex.difficulty.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Value input */}
              <div className={`${card} mb-4`} style={cardStyle}>
                <label className="block text-xs mb-2" style={{ color: '#8888AA', letterSpacing: '0.1em', ...mono }}>
                  {template.label.toUpperCase()}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setGoalValue(v => Math.max(template.min, parseFloat((v - template.step).toFixed(2))))}
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold border transition-colors hover:bg-white/5"
                    style={{ borderColor: '#1A1A2E', color: '#8888AA' }}
                  >−</button>
                  <div className="flex-1 text-center">
                    <span className="text-4xl font-black" style={{ color: '#ffffff', ...mono }}>
                      {goalValue.toLocaleString()}
                    </span>
                    <span className="text-lg ml-2" style={{ color: '#6C63FF', ...mono }}>{goalUnit}</span>
                  </div>
                  <button
                    onClick={() => setGoalValue(v => Math.min(template.max, parseFloat((v + template.step).toFixed(2))))}
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold border transition-colors hover:bg-white/5"
                    style={{ borderColor: '#1A1A2E', color: '#8888AA' }}
                  >+</button>
                </div>
                <p className="text-xs mt-3 text-center" style={{ color: '#8888AA' }}>
                  per {goalFrequency}
                </p>
              </div>

              {/* Verification method */}
              <div className="flex items-start gap-2 px-1 mb-6">
                <span className="text-sm">🔍</span>
                <p className="text-xs" style={{ color: '#8888AA' }}>
                  <span style={{ color: '#6C63FF' }}>Verified by: </span>
                  {template.verificationMethod}
                </p>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={goalValue <= 0}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ─── Step 2: Setup ─── */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold mb-6" style={{ color: '#ffffff', ...mono }}>
                {selectedPillar?.emoji} Challenge Setup
              </h2>

              <div className="flex flex-col gap-4 mb-6">
                {/* Name */}
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#8888AA', letterSpacing: '0.1em', ...mono }}>NAME</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={60}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E', color: '#ffffff', fontFamily: "'Inter', sans-serif" }}
                  />
                  <p className="text-xs mt-1 text-right" style={{ color: '#8888AA' }}>{name.length}/60</p>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#8888AA', letterSpacing: '0.1em', ...mono }}>DURATION</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {DURATIONS.map(d => (
                      <button
                        key={d}
                        onClick={() => { setDuration(d); setCustomDuration('') }}
                        className="py-2 rounded-lg text-sm font-medium border transition-all"
                        style={{
                          backgroundColor: duration === d && !customDuration ? '#6C63FF' : '#0D0D1A',
                          borderColor: duration === d && !customDuration ? '#6C63FF' : '#1A1A2E',
                          color: duration === d && !customDuration ? '#ffffff' : '#8888AA',
                          ...mono,
                        }}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                  <input
                    value={customDuration}
                    onChange={e => setCustomDuration(e.target.value.replace(/\D/g, ''))}
                    placeholder="Or type custom (days)"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: '#0D0D1A', border: `1px solid ${customDuration ? '#6C63FF' : '#1A1A2E'}`, color: '#ffffff', fontFamily: "'Inter', sans-serif" }}
                  />
                </div>

                {/* Public toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#ffffff', ...mono }}>Public Challenge</p>
                    <p className="text-xs" style={{ color: '#8888AA' }}>
                      {isPublic ? 'Anyone can discover and join' : 'Join by invite link only'}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className="w-12 h-6 rounded-full transition-colors relative"
                    style={{ backgroundColor: isPublic ? '#6C63FF' : '#1A1A2E' }}
                  >
                    <div className="w-5 h-5 rounded-full absolute top-0.5 transition-all" style={{ backgroundColor: '#ffffff', left: isPublic ? '26px' : '2px' }} />
                  </button>
                </div>
              </div>

              <button
                onClick={() => setStep(3)}
                disabled={!name.trim() || effectiveDuration < 1}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ─── Step 3: Stake ─── */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: '#ffffff', ...mono }}>Set your stake</h2>
              <p className="text-sm mb-6" style={{ color: '#8888AA' }}>
                How much USDC are you betting on yourself?
              </p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {STAKES.map(s => (
                  <button
                    key={s}
                    onClick={() => { setStake(s); setCustomStake('') }}
                    className="py-5 rounded-xl border flex flex-col items-center gap-1 transition-all"
                    style={{
                      backgroundColor: stake === s && !customStake ? 'rgba(0,255,135,0.1)' : '#0D0D1A',
                      borderColor: stake === s && !customStake ? '#00FF87' : '#1A1A2E',
                    }}
                  >
                    <span className="text-xl font-bold" style={{ color: stake === s && !customStake ? '#00FF87' : '#ffffff', ...mono }}>
                      ${s}
                    </span>
                    <span className="text-xs" style={{ color: '#8888AA', ...mono }}>USDC</span>
                  </button>
                ))}
              </div>

              <div className="mb-5">
                <input
                  value={customStake}
                  onChange={e => setCustomStake(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Custom amount (USDC)"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: '#0D0D1A', border: `1px solid ${customStake ? '#00FF87' : '#1A1A2E'}`, color: '#ffffff', fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              {/* Payout explanation */}
              <div className={`${card} mb-6`} style={cardStyle}>
                <p className="text-xs" style={{ color: '#8888AA', lineHeight: 1.6 }}>
                  💡 {PAYOUT_INFO}
                </p>
              </div>

              {/* Confirm summary */}
              <div className={`${card} mb-6`} style={cardStyle}>
                {[
                  { label: 'PILLAR', value: `${selectedPillar?.emoji} ${selectedPillar?.label}` },
                  { label: 'GOAL', value: `${goalValue} ${goalUnit}/${goalFrequency === 'daily' ? 'day' : goalFrequency === 'weekly' ? 'week' : 'total'}` },
                  { label: 'DURATION', value: `${effectiveDuration} days` },
                  { label: 'VISIBILITY', value: isPublic ? '🌐 Public' : '🔒 Private' },
                  { label: 'STAKE', value: `$${effectiveStake} USDC` },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b last:border-b-0" style={{ borderColor: '#1A1A2E' }}>
                    <span className="text-xs" style={{ color: '#8888AA', ...mono }}>{item.label}</span>
                    <span className="text-sm font-medium" style={{ color: '#ffffff', ...mono }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm px-3 py-2 rounded-lg mb-4" style={{ color: '#FF4757', backgroundColor: 'rgba(255,71,87,0.1)', ...mono }}>
                  ✗ {error}
                </p>
              )}

              <button
                onClick={handleDeploy}
                disabled={loading || effectiveStake <= 0}
                className="w-full py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: '#00FF87', color: '#0A0A0F', ...mono }}
              >
                {loading ? 'Deploying...' : '🚀 Deploy Challenge'}
              </button>
            </div>
          )}

          {/* ─── Step 4: Share / Invite ─── */}
          {step === 4 && deployedId && (
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#ffffff', ...mono }}>Challenge is live!</h2>
              <p className="text-sm mb-8" style={{ color: '#8888AA' }}>
                Share the link to invite others. The more who join, the bigger the pot.
              </p>

              {/* Invite link */}
              <div className={`${card} mb-4 text-left`} style={cardStyle}>
                <p className="text-xs mb-2" style={{ color: '#8888AA', ...mono }}>INVITE LINK</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/challenge/${deployedId}`}
                    className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ backgroundColor: '#0A0A0F', border: '1px solid #1A1A2E', color: '#8888AA', fontFamily: 'monospace' }}
                  />
                  <button
                    onClick={copyInviteLink}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{ backgroundColor: copied ? '#00FF8722' : '#6C63FF22', color: copied ? '#00FF87' : '#6C63FF', border: `1px solid ${copied ? '#00FF8733' : '#6C63FF33'}`, ...mono }}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                {inviteCode && (
                  <p className="text-xs mt-2" style={{ color: '#8888AA', ...mono }}>
                    Code: <span style={{ color: '#6C63FF' }}>{inviteCode}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-3 mb-6">
                <a
                  href={`https://twitter.com/intent/tweet?text=I just staked $${effectiveStake} on a ${effectiveDuration}-day ${selectedPillar?.label} challenge on Protocol — join me!&url=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin + '/challenge/' + deployedId) : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border text-center transition-all hover:opacity-90"
                  style={{ color: '#ffffff', borderColor: '#1A1A2E', backgroundColor: '#0D0D1A', ...mono }}
                >
                  𝕏 Share on X
                </a>
                <a
                  href={`https://t.me/share/url?url=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin + '/challenge/' + deployedId) : ''}&text=Join my Protocol challenge — $${effectiveStake} stake!`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border text-center transition-all hover:opacity-90"
                  style={{ color: '#ffffff', borderColor: '#1A1A2E', backgroundColor: '#0D0D1A', ...mono }}
                >
                  ✈️ Telegram
                </a>
              </div>

              <button
                onClick={() => router.push(`/challenge/${deployedId}`)}
                className="w-full py-3 rounded-xl font-semibold text-sm"
                style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}
              >
                View Challenge →
              </button>
            </div>
          )}

        </div>
      </div>
    </AuthGuard>
  )
}
