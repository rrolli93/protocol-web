import { NextRequest, NextResponse } from 'next/server';

// Temporary debug endpoint — logs exactly what Strava sends back
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const all = Object.fromEntries(searchParams.entries());
  
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  let tokenResult = null;
  if (code) {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });
    tokenResult = { status: tokenRes.status, body: await tokenRes.text() };
  }

  return NextResponse.json({
    params: all,
    code_present: !!code,
    state,
    env: {
      STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID ?? 'MISSING',
      STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET ? 'present' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'MISSING',
    },
    token_exchange: tokenResult,
  });
}
