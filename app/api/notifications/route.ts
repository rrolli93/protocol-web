import { isUser, json, requireUser } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'

export async function GET() {
  const user = await requireUser()
  if (!isUser(user)) return user
  const notifications = await getRepo().listNotifications(user.id)
  return json({ notifications })
}
