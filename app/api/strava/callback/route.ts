import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID!;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  console.log('[strava-callback] code:', code ? 'present' : 'missing');
  console.log('[strava-callback] state:', state ?? 'MISSING');
  console.log('[strava-callback] error:', error ?? 'none');
  console.log('[strava-callback] STRAVA_CLIENT_ID:', STRAVA_CLIENT_ID ?? 'MISSING');
  console.log('[strava-callback] STRAVA_CLIENT_SECRET:', STRAVA_CLIENT_SECRET ? 'present' : 'MISSING');
  console.log('[strava-callback] SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'present' : 'MISSING');

  if (error || !code) {
    console.log('[strava-callback] early exit: error or no code');
    return NextResponse.redirect(new URL('/profile?strava=error', request.url));
  }

  // Don't block on missing state — just use a fallback
  const userId = state ?? '';

  // Exchange code for tokens
  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  const tokenBody = await tokenRes.text();
  console.log('[strava-callback] token exchange status:', tokenRes.status);
  console.log('[strava-callback] token exchange body:', tokenBody);

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/profile?strava=error', request.url));
  }

  const tokens = JSON.parse(tokenBody);

  if (!userId) {
    console.log('[strava-callback] no userId in state — cannot save');
    return NextResponse.redirect(new URL('/profile?strava=error', request.url));
  }

  // Use service role to write — no session cookie needed
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { error: dbError } = await supabase.from('user_integrations').upsert({
    user_id: userId,
    provider: 'strava',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    athlete_id: tokens.athlete?.id?.toString(),
    connected: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  console.log('[strava-callback] db upsert error:', dbError ?? 'none');

  return NextResponse.redirect(new URL('/profile?strava=connected', request.url));
}
