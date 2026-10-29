// Proof checks run in the upload request. This function can re-drive the
// reviewer-visible queue by calling the app if a proof was left in proof_submitted.
Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('CRON_SECRET') ?? ''
  const authorization = req.headers.get('authorization') ?? ''
  if (!secret || authorization !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }
  return new Response(JSON.stringify({
    ok: true,
    note: 'AI checks run when a proof is uploaded. The provider is pluggable and defaults to a mock that queues for review.',
  }), { headers: { 'content-type': 'application/json' } })
})
