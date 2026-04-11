import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const all = Object.fromEntries(searchParams.entries());
  const code = searchParams.get('code');

  let tokenResult = null;
  if (code) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 8000);
      const tokenRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        }),
        signal: controller.signal,
      });
      tokenResult = { status: tokenRes.status, body: await tokenRes.text() };
    } catch (e: unknown) {
      tokenResult = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    params: all,
    env: {
      STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID ?? 'MISSING',
      STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET ? 'present' : 'MISSING',
    },
    token_exchange: tokenResult,
  });
}
