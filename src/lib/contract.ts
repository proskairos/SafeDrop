// ─── ABI for DeadManSwitchRegistry.sol ───────────────────────
// XOR key-splitting architecture
// Deployed at: 0x06f14713198eA009fC98246164159e41C7Ec3A0B (Filecoin Calibration)

export const TESTAMENT_REGISTRY_ABI = [
  // ─── Write Functions ───────────────────────────────────────
  {
    type: 'function',
    name: 'createWill',
    inputs: [
      { name: '_cid', type: 'string' },
      { name: '_encryptedKey', type: 'bytes' },
      { name: '_beneficiary', type: 'address' },
      { name: '_timeoutDuration', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'checkIn',
    inputs: [
      { name: 'willId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'triggerRelease',
    inputs: [
      { name: 'willId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ownerRelease',
    inputs: [
      { name: 'willId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revealShare',
    inputs: [
      { name: 'willId', type: 'uint256' },
      { name: '_share', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ─── View Functions ────────────────────────────────────────
  {
    type: 'function',
    name: 'getWill',
    inputs: [
      { name: 'willId', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'beneficiary', type: 'address' },
          { name: 'cid', type: 'string' },
          { name: 'encryptedKey', type: 'bytes' },
          { name: 'lastCheckIn', type: 'uint256' },
          { name: 'timeoutDuration', type: 'uint256' },
          { name: 'isReleased', type: 'bool' },
          { name: 'revealed', type: 'bool' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOwnerWills',
    inputs: [
      { name: 'owner', type: 'address' },
    ],
    outputs: [
      { name: '', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBeneficiaryWills',
    inputs: [
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [
      { name: '', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOwnerWillCount',
    inputs: [
      { name: 'owner', type: 'address' },
    ],
    outputs: [
      { name: '', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBeneficiaryWillCount',
    inputs: [
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [
      { name: '', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canRelease',
    inputs: [
      { name: 'willId', type: 'uint256' },
    ],
    outputs: [
      { name: '', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTimeUntilRelease',
    inputs: [
      { name: 'willId', type: 'uint256' },
    ],
    outputs: [
      { name: '', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTotalWills',
    inputs: [],
    outputs: [
      { name: '', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_TIMEOUT',
    inputs: [],
    outputs: [
      { name: '', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_TIMEOUT',
    inputs: [],
    outputs: [
      { name: '', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isReleased',
    inputs: [
      { name: 'willId', type: 'uint256' },
    ],
    outputs: [
      { name: '', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRevealed',
    inputs: [
      { name: 'willId', type: 'uint256' },
    ],
    outputs: [
      { name: '', type: 'bool' },
    ],
    stateMutability: 'view',
  },

  // ─── Events ────────────────────────────────────────────────
  {
    type: 'event',
    name: 'WillCreated',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'cid', type: 'string', indexed: false },
      { name: 'timeoutDuration', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CheckedIn',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WillReleased',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'cid', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ShareRevealed',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'revealer', type: 'address', indexed: true },
    ],
  },

  // ─── Errors ────────────────────────────────────────────────
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'SelfBeneficiary', inputs: [] },
  { type: 'error', name: 'EmptyCid', inputs: [] },
  { type: 'error', name: 'BelowMinTimeout', inputs: [] },
  { type: 'error', name: 'WillNotFound', inputs: [{ name: 'willId', type: 'uint256' }] },
  { type: 'error', name: 'NotOwner', inputs: [{ name: 'willId', type: 'uint256' }] },
  { type: 'error', name: 'AlreadyReleased', inputs: [{ name: 'willId', type: 'uint256' }] },
  { type: 'error', name: 'NotReleased', inputs: [{ name: 'willId', type: 'uint256' }] },
  { type: 'error', name: 'TimeoutNotReached', inputs: [{ name: 'willId', type: 'uint256' }] },
  { type: 'error', name: 'AlreadyRevealed', inputs: [{ name: 'willId', type: 'uint256' }] },
  { type: 'error', name: 'EmptyShare', inputs: [] },
] as const

// ─── Types ───────────────────────────────────────────────────

export interface OnChainWill {
  owner: string
  beneficiary: string
  cid: string
  encryptedKey: string // hex-encoded bytes (XOR share2, empty until revealShare called)
  lastCheckIn: bigint
  timeoutDuration: bigint
  isReleased: boolean
  revealed: boolean   // true once share2 has been stored on-chain via revealShare
  exists: boolean
  /** Will ID — set when fetched via list queries */
  willId?: number
}

export type WillStatus = 'active' | 'warning' | 'expired' | 'released'

export function getWillStatus(will: OnChainWill): WillStatus {
  if (will.isReleased) return 'released'
  const now = Math.floor(Date.now() / 1000)
  const deadline = Number(will.lastCheckIn) + Number(will.timeoutDuration)
  const remaining = deadline - now
  const warningThreshold = 3 * 24 * 60 * 60 // 3 days
  if (remaining <= 0) return 'expired'
  if (remaining <= warningThreshold) return 'warning'
  return 'active'
}

export function formatTimeRemaining(will: OnChainWill): {
  days: number
  hours: number
  minutes: number
  total: number
  expired: boolean
} {
  const now = Math.floor(Date.now() / 1000)
  const deadline = Number(will.lastCheckIn) + Number(will.timeoutDuration)
  const remaining = deadline - now
  if (remaining <= 0) return { days: 0, hours: 0, minutes: 0, total: 0, expired: true }
  return {
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining / 3600) % 24),
    minutes: Math.floor((remaining / 60) % 60),
    total: remaining,
    expired: false,
  }
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function getExplorerTxUrl(txHash: string): string {
  return `https://calibration.filscan.io/en/tx/${txHash}`
}

export function getExplorerAddressUrl(address: string): string {
  return `https://calibration.filscan.io/en/address/${address}`
}
