// Central pillar definitions — single source of truth for web + mobile

export interface PillarTemplate {
  label: string
  unit: string
  frequency: 'daily' | 'weekly' | 'total'
  defaultValue: number
  min: number
  max: number
  step: number
  examples: Array<{ label: string; value: number; difficulty: 'easy' | 'medium' | 'hard' }>
  verificationMethod: string
  description: string
}

export interface Pillar {
  key: string
  label: string
  emoji: string
  color: string
  templates: PillarTemplate[]
  dataSource: string[]  // what integrations can verify this
}

export const PILLARS: Pillar[] = [
  {
    key: 'run',
    label: 'Run',
    emoji: '🏃',
    color: '#00FF87',
    dataSource: ['strava', 'healthkit', 'health_connect', 'garmin', 'polar'],
    templates: [
      {
        label: 'Distance per day',
        unit: 'km',
        frequency: 'daily',
        defaultValue: 5,
        min: 0.5,
        max: 42,
        step: 0.5,
        examples: [
          { label: 'Easy — 2km/day', value: 2, difficulty: 'easy' },
          { label: 'Medium — 5km/day', value: 5, difficulty: 'medium' },
          { label: 'Hard — 10km/day', value: 10, difficulty: 'hard' },
        ],
        verificationMethod: 'Strava, Apple Health, or GPS watch sync',
        description: 'Log a GPS run each day to hit your distance target',
      },
      {
        label: 'Weekly mileage',
        unit: 'km',
        frequency: 'weekly',
        defaultValue: 30,
        min: 5,
        max: 200,
        step: 5,
        examples: [
          { label: 'Easy — 20km/week', value: 20, difficulty: 'easy' },
          { label: 'Medium — 40km/week', value: 40, difficulty: 'medium' },
          { label: 'Hard — 70km/week', value: 70, difficulty: 'hard' },
        ],
        verificationMethod: 'Strava, Apple Health, or GPS watch sync',
        description: 'Accumulate weekly running distance across any number of runs',
      },
    ],
  },
  {
    key: 'fast',
    label: 'Fast',
    emoji: '⚡',
    color: '#6C63FF',
    dataSource: ['manual', 'healthkit'],
    templates: [
      {
        label: 'Fasting window per day',
        unit: 'hours',
        frequency: 'daily',
        defaultValue: 16,
        min: 12,
        max: 48,
        step: 1,
        examples: [
          { label: '14:10 — 14 hours', value: 14, difficulty: 'easy' },
          { label: '16:8 — 16 hours', value: 16, difficulty: 'medium' },
          { label: 'OMAD — 23 hours', value: 23, difficulty: 'hard' },
        ],
        verificationMethod: 'Manual log with start/end timestamps',
        description: 'Log your fasting window daily using the in-app timer',
      },
    ],
  },
  {
    key: 'sleep',
    label: 'Sleep',
    emoji: '😴',
    color: '#9B8DFF',
    dataSource: ['healthkit', 'health_connect', 'oura', 'whoop'],
    templates: [
      {
        label: 'Sleep duration per night',
        unit: 'hours',
        frequency: 'daily',
        defaultValue: 8,
        min: 5,
        max: 12,
        step: 0.5,
        examples: [
          { label: 'Easy — 7h/night', value: 7, difficulty: 'easy' },
          { label: 'Medium — 8h/night', value: 8, difficulty: 'medium' },
          { label: 'Hard — 9h/night', value: 9, difficulty: 'hard' },
        ],
        verificationMethod: 'Apple Health, Oura Ring, or Whoop sync',
        description: 'Track your nightly sleep duration via your wearable or Apple Health',
      },
    ],
  },
  {
    key: 'meditate',
    label: 'Meditate',
    emoji: '🧘',
    color: '#FF8C42',
    dataSource: ['healthkit', 'manual'],
    templates: [
      {
        label: 'Mindfulness minutes per day',
        unit: 'min',
        frequency: 'daily',
        defaultValue: 10,
        min: 1,
        max: 120,
        step: 5,
        examples: [
          { label: 'Easy — 5min/day', value: 5, difficulty: 'easy' },
          { label: 'Medium — 10min/day', value: 10, difficulty: 'medium' },
          { label: 'Hard — 20min/day', value: 20, difficulty: 'hard' },
        ],
        verificationMethod: 'Apple Health mindful minutes or manual log',
        description: 'Log your daily meditation session — any app counts via Apple Health',
      },
    ],
  },
  {
    key: 'strength',
    label: 'Lift',
    emoji: '💪',
    color: '#FF4757',
    dataSource: ['strava', 'healthkit', 'health_connect', 'manual'],
    templates: [
      {
        label: 'Sessions per week',
        unit: 'sessions',
        frequency: 'weekly',
        defaultValue: 3,
        min: 1,
        max: 7,
        step: 1,
        examples: [
          { label: 'Easy — 2x/week', value: 2, difficulty: 'easy' },
          { label: 'Medium — 4x/week', value: 4, difficulty: 'medium' },
          { label: 'Hard — 6x/week', value: 6, difficulty: 'hard' },
        ],
        verificationMethod: 'Strava workout sync or manual log',
        description: 'Complete strength training sessions each week',
      },
    ],
  },
  {
    key: 'steps',
    label: 'Steps',
    emoji: '👟',
    color: '#FFA502',
    dataSource: ['healthkit', 'health_connect', 'garmin', 'oura'],
    templates: [
      {
        label: 'Daily step count',
        unit: 'steps',
        frequency: 'daily',
        defaultValue: 10000,
        min: 1000,
        max: 50000,
        step: 1000,
        examples: [
          { label: 'Easy — 7,500 steps', value: 7500, difficulty: 'easy' },
          { label: 'Medium — 10,000 steps', value: 10000, difficulty: 'medium' },
          { label: 'Hard — 15,000 steps', value: 15000, difficulty: 'hard' },
        ],
        verificationMethod: 'Apple Health, Google Health Connect, or any wearable',
        description: 'Hit your daily step target every day of the challenge',
      },
    ],
  },
  {
    key: 'cycle',
    label: 'Cycle',
    emoji: '🚴',
    color: '#1E90FF',
    dataSource: ['strava', 'healthkit', 'health_connect', 'garmin', 'polar'],
    templates: [
      {
        label: 'Distance per week',
        unit: 'km',
        frequency: 'weekly',
        defaultValue: 50,
        min: 10,
        max: 500,
        step: 10,
        examples: [
          { label: 'Easy — 30km/week', value: 30, difficulty: 'easy' },
          { label: 'Medium — 80km/week', value: 80, difficulty: 'medium' },
          { label: 'Hard — 150km/week', value: 150, difficulty: 'hard' },
        ],
        verificationMethod: 'Strava, Apple Health, or GPS bike computer sync',
        description: 'Accumulate weekly cycling distance across any rides',
      },
    ],
  },
  {
    key: 'cold',
    label: 'Cold',
    emoji: '🧊',
    color: '#00CFFF',
    dataSource: ['manual'],
    templates: [
      {
        label: 'Cold exposure sessions per day',
        unit: 'sessions',
        frequency: 'daily',
        defaultValue: 1,
        min: 1,
        max: 3,
        step: 1,
        examples: [
          { label: 'Easy — 30s cold shower', value: 1, difficulty: 'easy' },
          { label: 'Medium — 2min cold shower', value: 1, difficulty: 'medium' },
          { label: 'Hard — Ice bath daily', value: 1, difficulty: 'hard' },
        ],
        verificationMethod: 'Manual log with timestamp',
        description: 'Take a daily cold shower or ice bath and log it',
      },
    ],
  },
]

export function getPillar(key: string): Pillar | undefined {
  return PILLARS.find(p => p.key === key)
}

export function getDefaultTemplate(pillarKey: string): PillarTemplate | undefined {
  return getPillar(pillarKey)?.templates[0]
}

// Suggested challenge name per pillar + template
export function suggestChallengeName(pillarKey: string, days: number, value: number, unit: string): string {
  const names: Record<string, string> = {
    run: `${days}-Day ${value}${unit} Run`,
    fast: `${days}-Day ${value}h Fast`,
    sleep: `${days}-Day ${value}h Sleep`,
    meditate: `${days}-Day ${value}min Meditation`,
    strength: `${days}-Day Lift Challenge`,
    steps: `${days}-Day ${(value / 1000).toFixed(0)}K Steps`,
    cycle: `${days}-Day ${value}${unit} Ride`,
    cold: `${days}-Day Cold Shower`,
  }
  return names[pillarKey] ?? `${days}-Day ${pillarKey} Challenge`
}
