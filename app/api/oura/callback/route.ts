import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 15;

const OURA_CLIENT_ID = process.env.OURA_CLIENT_ID!;
const OURA_CLIENT_SECRET = process.env.OURA_CLIENT_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://protocol-web-theta.vercel.app';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // user_id
  const error = searchParams.get('error');

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/profile?oura=error', request.url));
  }

  // Exchange code for tokens
  const redirectUri = `${APP_URL}/api/oura/callback`;
  const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: OURA_CLIENT_ID,
      client_secret: OURA_CLIENT_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/profile?oura=error&reason=token_exchange', request.url));
  }

  const tokens = await tokenRes.json();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  await supabase.from('user_integrations').upsert({
    user_id: state,
    provider: 'oura',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
    scope: tokens.token_type,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  await supabase.from('users')
    .update({ oura_connected: true, updated_at: new Date().toISOString() })
    .eq('id', state);

  return NextResponse.redirect(new URL('/profile?oura=connected', request.url));
}
