import { dareProgress } from '@/lib/dare/present'
import { isAtLeast18 } from '@/lib/dare/validation'
import { isUser, json, requireUser } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'

export async function GET() {
  const user = await requireUser()
  if (!isUser(user)) return user
  const repo = getRepo()
  const rows = await repo.listDaresForUser(user.id)
  const dares = await Promise.all(rows.map(async (dare) => {
    const fundings = await repo.listFundings(dare.id)
    const counted = fundings.filter((row) => row.status !== 'refunded')
    const bountyCents = fundings
      .filter((row) => row.status === 'captured' || row.status === 'transferred' || row.status === 'donated')
      .reduce((sum, row) => sum + row.amountCents, 0)
    return {
      id: dare.id,
      title: dare.title,
      status: dare.status,
      mode: dare.mode,
      category: dare.category,
      deadlineAt: dare.deadlineAt,
      bountyCents,
      funderCount: new Set(counted.map((row) => row.funderId)).size,
      progress: dareProgress(dare.status),
    }
  }))
  return json({ user, dares })
}

export async function PATCH(request: Request) {
  const user = await requireUser()
  if (!isUser(user)) return user
  const body = await request.json().catch(() => ({})) as {
    handle?: string
    displayName?: string
    dob?: string
    ageConfirmed?: boolean
    country?: string
  }
  const dob = body.dob ?? user.dob
  const ageConfirmed = body.ageConfirmed === true || user.ageConfirmed
  if (body.ageConfirmed === true && !isAtLeast18(dob)) {
    return json({ error: 'You must be 18 or older' }, 400)
  }
  const handle = (body.handle ?? user.handle).trim().toLowerCase().replace(/\s/g, '')
  if (handle.length < 3) return json({ error: 'Handle must be at least 3 characters' }, 400)
  const next = {
    ...user,
    handle,
    displayName: (body.displayName ?? user.displayName).trim() || handle,
    dob: dob ?? null,
    ageConfirmed: ageConfirmed && isAtLeast18(dob),
    country: body.country ?? user.country,
    isAdmin: user.isAdmin,
    payoutsEnabled: user.payoutsEnabled,
    stripeAccountId: user.stripeAccountId,
  }
  await getRepo().upsertUser(next)
  return json({ user: next })
}
