'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, PILLARS } from '@/lib/supabase'
import { buildStravaAuthUrl } from '@/lib/strava'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selectedPillars, setSelectedPillars] = useState<string[]>([])
  const [authUserId, setAuthUserId] = useState<string>('')
  const [stravaLoading, setStravaLoading] = useState(false)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        setAuthUserId(session.user.id)
      }
    }
    loadUser()
  }, [])

  const totalSteps = 3

  function togglePillar(key: string) {
    setSelectedPillars(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    )
  }

  function handleNext() {
    if (step < totalSteps - 1) setStep(s => s + 1)
    else router.push('/dashboard')
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#0A0A0F' }}
    >
      <div className="w-full max-w-sm">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === step ? '24px' : '8px',
                height: '8px',
                backgroundColor: i <= step ? '#6C63FF' : '#1A1A2E',
              }}
            />
          ))}
        </div>

        {/* Step 0: Pick Pillars */}
        {step === 0 && (
          <div>
            <div className="text-center mb-6">
              <h2
                className="text-2xl font-bold"
                style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Choose your pillars
              </h2>
              <p className="mt-2 text-sm" style={{ color: '#8888AA' }}>
                What will you challenge yourself on?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {PILLARS.map(pillar => {
                const selected = selectedPillars.includes(pillar.key)
                return (
                  <button
                    key={pillar.key}
                    onClick={() => togglePillar(pillar.key)}
                    className="rounded-xl p-4 flex flex-col items-center gap-2 border transition-all"
                    style={{
                      backgroundColor: selected ? `${pillar.color}18` : '#0D0D1A',
                      borderColor: selected ? pillar.color : '#1A1A2E',
                    }}
                  >
                    <span className="text-3xl">{pillar.emoji}</span>
                    <span
                      className="font-semibold text-sm"
                      style={{ color: selected ? pillar.color : '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {pillar.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleNext}
              disabled={selectedPillars.length === 0}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
              style={{
                backgroundColor: '#6C63FF',
                color: '#ffffff',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 1: Connect Strava */}
        {step === 1 && (
          <div>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🏃</div>
              <h2
                className="text-2xl font-bold"
                style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Connect Strava
              </h2>
              <p className="mt-2 text-sm" style={{ color: '#8888AA' }}>
                Auto-track your runs, rides, and workouts
              </p>
            </div>

            <div
              className="rounded-xl p-4 mb-4 border text-center"
              style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}
            >
              <div className="text-4xl mb-2">🟠</div>
              <p className="text-sm font-medium" style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                Strava Integration
              </p>
              <p className="text-xs mt-1" style={{ color: '#8888AA' }}>
                Auto-track your runs, rides, and workouts
              </p>
            </div>

            <button
              onClick={() => {
                if (!authUserId) return
                setStravaLoading(true)
                window.location.href = buildStravaAuthUrl(authUserId)
              }}
              disabled={stravaLoading || !authUserId}
              className="w-full py-3 rounded-xl font-semibold text-sm mb-3 transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              style={{
                backgroundColor: '#FC4C02',
                color: '#ffffff',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {stravaLoading ? 'Connecting...' : '🔗 Connect Strava'}
            </button>
            <button
              onClick={handleNext}
              className="w-full py-2.5 rounded-xl font-medium text-sm transition-colors hover:text-white"
              style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
            >
              Skip for now →
            </button>
          </div>
        )}

        {/* Step 2: You're in! */}
        {step === 2 && (
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2
              className="text-2xl font-bold mb-2"
              style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
            >
              You're in!
            </h2>
            <p className="text-sm mb-2" style={{ color: '#8888AA' }}>
              Your account is ready. Time to bet on yourself.
            </p>

            <div className="flex flex-col gap-2 mb-8 mt-6">
              {[
                '✅ Account created',
                selectedPillars.length > 0 ? `✅ Pillars: ${selectedPillars.join(', ')}` : '⬜ Pillars selected',
                '⬜ First challenge joined',
              ].map((item, i) => (
                <div
                  key={i}
                  className="text-left px-4 py-2.5 rounded-lg text-sm"
                  style={{ backgroundColor: '#0D0D1A', color: '#8888AA', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {item}
                </div>
              ))}
            </div>

            <button
              onClick={handleNext}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
              style={{
                backgroundColor: '#00FF87',
                color: '#0A0A0F',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Go to Dashboard →
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
