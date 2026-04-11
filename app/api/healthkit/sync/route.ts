import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 25;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Strava-style activity type → pillar mapping
function workoutTypeToPillar(name: string): string | null {
  const n = name.toLowerCase()
  if (['running', 'outdoor_running', 'indoor_running', 'trail_running'].includes(n)) return 'run'
  if (['cycling', 'outdoor_cycling', 'indoor_cycling'].includes(n)) return 'cycle'
  if (['walking', 'hiking'].includes(n)) return 'walk'
  if (['functional_strength_training', 'traditional_strength_training', 'high_intensity_interval_training', 'crossfit'].includes(n)) return 'strength'
  if (['swimming'].includes(n)) return 'swim'
  if (['mind_and_body', 'yoga'].includes(n)) return 'meditate'
  return null
}

export async function POST(request: NextRequest) {
  const { userId, workouts, steps, sleep, mindful } = await request.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let synced = 0;

  // Workouts → activities
  for (const w of (workouts ?? [])) {
    const pillar = workoutTypeToPillar(w.activityName)
    if (!pillar) continue
    const { error: e } = await supabase.from('activities').upsert({
      user_id: userId, source: 'healthkit',
      external_id: `workout_${w.startDate}`,
      pillar,
      value: w.distance > 0 ? w.distance : Math.round(w.duration / 60),
      unit: w.distance > 0 ? 'km' : 'min',
      recorded_at: w.startDate,
      raw_data: w,
    }, { onConflict: 'user_id,source,external_id' })
    if (!e) synced++
  }

  // Steps → activities
  for (const s of (steps ?? [])) {
    const { error: e } = await supabase.from('activities').upsert({
      user_id: userId, source: 'healthkit',
      external_id: `steps_${s.date}`,
      pillar: 'steps', value: s.value, unit: 'steps',
      recorded_at: `${s.date}T23:59:00Z`,
      raw_data: s,
    }, { onConflict: 'user_id,source,external_id' })
    if (!e) synced++
  }

  // Sleep → activities
  for (const s of (sleep ?? [])) {
    const { error: e } = await supabase.from('activities').upsert({
      user_id: userId, source: 'healthkit',
      external_id: `sleep_${s.date}`,
      pillar: 'sleep', value: s.hours, unit: 'hours',
      recorded_at: `${s.date}T04:00:00Z`,
      raw_data: s,
    }, { onConflict: 'user_id,source,external_id' })
    if (!e) synced++
  }

  // Mindful minutes → activities
  for (const m of (mindful ?? [])) {
    const { error: e } = await supabase.from('activities').upsert({
      user_id: userId, source: 'healthkit',
      external_id: `mindful_${m.date}`,
      pillar: 'meditate', value: m.minutes, unit: 'min',
      recorded_at: `${m.date}T23:00:00Z`,
      raw_data: m,
    }, { onConflict: 'user_id,source,external_id' })
    if (!e) synced++
  }

  // Update challenge scores
  const { data: parts } = await supabase
    .from('challenge_participants')
    .select('id, challenges!inner(pillar, goal_value, starts_at, ends_at, status)')
    .eq('user_id', userId)
    .eq('challenges.status', 'active');

  for (const part of (parts ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch = (part as any).challenges;
    if (!ch) continue;
    const { data: acts } = await supabase.from('activities').select('value')
      .eq('user_id', userId).eq('pillar', ch.pillar)
      .gte('recorded_at', ch.starts_at).lte('recorded_at', ch.ends_at);
    const total = (acts ?? []).reduce((s: number, a: { value: number }) => s + Number(a.value), 0);
    await supabase.from('challenge_participants')
      .update({ current_score: total, updated_at: new Date().toISOString() })
      .eq('id', part.id);
  }

  return NextResponse.json({ ok: true, synced });
}
