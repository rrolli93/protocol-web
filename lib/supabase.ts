import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = 'https://zxfzivelglmewzlmvsbp.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4ZnppdmVsZ2xtZXd6bG12c2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDM4NzMsImV4cCI6MjA5MTQxOTg3M30.QIzifYDtFFdf520YrTGgylP7XrFc20LSkyTSLSHcQwk'

// Browser client for Client Components
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Types
export interface Challenge {
  id: string
  title: string
  description?: string
  pillar: string
  goal_value?: number
  goal_unit?: string
  duration_days: number
  stake_per_user: number
  is_public: boolean
  status: string
  creator_id: string
  created_at: string
  starts_at?: string
  ends_at?: string
  contract_address?: string
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
    title: '30-Day Morning Run',
    pillar: 'run',
    description: 'Run 5km every morning for 30 days',
    goal_value: 5,
    goal_unit: 'km',
    duration_days: 30,
    stake_per_user: 25,
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
    title: 'Intermittent Fast Sprint',
    pillar: 'fast',
    description: '16:8 fasting every day for 14 days',
    duration_days: 14,
    stake_per_user: 10,
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
    title: 'Sleep Optimization',
    pillar: 'sleep',
    description: '8 hours sleep every night for 7 days',
    duration_days: 7,
    stake_per_user: 5,
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
// cache bust Fri Apr 10 08:50:28 PM UTC 2026
