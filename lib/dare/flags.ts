export interface DareEnv {
  [key: string]: string | undefined
  DARE_PAID_MODE?: string
  DARE_STRIPE_MOCK?: string
  DARE_DEV_STORE?: string
  DARE_AI_PROVIDER?: string
  DARE_AI_API_KEY?: string
  DARE_AI_API_URL?: string
  DARE_AI_ALLOW_FIXTURES?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string
  CRON_SECRET?: string
  DARE_ADMIN_EMAILS?: string
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  NEXT_PUBLIC_APP_URL?: string
}

export function paidModeEnabled(env: DareEnv = process.env): boolean {
  return env.DARE_PAID_MODE === 'true'
}

export function supabaseConfigured(env: DareEnv = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY)
}

/** Memory store when asked, or when Supabase is not configured, so a preview deploy needs no accounts. */
export function devStoreEnabled(env: DareEnv = process.env): boolean {
  if (env.DARE_DEV_STORE === 'memory') return true
  if (env.DARE_DEV_STORE === 'supabase') return false
  return !supabaseConfigured(env)
}

/**
 * Simulated checkout when mock mode is on, or when no Stripe secret is configured.
 * Set DARE_STRIPE_MOCK=false to refuse simulated charges.
 */
export function simulatedPayments(env: DareEnv = process.env): boolean {
  if (env.DARE_STRIPE_MOCK === 'false') return false
  if (env.DARE_STRIPE_MOCK === 'true') return true
  return !env.STRIPE_SECRET_KEY
}

export function stripeMockEnabled(env: DareEnv = process.env): boolean {
  return simulatedPayments(env) && !env.STRIPE_SECRET_KEY || env.DARE_STRIPE_MOCK === 'true'
}

export function aiFixturesAllowed(env: DareEnv = process.env): boolean {
  return env.DARE_AI_ALLOW_FIXTURES === 'true'
}

export function adminEmails(env: DareEnv = process.env): string[] {
  return (env.DARE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined, env: DareEnv = process.env): boolean {
  if (!email) return false
  return adminEmails(env).includes(email.toLowerCase())
}
