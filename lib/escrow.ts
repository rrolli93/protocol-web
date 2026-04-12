// Protocol Escrow — contract interaction functions
// All functions return typed result objects so callers can handle errors cleanly
// without try/catch noise in the UI layer.

import { type WalletClient, type PublicClient, type Hash, toHex, keccak256, encodePacked } from 'viem'
import {
  PROTOCOL_ESCROW_ABI,
  USDC_ABI,
  getAddresses,
} from './contracts'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TxResult =
  | { success: true; hash: Hash }
  | { success: false; error: string }

export type ReadResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export interface OnChainChallenge {
  challengeId: `0x${string}`
  creator: `0x${string}`
  stakePerUser: bigint
  maxParticipants: bigint
  startTime: bigint
  endTime: bigint
  resolved: boolean
  cancelled: boolean
  pot: bigint
}

export interface CreateChallengeParams {
  challengeId: string        // UUID string from Supabase — will be hashed to bytes32
  stakePerUser: bigint       // USDC amount in 6-decimal units
  maxParticipants: bigint
  durationDays: bigint
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Supabase UUID string to a bytes32 hex value for the contract */
export function uuidToBytes32(uuid: string): `0x${string}` {
  // Remove dashes, left-pad to 32 bytes
  const hex = uuid.replace(/-/g, '')
  return `0x${hex.padStart(64, '0')}` as `0x${string}`
}

/** Alternatively derive a bytes32 from keccak256 of the UUID string */
export function hashChallengeId(challengeId: string): `0x${string}` {
  return keccak256(encodePacked(['string'], [challengeId]))
}

async function getChainId(walletClient: WalletClient): Promise<number> {
  const chainId = await walletClient.getChainId()
  return chainId
}

// ─── USDC approve ─────────────────────────────────────────────────────────────

/**
 * Calls USDC.approve(escrowAddress, amount) on behalf of the connected wallet.
 * Must be called before joinChallenge().
 */
export async function approveUSDC(
  walletClient: WalletClient,
  amount: bigint,
  escrowAddress: string,
): Promise<TxResult> {
  try {
    const chainId = await getChainId(walletClient)
    const { usdc } = getAddresses(chainId)
    const [account] = await walletClient.getAddresses()

    if (!account) return { success: false, error: 'No account connected' }
    if (!escrowAddress) return { success: false, error: 'Escrow contract not deployed yet' }

    const hash = await walletClient.writeContract({
      address: usdc as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [escrowAddress as `0x${string}`, amount],
      account,
    })

    return { success: true, hash }
  } catch (err: unknown) {
    return { success: false, error: extractError(err) }
  }
}

// ─── Join challenge ───────────────────────────────────────────────────────────

/**
 * Calls ProtocolEscrow.join(bytes32 challengeId).
 * Requires USDC approval to have been granted first.
 */
export async function joinChallenge(
  walletClient: WalletClient,
  challengeId: string,
  _stakeAmount: bigint, // kept for clarity; contract reads stake from its own storage
): Promise<TxResult> {
  try {
    const chainId = await getChainId(walletClient)
    const { escrow } = getAddresses(chainId)
    const [account] = await walletClient.getAddresses()

    if (!account) return { success: false, error: 'No account connected' }
    if (!escrow) return { success: false, error: 'Escrow contract not deployed yet' }

    const challengeIdBytes32 = uuidToBytes32(challengeId)

    const hash = await walletClient.writeContract({
      address: escrow as `0x${string}`,
      abi: PROTOCOL_ESCROW_ABI,
      functionName: 'join',
      args: [challengeIdBytes32],
      account,
    })

    return { success: true, hash }
  } catch (err: unknown) {
    return { success: false, error: extractError(err) }
  }
}

// ─── Create challenge ─────────────────────────────────────────────────────────

/**
 * Calls ProtocolEscrow.createChallenge(...).
 * Called after Supabase insert so the DB row exists first.
 */
export async function createChallenge(
  walletClient: WalletClient,
  params: CreateChallengeParams,
): Promise<TxResult> {
  try {
    const chainId = await getChainId(walletClient)
    const { escrow } = getAddresses(chainId)
    const [account] = await walletClient.getAddresses()

    if (!account) return { success: false, error: 'No account connected' }
    if (!escrow) return { success: false, error: 'Escrow contract not deployed yet' }

    const challengeIdBytes32 = uuidToBytes32(params.challengeId)

    const hash = await walletClient.writeContract({
      address: escrow as `0x${string}`,
      abi: PROTOCOL_ESCROW_ABI,
      functionName: 'createChallenge',
      args: [
        challengeIdBytes32,
        params.stakePerUser,
        params.maxParticipants,
        params.durationDays,
      ],
      account,
    })

    return { success: true, hash }
  } catch (err: unknown) {
    return { success: false, error: extractError(err) }
  }
}

// ─── Claim reward ─────────────────────────────────────────────────────────────

/**
 * Calls ProtocolEscrow.claimReward(bytes32 challengeId).
 * Only callable by winners after the challenge is resolved.
 */
export async function claimReward(
  walletClient: WalletClient,
  challengeId: string,
): Promise<TxResult> {
  try {
    const chainId = await getChainId(walletClient)
    const { escrow } = getAddresses(chainId)
    const [account] = await walletClient.getAddresses()

    if (!account) return { success: false, error: 'No account connected' }
    if (!escrow) return { success: false, error: 'Escrow contract not deployed yet' }

    const challengeIdBytes32 = uuidToBytes32(challengeId)

    const hash = await walletClient.writeContract({
      address: escrow as `0x${string}`,
      abi: PROTOCOL_ESCROW_ABI,
      functionName: 'claimReward',
      args: [challengeIdBytes32],
      account,
    })

    return { success: true, hash }
  } catch (err: unknown) {
    return { success: false, error: extractError(err) }
  }
}

// ─── Read challenge on-chain ──────────────────────────────────────────────────

/**
 * Reads challenge state directly from the contract (no wallet needed).
 */
export async function getChallengeOnChain(
  publicClient: PublicClient,
  challengeId: string,
): Promise<ReadResult<OnChainChallenge>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chainId = (publicClient.chain as any)?.id ?? 84532
    const { escrow } = getAddresses(chainId)

    if (!escrow) return { success: false, error: 'Escrow contract not deployed yet' }

    const challengeIdBytes32 = uuidToBytes32(challengeId)

    const result = await publicClient.readContract({
      address: escrow as `0x${string}`,
      abi: PROTOCOL_ESCROW_ABI,
      functionName: 'challenges',
      args: [challengeIdBytes32],
    }) as readonly [
      `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, boolean, boolean, bigint
    ]

    const data: OnChainChallenge = {
      challengeId: result[0],
      creator: result[1],
      stakePerUser: result[2],
      maxParticipants: result[3],
      startTime: result[4],
      endTime: result[5],
      resolved: result[6],
      cancelled: result[7],
      pot: result[8],
    }

    return { success: true, data }
  } catch (err: unknown) {
    return { success: false, error: extractError(err) }
  }
}

/**
 * Checks whether a wallet address is recorded as a winner on-chain.
 */
export async function checkIsWinner(
  publicClient: PublicClient,
  challengeId: string,
  address: string,
): Promise<ReadResult<boolean>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chainId = (publicClient.chain as any)?.id ?? 84532
    const { escrow } = getAddresses(chainId)

    if (!escrow) return { success: false, error: 'Escrow contract not deployed yet' }

    const challengeIdBytes32 = uuidToBytes32(challengeId)

    const result = await publicClient.readContract({
      address: escrow as `0x${string}`,
      abi: PROTOCOL_ESCROW_ABI,
      functionName: 'isWinner',
      args: [challengeIdBytes32, address as `0x${string}`],
    }) as boolean

    return { success: true, data: result }
  } catch (err: unknown) {
    return { success: false, error: extractError(err) }
  }
}

// ─── Error helper ─────────────────────────────────────────────────────────────

function extractError(err: unknown): string {
  if (!err) return 'Unknown error'
  if (typeof err === 'string') return err
  const e = err as { shortMessage?: string; message?: string; code?: number }
  // User rejected the transaction
  if (e.code === 4001) return 'Transaction rejected by user'
  if (e.shortMessage) return e.shortMessage
  if (e.message) return e.message.slice(0, 120)
  return 'Unknown error'
}
