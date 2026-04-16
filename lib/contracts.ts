// Protocol Escrow Contract — ABI and chain configs
// Generated from /root/protocol-contracts/out/ProtocolEscrow.sol/ProtocolEscrow.json

export const PROTOCOL_ESCROW_ABI = [
  {
    "type": "constructor",
    "inputs": [
      { "name": "_usdc", "type": "address", "internalType": "address" },
      { "name": "_oracle", "type": "address", "internalType": "address" },
      { "name": "_treasury", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "PROTOCOL_FEE_BPS",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancel",
    "inputs": [{ "name": "challengeId", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "challengeCount",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "challenges",
    "inputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [
      { "name": "challengeId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "creator", "type": "address", "internalType": "address" },
      { "name": "stakePerUser", "type": "uint256", "internalType": "uint256" },
      { "name": "maxParticipants", "type": "uint256", "internalType": "uint256" },
      { "name": "startTime", "type": "uint256", "internalType": "uint256" },
      { "name": "endTime", "type": "uint256", "internalType": "uint256" },
      { "name": "resolved", "type": "bool", "internalType": "bool" },
      { "name": "cancelled", "type": "bool", "internalType": "bool" },
      { "name": "pot", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimReward",
    "inputs": [{ "name": "challengeId", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createChallenge",
    "inputs": [
      { "name": "challengeId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "stakePerUser", "type": "uint256", "internalType": "uint256" },
      { "name": "maxParticipants", "type": "uint256", "internalType": "uint256" },
      { "name": "durationDays", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "emergencyRefund",
    "inputs": [{ "name": "challengeId", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getParticipants",
    "inputs": [{ "name": "challengeId", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [{ "name": "", "type": "address[]", "internalType": "address[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getWinners",
    "inputs": [{ "name": "challengeId", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [{ "name": "", "type": "address[]", "internalType": "address[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasClaimed",
    "inputs": [
      { "name": "", "type": "bytes32", "internalType": "bytes32" },
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasJoined",
    "inputs": [
      { "name": "", "type": "bytes32", "internalType": "bytes32" },
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isWinner",
    "inputs": [
      { "name": "", "type": "bytes32", "internalType": "bytes32" },
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "join",
    "inputs": [{ "name": "challengeId", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "oracle",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "participantCount",
    "inputs": [{ "name": "challengeId", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "resolve",
    "inputs": [
      { "name": "challengeId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "winners", "type": "address[]", "internalType": "address[]" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setOracle",
    "inputs": [{ "name": "_oracle", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTreasury",
    "inputs": [{ "name": "_treasury", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [{ "name": "newOwner", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "treasury",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "usdcToken",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IERC20" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ChallengeCancelled",
    "inputs": [{ "name": "challengeId", "type": "bytes32", "indexed": true, "internalType": "bytes32" }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ChallengeCreated",
    "inputs": [
      { "name": "challengeId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "creator", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "stakePerUser", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "endTime", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ChallengeResolved",
    "inputs": [
      { "name": "challengeId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "winners", "type": "address[]", "indexed": false, "internalType": "address[]" },
      { "name": "rewardPerWinner", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ParticipantJoined",
    "inputs": [
      { "name": "challengeId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "participant", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "stakeAmount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RefundIssued",
    "inputs": [
      { "name": "challengeId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "participant", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RewardClaimed",
    "inputs": [
      { "name": "challengeId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "winner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  }
] as const

// Minimal ERC-20 ABI — approve + allowance only
export const USDC_ABI = [
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{ "name": "account", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  }
] as const

// Chain configurations
export const BASE_MAINNET = {
  chainId: 8453,
  name: 'Base',
  rpcUrl: 'https://mainnet.base.org',
  blockExplorer: 'https://basescan.org',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
} as const

export const BASE_SEPOLIA = {
  chainId: 84532,
  name: 'Base Sepolia',
  rpcUrl: 'https://sepolia.base.org',
  blockExplorer: 'https://sepolia.basescan.org',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
} as const

// USDC token addresses
export const USDC_ADDRESS_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
export const USDC_ADDRESS_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const

// Escrow contract addresses — fill these in after deployment
// TODO: Deploy ProtocolEscrow.sol and paste the addresses here
export const ESCROW_ADDRESS_MAINNET = '' as string
export const ESCROW_ADDRESS_SEPOLIA = '' as string

// Helper: pick addresses based on active chain
export function getAddresses(chainId: number) {
  const isMainnet = chainId === BASE_MAINNET.chainId
  const escrow = isMainnet ? ESCROW_ADDRESS_MAINNET : ESCROW_ADDRESS_SEPOLIA
  if (!escrow) {
    throw new Error(
      `ProtocolEscrow not deployed on chain ${chainId}. ` +
      `Deploy the contract and set ESCROW_ADDRESS_${isMainnet ? 'MAINNET' : 'SEPOLIA'} in lib/contracts.ts.`
    )
  }
  return {
    usdc: isMainnet ? USDC_ADDRESS_MAINNET : USDC_ADDRESS_SEPOLIA,
    escrow,
    chain: isMainnet ? BASE_MAINNET : BASE_SEPOLIA,
  }
}
