'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, UserProfile } from '@/lib/supabase'
import Navbar from './Navbar'

interface AuthGuardProps {
  children: React.ReactNode
  showNav?: boolean
}

export default function AuthGuard({ children, showNav = true }: AuthGuardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState<string>()

  useEffect(() => {
    const supabase = createClient()

    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('username')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setUsername((profile as UserProfile).username)
      } else {
        setUsername(session.user.email?.split('@')[0])
      }

      setLoading(false)
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0A0A0F' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#6C63FF', borderTopColor: 'transparent' }}
          />
          <span style={{ color: '#8888AA', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem' }}>
            Loading...
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      {showNav && <Navbar username={username} />}
      {children}
    </>
  )
}
