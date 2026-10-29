import { newId, type DareRepo } from './repo'
import type { DareEnv } from './flags'
import type { User } from './types'

export interface EmailMessage {
  to: string
  subject: string
  text: string
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>
}

export function createEmailSender(env: DareEnv = process.env, fetchImpl: typeof fetch = fetch): EmailSender {
  if (env.DARE_EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY && env.DARE_EMAIL_FROM) {
    const key = env.RESEND_API_KEY
    const from = env.DARE_EMAIL_FROM
    return {
      async send(message) {
        const response = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
        })
        if (!response.ok) throw new Error(`email provider returned ${response.status}`)
      },
    }
  }
  return { async send() {} }
}

export async function notify(
  repo: DareRepo,
  users: Array<Pick<User, 'id' | 'email'> | null | undefined>,
  note: { dareId: string | null; type: string; title: string; body: string },
  email: EmailSender = createEmailSender(),
): Promise<void> {
  const seen = new Set<string>()
  for (const user of users) {
    if (!user || seen.has(user.id)) continue
    seen.add(user.id)
    await repo.addNotification({
      id: newId(),
      userId: user.id,
      dareId: note.dareId,
      type: note.type,
      title: note.title,
      body: note.body,
      createdAt: new Date().toISOString(),
    })
    if (!user.email) continue
    try {
      await email.send({ to: user.email, subject: note.title, text: note.body })
    } catch {
      // Email is optional. The in-app row is the record.
    }
  }
}
