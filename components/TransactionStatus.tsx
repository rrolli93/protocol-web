'use client'

// TransactionStatus — shows the current state of an on-chain transaction
// States: idle | approving | approved | joining | confirmed | error

export type TxState =
  | 'idle'
  | 'approving'
  | 'approved'
  | 'joining'
  | 'confirmed'
  | 'claiming'
  | 'error'

interface TransactionStatusProps {
  state: TxState
  /** TX hash for the USDC approve step */
  approveTxHash?: string
  /** TX hash for the join / claim step */
  txHash?: string
  /** Error message (shown when state === 'error') */
  errorMessage?: string
  /** Use Base Sepolia explorer instead of mainnet */
  testnet?: boolean
}

const BASESCAN_MAINNET = 'https://basescan.org/tx/'
const BASESCAN_TESTNET = 'https://sepolia.basescan.org/tx/'

const STATE_CONFIG: Record<
  TxState,
  { label: string; color: string; bg: string; icon: string }
> = {
  idle: {
    label: '',
    color: '#8888AA',
    bg: 'transparent',
    icon: '',
  },
  approving: {
    label: 'Approving USDC spend…',
    color: '#FF8C42',
    bg: 'rgba(255,140,66,0.08)',
    icon: '⏳',
  },
  approved: {
    label: 'USDC approved ✓ — sending join tx…',
    color: '#6C63FF',
    bg: 'rgba(108,99,255,0.08)',
    icon: '✓',
  },
  joining: {
    label: 'Joining challenge on-chain…',
    color: '#6C63FF',
    bg: 'rgba(108,99,255,0.08)',
    icon: '⏳',
  },
  confirmed: {
    label: 'You\'re in! Transaction confirmed.',
    color: '#00FF87',
    bg: 'rgba(0,255,135,0.08)',
    icon: '🎉',
  },
  claiming: {
    label: 'Claiming reward…',
    color: '#6C63FF',
    bg: 'rgba(108,99,255,0.08)',
    icon: '⏳',
  },
  error: {
    label: 'Transaction failed',
    color: '#FF4757',
    bg: 'rgba(255,71,87,0.08)',
    icon: '✗',
  },
}

const mono = { fontFamily: "'JetBrains Mono', monospace" }

function TxLink({
  hash,
  label,
  testnet,
}: {
  hash: string
  label: string
  testnet?: boolean
}) {
  const base = testnet ? BASESCAN_TESTNET : BASESCAN_MAINNET
  return (
    <a
      href={`${base}${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:opacity-80 transition-opacity"
      style={{ color: '#6C63FF', ...mono }}
    >
      {label} ↗
    </a>
  )
}

export default function TransactionStatus({
  state,
  approveTxHash,
  txHash,
  errorMessage,
  testnet = true,
}: TransactionStatusProps) {
  if (state === 'idle') return null

  const cfg = STATE_CONFIG[state]

  return (
    <div
      className="rounded-xl px-4 py-3 border text-sm space-y-1.5"
      style={{
        backgroundColor: cfg.bg,
        borderColor: `${cfg.color}33`,
        ...mono,
      }}
    >
      {/* Main status line */}
      <div className="flex items-center gap-2">
        {(state === 'approving' || state === 'joining' || state === 'claiming') && (
          <span
            className="w-3.5 h-3.5 rounded-full border-2 animate-spin shrink-0"
            style={{ borderColor: `${cfg.color}44`, borderTopColor: cfg.color }}
          />
        )}
        {state !== 'approving' && state !== 'joining' && state !== 'claiming' && cfg.icon && (
          <span>{cfg.icon}</span>
        )}
        <span style={{ color: cfg.color }}>{cfg.label}</span>
      </div>

      {/* Error detail */}
      {state === 'error' && errorMessage && (
        <p className="text-xs" style={{ color: '#FF4757' }}>
          {errorMessage}
        </p>
      )}

      {/* Approve tx link */}
      {approveTxHash && (
        <div className="text-xs">
          <TxLink hash={approveTxHash} label="View approval tx" testnet={testnet} />
        </div>
      )}

      {/* Join / claim tx link */}
      {txHash && (
        <div className="text-xs">
          <TxLink hash={txHash} label="View transaction" testnet={testnet} />
        </div>
      )}
    </div>
  )
}
