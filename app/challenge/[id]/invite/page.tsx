// Server component — data fetches on the server, zero loading state for users
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import InviteClient from './InviteClient'

const SUPABASE_URL = 'https://zxfzivelglmewzlmvsbp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4ZnppdmVsZ2xtZXd6bG12c2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDM4NzMsImV4cCI6MjA5MTQxOTg3M30.QIzifYDtFFdf520YrTGgylP7XrFc20LSkyTSLSHcQwk'

async function getServerClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {}
      },
    },
  })
}

// Server-side data fetch
async function getChallengeData(id: string) {
  const supabase = await getServerClient()

  const { data: challenge, error } = await supabase
    .from('challenges')
    .select('id, title, description, pillar, stake_per_user, starts_at, ends_at, status, goal_value, goal_unit, goal_frequency, creator_id, cover_emoji, max_participants')
    .eq('id', id)
    .single()

  if (error || !challenge) return null

  const { data: participants } = await supabase
    .from('challenge_participants')
    .select('user_id, current_score, joined_at')
    .eq('challenge_id', id)

  const userIds = (participants ?? []).map(p => p.user_id)
  let users: { id: string; username: string }[] = []
  if (userIds.length > 0) {
    const { data } = await supabase
      .from('users')
      .select('id, username')
      .in('id', userIds)
    users = data ?? []
  }

  const usernameMap = Object.fromEntries(users.map(u => [u.id, u.username]))

  const leaderboard = (participants ?? [])
    .map(p => ({
      user_id: p.user_id,
      username: usernameMap[p.user_id] ?? 'Anonymous',
      current_score: p.current_score ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.current_score - a.current_score)
    .slice(0, 3)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))

  return {
    challenge,
    leaderboard,
    participantCount: participants?.length ?? 0,
  }
}

// Dynamic metadata for link previews (WhatsApp, Twitter, iMessage)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await getChallengeData(id)
  if (!data) return { title: 'Protocol — Fitness Challenge' }

  const { challenge, participantCount } = data
  const pot = (challenge.stake_per_user ?? 0) * participantCount
  const pillarEmoji = challenge.cover_emoji ?? '🏆'

  return {
    title: `${pillarEmoji} ${challenge.title} — $${pot} USDC Pot`,
    description: `${participantCount} athletes competing. Stake $${challenge.stake_per_user} USDC. Win when you hit your goal. Powered by Protocol.`,
    openGraph: {
      title: `${challenge.title} — $${pot} USDC Pot`,
      description: challenge.description ?? `${participantCount} athletes. $${challenge.stake_per_user} stake. Win the pot.`,
      siteName: 'Protocol',
    },
    twitter: {
      card: 'summary',
      title: `${challenge.title} — $${pot} pot`,
      description: `${participantCount} competing · $${challenge.stake_per_user} stake · Protocol`,
    },
  }
}

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getChallengeData(id)

  if (!data) notFound()

  return (
    <InviteClient
      challenge={data.challenge}
      leaderboard={data.leaderboard}
      participantCount={data.participantCount}
      challengeId={id}
    />
  )
}
