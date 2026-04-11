import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 25;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  const { userId } = await request.json().catch(() => ({}));

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  // Trigger strava-sync Edge Function for this specific user
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/strava-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use service role key to call the function
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ user_id: userId }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const body = await resp.text();
      return NextResponse.json({ error: `Sync failed: ${resp.status}`, detail: body }, { status: 500 });
    }

    const result = await resp.json();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
