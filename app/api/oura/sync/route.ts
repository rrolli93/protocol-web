import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 25;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  const { userId } = await request.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'oura')
    .single();

  if (!integration?.access_token) {
    return NextResponse.json({ error: 'Oura not connected' }, { status: 400 });
  }

  const headers = { Authorization: `Bearer ${integration.access_token}` };
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let synced = 0;
  const errors: string[] = [];

  // Sleep data
  try {
    const sleepRes = await fetch(
      `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${since}`,
      { headers }
    );
    if (sleepRes.ok) {
      const sleepData = await sleepRes.json();
      for (const s of (sleepData.data ?? [])) {
        const totalSleepSec = s.contributors?.total_sleep;
        if (!totalSleepSec) continue;
        const hours = Math.round((totalSleepSec / 3600) * 10) / 10;
        const { error: e } = await supabase.from('activities').upsert({
          user_id: userId, source: 'oura', external_id: `sleep_${s.day}`,
          pillar: 'sleep', value: hours, unit: 'hours',
          recorded_at: `${s.day}T04:00:00Z`,  // assume sleep ends around 4am
          raw_data: { day: s.day, score: s.score, contributors: s.contributors },
        }, { onConflict: 'user_id,source,external_id' });
        if (!e) synced++;
      }
    }
  } catch (e) { errors.push(`sleep: ${e}`); }

  // Daily activity (steps)
  try {
    const actRes = await fetch(
      `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${since}`,
      { headers }
    );
    if (actRes.ok) {
      const actData = await actRes.json();
      for (const a of (actData.data ?? [])) {
        if (!a.steps) continue;
        const { error: e } = await supabase.from('activities').upsert({
          user_id: userId, source: 'oura', external_id: `steps_${a.day}`,
          pillar: 'steps', value: a.steps, unit: 'steps',
          recorded_at: `${a.day}T23:59:00Z`,
          raw_data: { day: a.day, score: a.score, steps: a.steps, calories: a.total_calories },
        }, { onConflict: 'user_id,source,external_id' });
        if (!e) synced++;
      }
    }
  } catch (e) { errors.push(`activity: ${e}`); }

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

  return NextResponse.json({ ok: true, synced, errors });
}
