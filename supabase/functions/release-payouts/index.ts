Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('CRON_SECRET') ?? ''
  const authorization = req.headers.get('authorization') ?? ''
  if (!secret || authorization !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }
  const appUrl = Deno.env.get('APP_URL')
  if (!appUrl) {
    return new Response(JSON.stringify({ error: 'APP_URL is not set' }), { status: 500 })
  }
  const response = await fetch(`${appUrl.replace(/\/$/, '')}/api/jobs/release`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  })
  return new Response(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
})
