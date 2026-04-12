     1|'use client'
// @ts-nocheck

import { useState, useCallback } from 'react'
import { getWalletClient, truncateAddress, switchToBase } from '@/lib/wallet'

interface WalletConnectProps {
  onConnected?: (address: string) => void
  className?: string
}

export default function WalletConnect({ onConnected, className = '' }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mono = { fontFamily: "'JetBrains Mono', monospace" }

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)

    try {
      // Check MetaMask is installed
      if (typeof window === 'undefined' || !window.ethereum) {
        setError('install')
        setConnecting(false)
        return
      }

      // Request accounts
      const accounts: string[] = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      if (!accounts || accounts.length === 0) {
        setError('No accounts returned. Please unlock MetaMask.')
        setConnecting(false)
        return
      }

      const addr = accounts[0]

      // Switch to Base (Sepolia for now)
      try {
        await switchToBase(false)
      } catch {
        // Non-fatal — user may be on correct network already or dismiss
      }

      // Confirm wallet client works
      await getWalletClient()

      setAddress(addr)
      onConnected?.(addr)
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string }
      if (e.code === 4001) {
        setError('Connection rejected. Please approve the request in your wallet.')
      } else {
        setError(e.message?.slice(0, 100) ?? 'Failed to connect wallet.')
      }
    } finally {
      setConnecting(false)
    }
  }, [onConnected])

  const disconnect = useCallback(() => {
    setAddress(null)
    setError(null)
  }, [])

  // MetaMask not installed
  if (error === 'install') {
    return (
      <div className={className}>
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:opacity-90"
          style={{
            backgroundColor: '#0D0D1A',
            borderColor: '#FF8C42',
            color: '#FF8C42',
            ...mono,
          }}
        >
          🦊 Install MetaMask
        </a>
        <p className="text-xs mt-1" style={{ color: '#8888AA', ...mono }}>
          A wallet is required to stake USDC
        </p>
      </div>
    )
  }

  // Connected state
  if (address) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl border"
          style={{ backgroundColor: '#0D0D1A', borderColor: '#1A1A2E' }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: '#00FF87' }}
          />
          <span className="text-sm font-semibold" style={{ color: '#00FF87', ...mono }}>
            {truncateAddress(address)}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="px-2 py-2 rounded-lg text-xs transition-all hover:opacity-70"
          style={{ color: '#8888AA', ...mono }}
          title="Disconnect wallet"
        >
          ✕
        </button>
      </div>
    )
  }

  // Default: Connect button
  return (
    <div className={className}>
      <button
        onClick={connect}
        disabled={connecting}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
        style={{
          backgroundColor: '#6C63FF',
          color: '#ffffff',
          ...mono,
        }}
      >
        {connecting ? (
          <>
            <span
              className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: '#ffffff44', borderTopColor: '#ffffff' }}
            />
            Connecting...
          </>
        ) : (
          <>
            <span>🔗</span>
            Connect Wallet
          </>
        )}
      </button>
      {error && error !== 'install' && (
        <p className="text-xs mt-1.5" style={{ color: '#FF4757', ...mono }}>
          {error}
        </p>
      )}
    </div>
  )
}
