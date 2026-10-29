import type { DareRepo } from './repo'
import type { StripePort } from './stripe-port'
import { isAtLeast18 } from './validation'
import { fail, ok, type Result, type User } from './types'

export async function startConnectOnboarding(args: {
  user: User
  repo: DareRepo
  stripe: StripePort
  refreshUrl: string
  returnUrl: string
}): Promise<Result<{ url: string; accountId: string }>> {
  if (!args.user.ageConfirmed || !isAtLeast18(args.user.dob)) {
    return fail(403, 'You need to confirm you are 18 or older')
  }
  let accountId = args.user.stripeAccountId
  if (!accountId) {
    const account = await args.stripe.createExpressAccount({ userId: args.user.id, country: args.user.country ?? 'CH' })
    accountId = account.id
    await args.repo.setStripeAccount(args.user.id, accountId)
  }
  const link = await args.stripe.createAccountLink({
    accountId,
    refreshUrl: args.refreshUrl,
    returnUrl: args.returnUrl,
  })
  await args.repo.logEvent(null, 'connect_onboarding', { userId: args.user.id, accountId })
  return ok({ url: link.url, accountId })
}
