// Supabase Edge Function: settle-challenges
// Settles all challenges where end_date < now() and status != 'settled'
// - Computes winners (current_score >= 100)
// - Distributes pot with 2% platform fee
// - Inserts settlement_record
// - Updates challenge status to 'settled'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLATFORM_FEE_PCT = 0.02

Deno.serve(async (req: Request) => {
  // Allow GET (for cron) and POST (for manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const results: Array<{
    challenge_id: string
    title: string
    status: string
    winner_count?: number
    loser_count?: number
    total_pot?: number
    platform_fee?: number
    winner_payout?: number
    error?: string
  }> = []

  // Step (a): Find all unsettled, expired challenges (uses ends_at column)
  const now = new Date().toISOString()
  const { data: allChallenges, error: fetchErr } = await supabase
    .from('challenges')
    .select('id, title, stake_per_user, status, ends_at')
    .lt('ends_at', now)
    .neq('status', 'settled')

  if (fetchErr) {
    console.error('Error fetching challenges:', fetchErr)
    return new Response(
      JSON.stringify({ error: fetchErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!allChallenges || allChallenges.length === 0) {
    return new Response(
      JSON.stringify({ message: 'No challenges to settle', results: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Process each challenge
  for (const challenge of allChallenges) {
    try {
      // Step (b): Fetch all participants + their current_score
      const { data: participants, error: partErr } = await supabase
        .from('challenge_participants')
        .select('id, user_id, current_score')
        .eq('challenge_id', challenge.id)

      if (partErr) {
        results.push({ challenge_id: challenge.id, title: challenge.title, status: 'error', error: partErr.message })
        continue
      }

      if (!participants || participants.length === 0) {
        // No participants — still mark as settled
        await supabase
          .from('challenges')
          .update({ status: 'settled' })
          .eq('id', challenge.id)

        results.push({ challenge_id: challenge.id, title: challenge.title, status: 'settled_empty', winner_count: 0, loser_count: 0, total_pot: 0, platform_fee: 0, winner_payout: 0 })
        continue
      }

      // Step (c): Compute winners vs losers
      // Winner = current_score >= 100 (percent)
      const winners = participants.filter(p => (p.current_score ?? 0) >= 100)
      const losers = participants.filter(p => (p.current_score ?? 0) < 100)

      const stakePerUser = challenge.stake_per_user ?? 0
      const totalPot = stakePerUser * participants.length

      // Step (d): Calculate winner share (2% platform fee)
      const platformFee = parseFloat((totalPot * PLATFORM_FEE_PCT).toFixed(2))
      const distributablePot = parseFloat((totalPot - platformFee).toFixed(2))
      const winnerCount = winners.length
      const loserCount = losers.length

      let winnerPayout = 0
      if (winnerCount > 0) {
        winnerPayout = parseFloat((distributablePot / winnerCount).toFixed(2))
      }

      // Step (e): Update participants with winner flag + payout_amount
      // Update winners
      if (winnerCount > 0) {
        const winnerIds = winners.map(w => w.id)
        const { error: winnerUpdateErr } = await supabase
          .from('challenge_participants')
          .update({ winner: true, payout_amount: winnerPayout })
          .in('id', winnerIds)

        if (winnerUpdateErr) {
          console.error(`Failed to update winners for ${challenge.id}:`, winnerUpdateErr)
        }
      }

      // Update losers
      if (loserCount > 0) {
        const loserIds = losers.map(l => l.id)
        const { error: loserUpdateErr } = await supabase
          .from('challenge_participants')
          .update({ winner: false, payout_amount: 0 })
          .in('id', loserIds)

        if (loserUpdateErr) {
          console.error(`Failed to update losers for ${challenge.id}:`, loserUpdateErr)
        }
      }

      // Step (e): Update challenge status to 'settled'
      const { error: challengeUpdateErr } = await supabase
        .from('challenges')
        .update({ status: 'settled' })
        .eq('id', challenge.id)

      if (challengeUpdateErr) {
        console.error(`Failed to settle challenge ${challenge.id}:`, challengeUpdateErr)
        results.push({ challenge_id: challenge.id, title: challenge.title, status: 'error', error: challengeUpdateErr.message })
        continue
      }

      // Step (f): Insert settlement_record
      const { error: recordErr } = await supabase
        .from('settlement_records')
        .insert({
          challenge_id: challenge.id,
          settled_at: new Date().toISOString(),
          total_pot: totalPot,
          winner_count: winnerCount,
          loser_count: loserCount,
          platform_fee: platformFee,
          winner_payout: winnerPayout,
        })

      if (recordErr) {
        console.error(`Failed to insert settlement_record for ${challenge.id}:`, recordErr)
        // Non-fatal — challenge is already settled
      }

      results.push({
        challenge_id: challenge.id,
        title: challenge.title,
        status: 'settled',
        winner_count: winnerCount,
        loser_count: loserCount,
        total_pot: totalPot,
        platform_fee: platformFee,
        winner_payout: winnerPayout,
      })

      console.log(`Settled challenge "${challenge.title}": ${winnerCount} winners, $${winnerPayout} each`)

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Unexpected error settling ${challenge.id}:`, message)
      results.push({ challenge_id: challenge.id, title: challenge.title, status: 'error', error: message })
    }
  }

  const settled = results.filter(r => r.status === 'settled' || r.status === 'settled_empty').length
  const errored = results.filter(r => r.status === 'error').length

  return new Response(
    JSON.stringify({
      message: `Processed ${allChallenges.length} challenges. ${settled} settled, ${errored} errors.`,
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
