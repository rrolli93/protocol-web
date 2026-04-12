// @ts-nocheck
     1|// Wallet utilities — viem wallet + public client helpers
// All window.ethereum access is gated so this is safe to import in SSR files
// (the actual calls will only run client-side).

import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type WalletClient,
  type PublicClient,
} from 'viem'
import { BASE_MAINNET, BASE_SEPOLIA } from './contracts'

// ─── viem chain objects ────────────────────────────────────────────────────────

const baseMainnetChain = {
  id: BASE_MAINNET.chainId,
  name: BASE_MAINNET.name,
  nativeCurrency: BASE_MAINNET.nativeCurrency,
  rpcUrls: { default: { http: [BASE_MAINNET.rpcUrl] } },
  blockExplorers: { default: { name: 'Basescan', url: BASE_MAINNET.blockExplorer } },
} as const

const baseSepoliaChain = {
  id: BASE_SEPOLIA.chainId,
  name: BASE_SEPOLIA.name,
  nativeCurrency: BASE_SEPOLIA.nativeCurrency,
  rpcUrls: { default: { http: [BASE_SEPOLIA.rpcUrl] } },
  blockExplorers: { default: { name: 'Basescan Sepolia', url: BASE_SEPOLIA.blockExplorer } },
} as const

// Default to Sepolia for development — flip to baseMainnetChain for production
const DEFAULT_CHAIN = baseSepoliaChain

// ─── Client factories ──────────────────────────────────────────────────────────

/**
 * Creates a WalletClient connected to window.ethereum (MetaMask / injected provider).
 * Throws a friendly error if no wallet is detected.
 */
export async function getWalletClient(): Promise<WalletClient> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('NO_WALLET')
  }

  const client = createWalletClient({
    chain: DEFAULT_CHAIN,
    transport: custom(window.ethereum),
  })

  return client
}

/**
 * Creates a read-only PublicClient for Base Sepolia (or Mainnet).
 * Safe to call from both client and server.
 */
export function getPublicClient(mainnet = false): PublicClient {
  const chain = mainnet ? baseMainnetChain : baseSepoliaChain
  const rpc = mainnet ? BASE_MAINNET.rpcUrl : BASE_SEPOLIA.rpcUrl

  return createPublicClient({
    chain,
    transport: http(rpc),
  }) as PublicClient
}

// ─── Network switching ─────────────────────────────────────────────────────────

/**
 * Prompts the wallet to switch to Base (Sepolia by default).
 * Adds the network to MetaMask if it hasn't been added yet.
 */
export async function switchToBase(mainnet = false): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('NO_WALLET')
  }

  const chain = mainnet ? BASE_MAINNET : BASE_SEPOLIA
  const chainIdHex = `0x${chain.chainId.toString(16)}`

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    })
  } catch (err: unknown) {
    // Error code 4902 = chain not added to wallet yet
    const code = (err as { code?: number })?.code
    if (code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: chain.name,
            rpcUrls: [chain.rpcUrl],
            nativeCurrency: chain.nativeCurrency,
            blockExplorerUrls: [chain.blockExplorer],
          },
        ],
      })
    } else {
      throw err
    }
  }
}

// ─── USDC formatting ──────────────────────────────────────────────────────────

/** Formats a raw USDC bigint (6 decimals) → human-readable string e.g. "25.00" */
export function formatUSDC(amount: bigint): string {
  const whole = amount / 1_000_000n
  const frac = amount % 1_000_000n
  const fracStr = frac.toString().padStart(6, '0').slice(0, 2) // 2 decimal places
  return `${whole}.${fracStr}`
}

/** Parses a human-readable USDC string (e.g. "25" or "25.50") → bigint with 6 decimals */
export function parseUSDC(amount: string): bigint {
  const [whole, frac = ''] = amount.split('.')
  const fracPadded = frac.slice(0, 6).padEnd(6, '0')
  return BigInt(whole || '0') * 1_000_000n + BigInt(fracPadded)
}

// ─── Address helpers ──────────────────────────────────────────────────────────

/** Truncates an Ethereum address to 0x1234...5678 format */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Extend window type for ethereum
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any
  }
}
