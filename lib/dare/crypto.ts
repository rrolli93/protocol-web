import type { DareEnv } from './flags'

export const BASE_SEPOLIA_CHAIN_ID = 84532
export const BASE_MAINNET_CHAIN_ID = 8453
export const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const

export function cryptoRailEnabled(env: DareEnv = process.env): boolean {
  return env.CRYPTO_RAIL_ENABLED === 'true'
}

/** Mainnet is refused. The only supported chain is Base Sepolia. */
export function assertCryptoChain(chainId: number): void {
  if (chainId === BASE_MAINNET_CHAIN_ID) {
    throw new Error('Base mainnet is refused. The USDC rail is Base Sepolia only.')
  }
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error('The USDC rail only runs on Base Sepolia (chain 84532).')
  }
}

export function dareIdToBytes32(id: string): `0x${string}` {
  const hex = id.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error('Dare id is not a UUID')
  return `0x${hex.padStart(64, '0')}`
}

export type CryptoOutcome = 'none' | 'released' | 'refunded' | 'donated'

export interface CryptoDare {
  id: string
  doer: string | null
  charity: string | null
  charityOnFail: boolean
  feeBps: number
  bounty: bigint
  maxBounty: bigint
  deadline: number
  refundAfter: number
  outcome: CryptoOutcome
  deposits: Map<string, bigint>
}

export interface CryptoEscrow {
  open(input: { id: string; charity: string | null; charityOnFail: boolean; feeBps: number; maxBounty: bigint; deadline: number; graceSeconds: number; now: number }): void
  accept(id: string, doer: string): void
  fund(id: string, funder: string, amount: bigint, now: number): void
  release(id: string, caller: string): { net: bigint; fee: bigint }
  refund(id: string, caller: string): void
  donate(id: string, caller: string): bigint
  claimRefund(id: string, funder: string, now: number): bigint
  get(id: string): CryptoDare | null
}

const ZERO = BigInt(0)
const BPS = BigInt(10000)

export function createCryptoEscrow(oracle: string): CryptoEscrow {
  const dares = new Map<string, CryptoDare>()

  function existing(id: string): CryptoDare {
    const dare = dares.get(id)
    if (!dare) throw new Error('unknown dare')
    return dare
  }

  function openRefunds(dare: CryptoDare) {
    if (dare.outcome !== 'none') throw new Error('settled')
    dare.outcome = 'refunded'
  }

  return {
    open(input) {
      if (dares.has(input.id)) throw new Error('dare exists')
      if (input.feeBps < 0 || input.feeBps > 1_000) throw new Error('bad fee')
      if (input.charityOnFail && !input.charity) throw new Error('no charity')
      dares.set(input.id, {
        id: input.id,
        doer: null,
        charity: input.charity,
        charityOnFail: input.charityOnFail,
        feeBps: input.feeBps,
        bounty: ZERO,
        maxBounty: input.maxBounty,
        deadline: input.deadline,
        refundAfter: input.deadline + input.graceSeconds,
        outcome: 'none',
        deposits: new Map(),
      })
    },
    accept(id, doer) {
      const dare = existing(id)
      if (dare.outcome !== 'none') throw new Error('settled')
      if (dare.doer) throw new Error('already doer')
      if ((dare.deposits.get(doer) ?? ZERO) !== ZERO) throw new Error('doer has deposit')
      dare.doer = doer
    },
    fund(id, funder, amount, now) {
      const dare = existing(id)
      if (dare.outcome !== 'none') throw new Error('settled')
      if (now >= dare.deadline) throw new Error('after deadline')
      if (amount <= ZERO) throw new Error('amount')
      if (funder === dare.doer) throw new Error('doer cannot fund')
      if (dare.bounty + amount > dare.maxBounty) throw new Error('cap')
      dare.bounty += amount
      dare.deposits.set(funder, (dare.deposits.get(funder) ?? ZERO) + amount)
    },
    release(id, caller) {
      if (caller !== oracle) throw new Error('not oracle')
      const dare = existing(id)
      if (dare.outcome !== 'none') throw new Error('settled')
      if (!dare.doer) throw new Error('no doer')
      if (dare.bounty === ZERO) throw new Error('amount')
      const fee = (dare.bounty * BigInt(dare.feeBps)) / BPS
      const net = dare.bounty - fee
      dare.outcome = 'released'
      dare.bounty = ZERO
      return { net, fee }
    },
    refund(id, caller) {
      if (caller !== oracle) throw new Error('not oracle')
      openRefunds(existing(id))
    },
    donate(id, caller) {
      if (caller !== oracle) throw new Error('not oracle')
      const dare = existing(id)
      if (dare.outcome !== 'none') throw new Error('settled')
      if (!dare.charityOnFail || !dare.charity) throw new Error('no charity')
      const bounty = dare.bounty
      if (bounty === ZERO) throw new Error('amount')
      dare.outcome = 'donated'
      dare.bounty = ZERO
      return bounty
    },
    claimRefund(id, funder, now) {
      const dare = existing(id)
      if (dare.outcome === 'none') {
        if (now < dare.refundAfter) throw new Error('too early')
        dare.outcome = 'refunded'
      }
      if (dare.outcome !== 'refunded') throw new Error('settled')
      const amount = dare.deposits.get(funder) ?? ZERO
      if (amount === ZERO) throw new Error('nothing')
      dare.deposits.set(funder, ZERO)
      return amount
    },
    get(id) {
      return dares.get(id) ?? null
    },
  }
}
