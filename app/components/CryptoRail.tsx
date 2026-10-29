'use client'

import { useState } from 'react'
import { encodeFunctionData } from 'viem'
import { dareEscrowAbi } from '@/lib/dare/escrow-abi'
import { BASE_SEPOLIA_CHAIN_ID, BASE_MAINNET_CHAIN_ID, dareIdToBytes32 } from '@/lib/dare/crypto'

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

function provider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum ?? null
}

export default function CryptoRail({ dareId, escrowAddress }: { dareId: string; escrowAddress: string | null }) {
  const [account, setAccount] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [usdc, setUsdc] = useState('20')

  async function connect() {
    const ethereum = provider()
    if (!ethereum) {
      setMessage('No wallet found. Install a browser wallet that can talk to Base Sepolia.')
      return
    }
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[]
    const chain = Number(await ethereum.request({ method: 'eth_chainId' }))
    if (chain === BASE_MAINNET_CHAIN_ID) {
      setAccount(null)
      setMessage('This wallet is on Base mainnet. Dare refuses mainnet. Switch to Base Sepolia.')
      return
    }
    if (chain !== BASE_SEPOLIA_CHAIN_ID) {
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x14a34' }],
        })
      } catch {
        setMessage('Switch the wallet to Base Sepolia (chain 84532). Mainnet is refused.')
        return
      }
    }
    setAccount(accounts[0] ?? null)
    setMessage(accounts[0] ? `Connected ${accounts[0].slice(0, 6)}…${accounts[0].slice(-4)}` : 'No account')
  }

  async function send(functionName: 'fund' | 'accept', amount?: bigint) {
    const ethereum = provider()
    if (!ethereum || !account) {
      setMessage('Connect a wallet on Base Sepolia first.')
      return
    }
    if (!escrowAddress) {
      setMessage('DARE_ESCROW_ADDRESS is not set. Rafael deploys DareEscrow on Base Sepolia and pastes the address. No mainnet deploy.')
      return
    }
    const chain = Number(await ethereum.request({ method: 'eth_chainId' }))
    if (chain !== BASE_SEPOLIA_CHAIN_ID) {
      setMessage('Refusing the transaction. The wallet is not on Base Sepolia.')
      return
    }
    const id = dareIdToBytes32(dareId)
    const data = encodeFunctionData({
      abi: dareEscrowAbi,
      functionName,
      args: functionName === 'fund' ? [id, amount ?? BigInt(0)] : [id],
    })
    await ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: escrowAddress, data }],
    })
    setMessage(functionName === 'fund' ? 'Deposit submitted from your wallet. The doer does not sign a deposit.' : 'Doer accept submitted. No tokens moved.')
  }

  return (
    <div className="rounded-xl border p-4 mb-4" style={{ borderColor: '#1A1A2E', backgroundColor: '#0D0D1A' }}>
      <p className="text-xs mb-2" style={{ color: '#6C63FF', fontFamily: "'JetBrains Mono', monospace" }}>USDC ON BASE SEPOLIA</p>
      <p className="text-sm mb-3" style={{ color: '#8888AA' }}>
        Optional rail. The funder deposits test USDC. The doer never deposits. Settlement is once, by the oracle. This UI will not send a mainnet transaction.
      </p>
      <button onClick={connect} className="w-full py-3 rounded-xl mb-2 text-sm" style={{ backgroundColor: '#1A1A2E', color: '#ffffff' }}>
        {account ? 'Wallet connected' : 'Connect wallet'}
      </button>
      <label className="text-xs" style={{ color: '#8888AA' }}>USDC amount (testnet)</label>
      <input value={usdc} onChange={(event) => setUsdc(event.target.value)} className="w-full mt-1 mb-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#0A0A0F', color: '#ffffff', border: '1px solid #1A1A2E' }} />
      <div className="flex gap-2">
        <button onClick={() => send('fund', BigInt(Math.round(Number(usdc) * 1_000_000)))} className="flex-1 py-3 rounded-xl text-sm" style={{ backgroundColor: '#00FF87', color: '#0A0A0F' }}>
          Deposit USDC
        </button>
        <button onClick={() => send('accept')} className="flex-1 py-3 rounded-xl text-sm" style={{ backgroundColor: '#6C63FF', color: '#ffffff' }}>
          I am the doer
        </button>
      </div>
      {message && <p className="text-xs mt-2" style={{ color: '#FF8C42' }}>{message}</p>}
    </div>
  )
}
