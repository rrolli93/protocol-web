/** Only same-origin paths. Blocks open redirects. */
export function safeNextPath(input: string | null | undefined, fallback = '/dashboard'): string {
  if (!input) return fallback
  const value = input.trim()
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback
  if (value.includes('\\') || value.includes('://') || value.includes('\n') || value.includes('\r')) return fallback
  return value
}

export function handleFromEmail(email: string): string {
  const local = (email.split('@')[0] ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '')
  const trimmed = local.slice(0, 20)
  if (trimmed.length >= 3) return trimmed
  return `friend${trimmed}`.slice(0, 20)
}

export function googleCallbackUrl(origin: string, next: string | null | undefined): string {
  const path = safeNextPath(next)
  return `${origin.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent(path)}`
}

/** First Google login still needs an 18+ confirmation and a handle check. */
export function afterGoogleLogin(args: { ageConfirmed: boolean; next: string | null | undefined }): string {
  const next = safeNextPath(args.next)
  if (!args.ageConfirmed) return `/welcome?next=${encodeURIComponent(next)}`
  return next
}
