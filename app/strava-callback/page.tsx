'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Suspense } from 'react'

function StravaCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Connecting Strava...')

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code')
      const state = searchParams.get('state') // user_id
      const error = searchParams.get('error')

      if (error || !code || !state) {
        router.replace('/profile?strava=error')
        return
      }

      try {
        // Exchange code for tokens
        const tokenRes = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: '223306',
            client_secret: '4971c3a4e53bc274bce11f4b3131fdc26341b397',
            code,
            grant_type: 'authorization_code',
          }),
        })

        if (!tokenRes.ok) {
          setStatus('Token exchange failed')
          router.replace('/profile?strava=error')
          return
        }

        const tokens = await tokenRes.json()
        setStatus('Saving...')

        // Save to Supabase
        const supabase = createClient()
        await supabase.from('user_integrations').upsert({
          user_id: state,
          provider: 'strava',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(tokens.expires_at * 1000).toISOString(),
          scope: tokens.token_type,
          provider_user_id: tokens.athlete?.id?.toString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' })

        await supabase.from('users')
          .update({ strava_connected: true, updated_at: new Date().toISOString() })
          .eq('id', state)

        router.replace('/profile?strava=connected')
      } catch (e) {
        console.error('Strava callback error:', e)
        router.replace('/profile?strava=error')
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0A0F' }}>
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#FC4C02', borderTopColor: 'transparent' }}
        />
        <p style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
          {status}
        </p>
      </div>
    </div>
  )
}

export default function StravaCallbackPage() {
  return (
    <Suspense fallback={null}>
      <StravaCallbackInner />
    </Suspense>
  )
}
