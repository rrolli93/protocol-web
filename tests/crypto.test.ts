import { describe, expect, it } from 'vitest'
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  assertCryptoChain,
  createCryptoEscrow,
  cryptoRailEnabled,
  dareIdToBytes32,
} from '@/lib/dare/crypto'

const USDC = BigInt(1000000)
const u = (whole: number) => BigInt(whole) * USDC

describe('USDC rail', () => {
  it('stays off unless CRYPTO_RAIL_ENABLED is exactly true and refuses mainnet', () => {
    expect(cryptoRailEnabled({})).toBe(false)
    expect(cryptoRailEnabled({ CRYPTO_RAIL_ENABLED: '1' })).toBe(false)
    expect(cryptoRailEnabled({ CRYPTO_RAIL_ENABLED: 'true' })).toBe(true)
    expect(() => assertCryptoChain(BASE_MAINNET_CHAIN_ID)).toThrow(/mainnet/)
    expect(() => assertCryptoChain(1)).toThrow(/84532/)
    expect(() => assertCryptoChain(BASE_SEPOLIA_CHAIN_ID)).not.toThrow()
    expect(dareIdToBytes32('33333333-3333-4333-8333-333333333333')).toBe(
      '0x0000000000000000000000000000000033333333333343338333333333333333',
    )
  })

  it('lets a funder deposit, pays the doer once, and never lets the doer stake', () => {
    const escrow = createCryptoEscrow('oracle')
    const now = 1_000
    escrow.open({
      id: 'd1',
      charity: null,
      charityOnFail: false,
      feeBps: 1_000,
      maxBounty: u(100),
      deadline: now + 86_400,
      graceSeconds: 86_400,
      now,
    })
    escrow.accept('d1', 'doer')
    expect(() => escrow.fund('d1', 'doer', u(20), now)).toThrow(/doer cannot fund/)
    escrow.fund('d1', 'funder', u(20), now)
    const paid = escrow.release('d1', 'oracle')
    expect(paid.net).toBe(u(18))
    expect(paid.fee).toBe(u(2))
    expect(() => escrow.release('d1', 'oracle')).toThrow(/settled/)
    expect(() => escrow.refund('d1', 'oracle')).toThrow(/settled/)
    expect(() => escrow.release('d1', 'stranger')).toThrow(/not oracle/)
  })

  it('refunds each funder once and donates the full bounty with no fee', () => {
    const escrow = createCryptoEscrow('oracle')
    const now = 1_000
    escrow.open({
      id: 'miss',
      charity: null,
      charityOnFail: false,
      feeBps: 1_000,
      maxBounty: u(100),
      deadline: now + 10,
      graceSeconds: 10,
      now,
    })
    escrow.fund('miss', 'a', u(12), now)
    escrow.fund('miss', 'b', u(8), now)
    escrow.refund('miss', 'oracle')
    expect(escrow.claimRefund('miss', 'a', now)).toBe(u(12))
    expect(() => escrow.claimRefund('miss', 'a', now)).toThrow(/nothing/)
    expect(escrow.claimRefund('miss', 'b', now)).toBe(u(8))

    escrow.open({
      id: 'gift',
      charity: 'red-cross',
      charityOnFail: true,
      feeBps: 1_000,
      maxBounty: u(100),
      deadline: now + 10,
      graceSeconds: 10,
      now,
    })
    escrow.fund('gift', 'a', u(25), now)
    expect(escrow.donate('gift', 'oracle')).toBe(u(25))
    expect(() => escrow.donate('gift', 'oracle')).toThrow(/settled/)
  })

  it('opens a funder pull after the timeout without the oracle', () => {
    const escrow = createCryptoEscrow('oracle')
    const now = 1_000
    escrow.open({
      id: 'stuck',
      charity: null,
      charityOnFail: false,
      feeBps: 0,
      maxBounty: u(100),
      deadline: now + 5,
      graceSeconds: 5,
      now,
    })
    escrow.fund('stuck', 'a', u(7), now)
    expect(() => escrow.claimRefund('stuck', 'a', now + 6)).toThrow(/too early/)
    expect(escrow.claimRefund('stuck', 'a', now + 10)).toBe(u(7))
    expect(() => escrow.release('stuck', 'oracle')).toThrow(/settled/)
  })
})
