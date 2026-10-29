import { startConnectOnboarding } from '@/lib/dare/connect'
import { appOrigin, isUser, json, requireUser } from '@/lib/dare/http'
import { getRepo, getStripe } from '@/lib/dare/runtime'

export async function POST(request: Request) {
  const user = await requireUser()
  if (!isUser(user)) return user
  const origin = appOrigin(request)
  let stripe
  try {
    stripe = getStripe()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe is not configured'
    return json({ error: message }, 503)
  }
  const result = await startConnectOnboarding({
    user,
    repo: getRepo(),
    stripe,
    refreshUrl: `${origin}/connect/mock`,
    returnUrl: `${origin}/profile?connect=return`,
  })
  if (!result.ok) return json({ error: result.error }, result.status)
  return json(result.data)
}
