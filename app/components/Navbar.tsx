'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

interface NavbarProps {
  username?: string
}

export default function Navbar({ username }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/explore', label: 'Explore' },
    { href: '/create', label: '+ Create' },
    { href: '/profile', label: 'Profile' },
  ]

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const initials = username ? username.slice(0, 2).toUpperCase() : 'PR'

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-bold text-lg tracking-widest"
          style={{ color: '#6C63FF', fontFamily: "'JetBrains Mono', monospace" }}
        >
          ⬡ PROTOCOL
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: pathname === link.href ? '#6C63FF' : '#8888AA',
                backgroundColor: pathname === link.href ? 'rgba(108,99,255,0.1)' : 'transparent',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Avatar + sign out */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
            style={{ backgroundColor: '#6C63FF', color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {initials}
          </div>
          <button
            onClick={handleSignOut}
            className="hidden md:block text-xs px-3 py-1.5 rounded-lg border transition-colors hover:border-purple-500"
            style={{ color: '#8888AA', borderColor: '#1A1A2E', fontFamily: "'JetBrains Mono', monospace" }}
          >
            Sign Out
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-1.5 rounded-lg"
            style={{ color: '#8888AA' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t px-4 py-3 flex flex-col gap-1" style={{ borderColor: '#1A1A2E' }}>
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{
                color: pathname === link.href ? '#6C63FF' : '#8888AA',
                backgroundColor: pathname === link.href ? 'rgba(108,99,255,0.1)' : 'transparent',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={handleSignOut}
            className="mt-2 px-3 py-2 rounded-lg text-sm text-left"
            style={{ color: '#FF4757', fontFamily: "'JetBrains Mono', monospace" }}
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  )
}
