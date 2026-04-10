import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client for Client Components
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Types
export interface Challenge {
  id: string
  name: string
  pillar: string
  goal: string
  duration_days: number
  stake_amount: number
  is_public: boolean
  status: string
  creator_id: string
  created_at: string
  participants_count?: number
  pot_amount?: number
  days_left?: number
  progress?: number
}

export interface UserProfile {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  challenges_won?: number
  usdc_earned?: number
  streak?: number
}

export interface ChallengeParticipant {
  id: string
  challenge_id: string
  user_id: string
  progress: number
  joined_at: string
}

export const PILLARS = [
  { key: 'run', label: 'Run', emoji: '🏃', color: '#00FF87' },
  { key: 'fast', label: 'Fast', emoji: '⚡', color: '#6C63FF' },
  { key: 'sleep', label: 'Sleep', emoji: '😴', color: '#9B8DFF' },
  { key: 'meditate', label: 'Meditate', emoji: '🧘', color: '#FF8C42' },
]

export const MOCK_CHALLENGES: Challenge[] = [
  {
    id: 'mock-1',
    name: '30-Day Morning Run',
    pillar: 'run',
    goal: 'Run 5km every morning for 30 days',
    duration_days: 30,
    stake_amount: 25,
    is_public: true,
    status: 'active',
    creator_id: 'mock-user',
    created_at: new Date().toISOString(),
    participants_count: 12,
    pot_amount: 300,
    days_left: 18,
    progress: 40,
  },
  {
    id: 'mock-2',
    name: 'Intermittent Fast Sprint',
    pillar: 'fast',
    goal: '16:8 fasting every day for 14 days',
    duration_days: 14,
    stake_amount: 10,
    is_public: true,
    status: 'active',
    creator_id: 'mock-user',
    created_at: new Date().toISOString(),
    participants_count: 8,
    pot_amount: 80,
    days_left: 6,
    progress: 57,
  },
  {
    id: 'mock-3',
    name: 'Sleep Optimization',
    pillar: 'sleep',
    goal: '8 hours sleep every night for 7 days',
    duration_days: 7,
    stake_amount: 5,
    is_public: true,
    status: 'active',
    creator_id: 'mock-user',
    created_at: new Date().toISOString(),
    participants_count: 24,
    pot_amount: 120,
    days_left: 3,
    progress: 71,
  },
]
