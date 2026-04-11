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
  const state = searchParams.get('state'); // user_id

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/profile?strava=error', request.url));
  }

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

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/profile?strava=error', request.url));
  }

  const tokens = await tokenRes.json();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Upsert using actual schema columns
  await supabase.from('user_integrations').upsert({
    user_id: state,
    provider: 'strava',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    scope: tokens.token_type,
    provider_user_id: tokens.athlete?.id?.toString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  // Also mark strava_connected on users table
  await supabase.from('users')
    .update({ strava_connected: true, updated_at: new Date().toISOString() })
    .eq('id', state);

  return NextResponse.redirect(new URL('/profile?strava=connected', request.url));
}
