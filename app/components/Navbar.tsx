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
    { href: '/dashboard', label: 'Dares' },
    { href: '/create', label: 'Create' },
    { href: '/review', label: 'Review' },
    { href: '/profile', label: 'Profile' },
  ]

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    await fetch('/api/dev/session', { method: 'DELETE' }).catch(() => {})
    router.push('/')
    router.refresh()
  }

  const initials = username ? username.slice(0, 2).toUpperCase() : 'DA'

  return (
    <nav className="dare-nav" aria-label="Main">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: '#fff' }}>
          <span className="dare-hero-mark" style={{ width: 32, height: 32, borderRadius: 10, fontSize: 14, boxShadow: 'none' }} aria-hidden>D</span>
          DARE
        </Link>

        <div className="hidden md:flex items-center gap-1 rounded-full p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {links.map(link => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{ color: active ? '#fff' : '#c4bdd6', background: active ? 'rgba(139,124,255,0.28)' : 'transparent' }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(160deg,#d7d1ff,#6d63ff)', color: '#140f2e' }}
            aria-hidden
          >
            {initials}
          </div>
          <button type="button" onClick={handleSignOut} className="hidden md:inline-flex dare-btn-ghost text-xs px-3 py-1.5">
            Sign Out
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            style={{ color: '#c4bdd6' }}
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

      {menuOpen && (
        <div className="md:hidden border-t px-4 py-3 flex flex-col gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2 rounded-xl text-sm font-medium"
              style={{ color: pathname === link.href ? '#fff' : '#c4bdd6', background: pathname === link.href ? 'rgba(139,124,255,0.2)' : 'transparent' }}
            >
              {link.label}
            </Link>
          ))}
          <button type="button" onClick={handleSignOut} className="mt-1 px-3 py-2 rounded-xl text-sm text-left" style={{ color: '#ff8b98' }}>
            Sign Out
          </button>
        </div>
      )}
    </nav>
  )
}
