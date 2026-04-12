'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient, type Challenge } from '@/lib/supabase'
import AuthGuard from '@/app/components/AuthGuard'
import ProgressBar from '@/app/components/ProgressBar'
import { getPillar } from '@/lib/pillars'
import WalletConnect from '@/components/WalletConnect'
import TransactionStatus, { type TxState } from '@/components/TransactionStatus'
import { approveUSDC, joinChallenge, claimReward, checkIsWinner } from '@/lib/escrow'
import { getWalletClient, getPublicClient, parseUSDC } from '@/lib/wallet'
import { getAddresses } from '@/lib/contracts'

interface Participant {
  user_id: string
  username: string
  current_score: number
  progress: number
  streak_days: number
  pace: string
  joined_at: string
}

const PACE_COLORS: Record<string, string> = {
  ahead: '#00FF87',
  on_track: '#6C63FF',
  behind: '#FF8C42',
  not_started: '#8888AA',
}
const PACE_LABELS: Record<string, string> = {
  ahead: '▲ Ahead',
  on_track: '● On track',
  behind: '▼ Behind',
  not_started: '○ Not started',
}

function avatarColor(userId: string) {
  const colors = ['#6C63FF', '#00FF87', '#FF8C42', '#FF4757', '#1E90FF', '#FFA502', '#9B8DFF', '#00CFFF']
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function computeProgress(challenge: Challenge, score: number): number {
  if (!challenge.goal_value || challenge.goal_value === 0) {
    const starts = challenge.starts_at ? new Date(challenge.starts_at).getTime() : Date.now()
    const ends = challenge.ends_at ? new Date(challenge.ends_at).getTime() : starts + challenge.duration_days * 86400000
    const elapsed = Math.max(0, Date.now() - starts)
    const total = Math.max(1, ends - starts)
    return Math.min(100, Math.round((elapsed / total) * 100))
  }
  const totalGoal = challenge.goal_value * challenge.duration_days
  return Math.min(100, Math.round((score / totalGoal) * 100))
}

function computeDaysLeft(challenge: Challenge): number {
  if (challenge.ends_at) {
    const diff = new Date(challenge.ends_at).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }
  return challenge.duration_days ?? 0
}

export default function ChallengePage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myUserId, setMyUserId] = useState('')
  const [isParticipating, setIsParticipating] = useState(false)
  const [myProgress, setMyProgress] = useState(0)
  const [myScore, setMyScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [logValue, setLogValue] = useState('')
  const [logNote, setLogNote] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [logSuccess, setLogSuccess] = useState('')

  // Web3 state
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [txState, setTxState] = useState<TxState>('idle')
  const [approveTxHash, setApproveTxHash] = useState<string | undefined>()
  const [joinTxHash, setJoinTxHash] = useState<string | undefined>()
  const [claimTxHash, setClaimTxHash] = useState<string | undefined>()
  const [txError, setTxError] = useState<string | undefined>()
  const [isWinner, setIsWinner] = useState(false)
  const [hasClaimed, setHasClaimed] = useState(false)
  const [showWalletPrompt, setShowWalletPrompt] = useState(false)

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  // Check winner status once wallet is connected and challenge is loaded
  useEffect(() => {
    if (!walletAddress || !challenge || !id) return
    checkWinnerStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, challenge])

  async function checkWinnerStatus() {
    if (!walletAddress || !id) return
    try {
      const publicClient = getPublicClient(false)
      const res = await checkIsWinner(publicClient, id, walletAddress)
      if (res.success) setIsWinner(res.data)
    } catch {
      // Silently fail — contract may not be deployed yet
    }
  }

  async function load() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) setMyUserId(session.user.id)

    const { data: c } = await supabase.from('challenges').select('*').eq('id', id).single()
    if (!c) { router.push('/dashboard'); return }
    setChallenge(c as Challenge)

    const { data: parts } = await supabase
      .from('challenge_participants')
      .select('user_id, current_score, joined_at, streak_days, pace')
      .eq('challenge_id', id)

    if (parts && parts.length > 0) {
      const userIds = parts.map((p: { user_id: string }) => p.user_id)
      const { data: users } = await supabase.from('users').select('id, username').in('id', userIds)
      const userMap: Record<string, string> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (users) users.forEach((u: any) => { userMap[u.id] = u.username })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enriched: Participant[] = parts.map((p: any) => ({
        ...p,
        username: userMap[p.user_id] ?? 'challenger',
        progress: computeProgress(c as Challenge, Number(p.current_score || 0)),
      }))

      enriched.sort((a, b) => b.progress - a.progress)
      setParticipants(enriched)

      if (session) {
        const mine = enriched.find(p => p.user_id === session.user.id)
        if (mine) {
          setIsParticipating(true)
          setMyProgress(mine.progress)
          setMyScore(Number(mine.current_score || 0))
        }
      }
    }

    setLoading(false)
  }

  // ─── Web3 Join Flow ───────────────────────────────────────────────────────────

  const handleJoin = useCallback(async () => {
    if (!challenge) return

    // Step 0: Require wallet
    if (!walletAddress) {
      setShowWalletPrompt(true)
      return
    }

    setTxState('idle')
    setTxError(undefined)
    setApproveTxHash(undefined)
    setJoinTxHash(undefined)

    const stakeUSDC = parseUSDC(String(challenge.stake_per_user ?? 0))

    try {
      const walletClient = await getWalletClient()
      const chainId = await walletClient.getChainId()
      const { escrow } = getAddresses(chainId)

      // Step 1: Approve USDC
      setTxState('approving')
      const approveResult = await approveUSDC(walletClient, stakeUSDC, escrow)

      if (!approveResult.success) {
        setTxState('error')
        setTxError(approveResult.error)
        return
      }

      setApproveTxHash(approveResult.hash)

      // Wait for approval confirmation
      const publicClient = getPublicClient(chainId !== 8453)
      await publicClient.waitForTransactionReceipt({ hash: approveResult.hash })

      setTxState('approved')

      // Step 2: Join on-chain
      setTxState('joining')
      const joinResult = await joinChallenge(walletClient, id, stakeUSDC)

      if (!joinResult.success) {
        setTxState('error')
        setTxError(joinResult.error)
        return
      }

      setJoinTxHash(joinResult.hash)
      await publicClient.waitForTransactionReceipt({ hash: joinResult.hash })

      // Step 3: Record in Supabase (only after on-chain confirmation)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { error: dbError } = await supabase.from('challenge_participants').insert({
        challenge_id: id,
        user_id: session.user.id,
        current_score: 0,
      })

      if (dbError) {
        // On-chain succeeded but DB write failed — log and continue, user IS in the challenge
        console.error('DB insert failed after on-chain join:', dbError)
      }

      setTxState('confirmed')
      setIsParticipating(true)
      load()
    } catch (err: unknown) {
      setTxState('error')
      const e = err as { message?: string }
      setTxError(e.message?.slice(0, 120) ?? 'Transaction failed')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, walletAddress, id])

  // ─── Claim Reward Flow ────────────────────────────────────────────────────────

  const handleClaimReward = useCallback(async () => {
    if (!walletAddress) {
      setShowWalletPrompt(true)
      return
    }

    setTxError(undefined)
    setClaimTxHash(undefined)

    try {
      const walletClient = await getWalletClient()
      const chainId = await walletClient.getChainId()

      setTxState('claiming')
      const result = await claimReward(walletClient, id)

      if (!result.success) {
        setTxState('error')
        setTxError(result.error)
        return
      }

      setClaimTxHash(result.hash)
      const publicClient = getPublicClient(chainId !== 8453)
      await publicClient.waitForTransactionReceipt({ hash: result.hash })

      setTxState('confirmed')
      setHasClaimed(true)
    } catch (err: unknown) {
      setTxState('error')
      const e = err as { message?: string }
      setTxError(e.message?.slice(0, 120) ?? 'Claim failed')
    }
  }, [walletAddress, id])

  // ─── Manual log ───────────────────────────────────────────────────────────────

  async function handleManualLog() {
    if (!logValue || !challenge) return
    setLogLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const val = parseFloat(logValue)
    const { error } = await supabase.from('activity_logs').insert({
      user_id: session.user.id,
      challenge_id: id,
      pillar: challenge.pillar,
      value: val,
      unit: challenge.goal_unit ?? '',
      note: logNote,
      source: 'manual',
      logged_at: new Date().toISOString(),
    })

    if (!error) {
      await supabase.from('challenge_participants')
        .update({ current_score: myScore + val, last_activity_at: new Date().toISOString() })
        .eq('challenge_id', id)
        .eq('user_id', session.user.id)

      setLogSuccess(`✓ Logged ${val} ${challenge.goal_unit}`)
      setLogValue('')
      setLogNote('')
      setTimeout(() => { setLogSuccess(''); setShowLogModal(false) }, 1500)
      load()
    }
    setLogLoading(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <AuthGuard>
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#6C63FF', borderTopColor: 'transparent' }} />
      </div>
    </AuthGuard>
  )

  if (!challenge) return null

  const pillar = getPillar(challenge.pillar)
  const emoji = challenge.cover_emoji || pillar?.emoji || '🏆'
  const pillarColor = pillar?.color ?? '#6C63FF'
  const pot = (challenge.stake_per_user ?? 0) * participants.length
  const daysLeft = computeDaysLeft(challenge)
  const totalDays = challenge.duration_days ?? 30
  const hasGoal = (challenge.goal_value ?? 0) > 0
  const goalStr = hasGoal
    ? `${challenge.goal_value} ${challenge.goal_unit}/${challenge.goal_frequency === 'weekly' ? 'week' : 'day'}`
    : null
  const mono = { fontFamily: "'JetBrains Mono', monospace" }
  const card = 'rounded-xl border p-4'
  const cardStyle = { backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }

  const isComplete = challenge.status === 'completed' || daysLeft === 0
  const hasStake = (challenge.stake_per_user ?? 0) > 0

  // Which tx hash to show in the claim status banner
  const activeTxHash = claimTxHash ?? joinTxHash

  return (
    <AuthGuard>
      <div className="min-h-screen pb-32" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Back */}
          <button onClick={() => router.back()} className="text-sm mb-4" style={{ color: '#8888AA', ...mono }}>
            ← Back
          </button>

          {/* Hero */}
          <div className={`${card} mb-4 text-center`} style={{ ...cardStyle, background: `linear-gradient(135deg, #0D0D1A 0%, ${pillarColor}08 100%)` }}>
            <div className="text-5xl mb-3">{emoji}</div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#ffffff', ...mono }}>{challenge.title}</h1>
            {goalStr && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3" style={{ backgroundColor: `${pillarColor}18`, border: `1px solid ${pillarColor}33` }}>
                <span className="text-sm font-semibold" style={{ color: pillarColor, ...mono }}>🎯 {goalStr}</span>
              </div>
            )}
            {challenge.description && !goalStr && (
              <p className="text-sm mb-3" style={{ color: '#8888AA' }}>{challenge.description}</p>
            )}

            <div className="flex justify-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: challenge.status === 'active' ? 'rgba(0,255,135,0.1)' : 'rgba(136,136,170,0.1)', color: challenge.status === 'active' ? '#00FF87' : '#8888AA', ...mono }}>
                {isComplete ? '✓ COMPLETE' : '● ACTIVE'}
              </span>
              {challenge.is_public && (
                <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(108,99,255,0.1)', color: '#6C63FF', ...mono }}>
                  🌐 PUBLIC
                </span>
              )}
              {hasStake && (
                <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(0,255,135,0.1)', color: '#00FF87', ...mono }}>
                  ⛓ ON-CHAIN
                </span>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'STAKE', value: `$${challenge.stake_per_user}`, color: '#00FF87' },
              { label: 'POT', value: `$${pot}`, color: '#00FF87' },
              { label: 'PLAYERS', value: participants.length, color: '#6C63FF' },
              { label: 'DAYS LEFT', value: daysLeft, color: daysLeft <= 3 ? '#FF4757' : '#FF8C42' },
            ].map(s => (
              <div key={s.label} className={`${card} text-center`} style={cardStyle}>
                <p className="text-lg font-black" style={{ color: s.color, ...mono }}>{s.value}</p>
                <p className="text-xs mt-1" style={{ color: '#8888AA', letterSpacing: '0.05em', ...mono }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* My progress */}
          {isParticipating && (
            <div className={`${card} mb-4`} style={cardStyle}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ color: '#ffffff', ...mono }}>MY PROGRESS</h3>
                <button
                  onClick={() => setShowLogModal(true)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: pillarColor, color: '#0A0A0F', ...mono }}
                >
                  + Log Activity
                </button>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <span className="text-3xl font-black" style={{ color: pillarColor, ...mono }}>{myProgress}%</span>
                  {hasGoal && (
                    <span className="text-sm ml-2" style={{ color: '#8888AA' }}>
                      {myScore} / {(challenge.goal_value ?? 0) * totalDays} {challenge.goal_unit}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: '#8888AA' }}>
                    {daysLeft > 0 ? `${daysLeft} days to go` : 'Challenge ended'}
                  </p>
                </div>
              </div>
              <ProgressBar value={myProgress} />
            </div>
          )}

          {/* Leaderboard */}
          <div className={`${card} mb-4`} style={cardStyle}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#8888AA', letterSpacing: '0.1em', ...mono }}>LEADERBOARD</h3>

            {participants.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-2xl mb-2">👋</p>
                <p className="text-sm" style={{ color: '#8888AA' }}>No participants yet — be the first!</p>
              </div>
            ) : (
              participants.map((p, i) => {
                const rank = i + 1
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
                const isMe = p.user_id === myUserId
                const color = avatarColor(p.user_id)

                return (
                  <div
                    key={p.user_id}
                    className="flex items-center gap-3 py-3 border-b last:border-b-0"
                    style={{ borderColor: '#1A1A2E', backgroundColor: isMe ? `${pillarColor}08` : 'transparent' }}
                  >
                    <span className="text-sm w-8 text-center" style={{ ...mono }}>{medal}</span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: color, color: '#0A0A0F' }}>
                      {p.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold truncate" style={{ color: isMe ? '#ffffff' : '#cccccc', ...mono }}>
                          {p.username}{isMe ? ' (you)' : ''}
                        </span>
                        {p.streak_days > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FF8C4222', color: '#FF8C42', ...mono }}>
                            🔥 {p.streak_days}d
                          </span>
                        )}
                        <span className="text-xs" style={{ color: PACE_COLORS[p.pace ?? 'on_track'], ...mono }}>
                          {PACE_LABELS[p.pace ?? 'on_track']}
                        </span>
                      </div>
                      <ProgressBar value={p.progress} height={4} />
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold" style={{ color: pillarColor, ...mono }}>{p.progress}%</p>
                      {hasGoal && (
                        <p className="text-xs" style={{ color: '#8888AA' }}>{p.current_score} {challenge.goal_unit}</p>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Verification info */}
          {pillar && (
            <div className={`${card} mb-4`} style={cardStyle}>
              <h3 className="text-xs font-bold mb-2" style={{ color: '#8888AA', letterSpacing: '0.1em', ...mono }}>VERIFICATION</h3>
              <p className="text-xs" style={{ color: '#8888AA' }}>
                🔍 {pillar.templates[0]?.verificationMethod ?? 'Auto-synced from your connected apps'}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {pillar.dataSource.map(src => (
                  <span key={src} className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#1A1A2E', color: '#8888AA', ...mono }}>
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Share bar */}
          <div className="flex gap-3">
            <button
              onClick={copyLink}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
              style={{ color: copied ? '#00FF87' : '#8888AA', borderColor: copied ? '#00FF8733' : '#1A1A2E', backgroundColor: 'transparent', ...mono }}
            >
              {copied ? '✓ Link Copied' : '🔗 Copy Invite Link'}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=Competing in a ${challenge.title} challenge on @protocol_app — $${pot} pot!&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border text-center transition-all hover:opacity-90"
              style={{ color: '#ffffff', borderColor: '#1A1A2E', backgroundColor: '#0D0D1A', ...mono }}
            >
              𝕏 Share
            </a>
          </div>

        </div>

        {/* ── FIXED BOTTOM BAR ───────────────────────────────────────────── */}

        {/* JOIN CTA */}
        {!isParticipating && challenge.status === 'active' && !isComplete && (
          <div className="fixed bottom-0 left-0 right-0 px-4 py-4" style={{ backgroundColor: '#0A0A0F', borderTop: '1px solid #1A1A2E' }}>
            <div className="max-w-2xl mx-auto space-y-3">

              {/* Wallet connect row */}
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#8888AA', ...mono }}>
                  {hasStake ? 'Wallet required to stake USDC' : 'Connect wallet (optional)'}
                </span>
                <WalletConnect
                  onConnected={(addr) => {
                    setWalletAddress(addr)
                    setShowWalletPrompt(false)
                  }}
                />
              </div>

              {/* Wallet prompt message */}
              {showWalletPrompt && !walletAddress && (
                <p className="text-xs text-center" style={{ color: '#FF8C42', ...mono }}>
                  ⚠ Connect your wallet first to stake USDC
                </p>
              )}

              {/* Transaction status */}
              {txState !== 'idle' && (
                <TransactionStatus
                  state={txState}
                  approveTxHash={approveTxHash}
                  txHash={activeTxHash}
                  errorMessage={txError}
                  testnet={true}
                />
              )}

              {/* Join button */}
              <button
                onClick={handleJoin}
                disabled={txState === 'approving' || txState === 'joining' || txState === 'confirmed'}
                className="w-full py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}
              >
                {txState === 'approving' && '⏳ Approving USDC…'}
                {txState === 'joining' && '⏳ Joining on-chain…'}
                {txState === 'confirmed' && '✓ Joined!'}
                {(txState === 'idle' || txState === 'error' || txState === 'approved') &&
                  `🚀 Join for $${challenge.stake_per_user} USDC`}
              </button>
            </div>
          </div>
        )}

        {/* PARTICIPATING — already in */}
        {isParticipating && !isComplete && txState !== 'confirmed' && (
          <div className="fixed bottom-0 left-0 right-0 px-4 py-4" style={{ backgroundColor: '#0A0A0F', borderTop: '1px solid #1A1A2E' }}>
            <div className="max-w-2xl mx-auto">
              <div className="w-full py-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(0,255,135,0.08)', border: '1px solid rgba(0,255,135,0.2)' }}>
                <span className="text-sm font-semibold" style={{ color: '#00FF87', ...mono }}>✓ You&apos;re in this challenge</span>
              </div>
            </div>
          </div>
        )}

        {/* CLAIM REWARD — for winners on completed challenges */}
        {isComplete && isParticipating && isWinner && !hasClaimed && (
          <div className="fixed bottom-0 left-0 right-0 px-4 py-4" style={{ backgroundColor: '#0A0A0F', borderTop: '1px solid #1A1A2E' }}>
            <div className="max-w-2xl mx-auto space-y-3">

              {/* Wallet row */}
              {!walletAddress && (
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#8888AA', ...mono }}>Connect wallet to claim</span>
                  <WalletConnect onConnected={(addr) => setWalletAddress(addr)} />
                </div>
              )}

              {/* Claim status */}
              {txState !== 'idle' && (
                <TransactionStatus
                  state={txState}
                  txHash={claimTxHash}
                  errorMessage={txError}
                  testnet={true}
                />
              )}

              <button
                onClick={handleClaimReward}
                disabled={txState === 'claiming' || txState === 'confirmed'}
                className="w-full py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: '#00FF87', color: '#0A0A0F', ...mono }}
              >
                {txState === 'claiming' ? '⏳ Claiming…' :
                 txState === 'confirmed' ? '✓ Reward Claimed!' :
                 '🏆 Claim Your Reward'}
              </button>
            </div>
          </div>
        )}

        {/* COMPLETE — no reward to claim */}
        {isComplete && (!isWinner || hasClaimed) && (
          <div className="fixed bottom-0 left-0 right-0 px-4 py-4" style={{ backgroundColor: '#0A0A0F', borderTop: '1px solid #1A1A2E' }}>
            <div className="max-w-2xl mx-auto">
              <div className="w-full py-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(136,136,170,0.08)', border: '1px solid #1A1A2E' }}>
                <span className="text-sm" style={{ color: '#8888AA', ...mono }}>
                  {hasClaimed ? '✓ Reward claimed' : '✓ Challenge complete'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Manual log modal */}
        {showLogModal && challenge && (
          <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-lg rounded-t-2xl p-6" style={{ backgroundColor: '#0D0D1A', border: '1px solid #1A1A2E' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold" style={{ color: '#ffffff', ...mono }}>Log Activity</h3>
                <button onClick={() => setShowLogModal(false)} style={{ color: '#8888AA' }}>✕</button>
              </div>

              {logSuccess ? (
                <p className="text-center py-4 text-lg" style={{ color: '#00FF87', ...mono }}>{logSuccess}</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="number"
                      value={logValue}
                      onChange={e => setLogValue(e.target.value)}
                      placeholder="0"
                      className="flex-1 px-4 py-3 rounded-xl text-2xl font-bold text-center outline-none"
                      style={{ backgroundColor: '#0A0A0F', border: '1px solid #1A1A2E', color: '#ffffff', ...mono }}
                    />
                    <span className="text-lg font-semibold" style={{ color: pillarColor, ...mono }}>{challenge.goal_unit}</span>
                  </div>
                  <input
                    value={logNote}
                    onChange={e => setLogNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none mb-4"
                    style={{ backgroundColor: '#0A0A0F', border: '1px solid #1A1A2E', color: '#ffffff', fontFamily: 'inherit' }}
                  />
                  <button
                    onClick={handleManualLog}
                    disabled={!logValue || logLoading}
                    className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
                    style={{ backgroundColor: pillarColor, color: '#0A0A0F', ...mono }}
                  >
                    {logLoading ? 'Logging...' : `Log ${logValue || '0'} ${challenge.goal_unit}`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  )
}
