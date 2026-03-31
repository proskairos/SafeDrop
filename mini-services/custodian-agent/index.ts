// ─── SafeDrop Custodian Agent ───────────────────────────────
// Holds share2 off-chain (encrypted at rest), monitors contract
// for releases, auto-reveals share2 on-chain after release detected.
//
// Security: share2 data is AES-256-GCM encrypted in the SQLite DB.
// - If DB_ENCRYPTION_KEY is set → uses that as master key
// - Else if AGENT_PRIVATE_KEY is set → derives key via HKDF (one secret, two purposes)
// - Else → dev mode (plaintext + loud warning on startup)
//
// Deployment: designed for Render background service / Railway / Fly.io

import { createServer } from 'http'
import { Server } from 'socket.io'
import { createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { PrismaClient } from '@prisma/client'
import {
  getEncryptionKey,
  isEncryptionEnabled,
  encryptAtRest,
  decryptAtRest,
  generateDbEncryptionKey,
} from './crypto.js'

// ─── Configuration ──────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3003', 10)
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30000', 10)
const SOCKET_PATH = process.env.SOCKET_PATH || '/socket.io'
const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || '0x06f14713198eA009fC98246164159e41C7Ec3A0B') as `0x${string}`

// ─── Encryption Setup ───────────────────────────────────────
const masterKey = getEncryptionKey()
const encryptionEnabled = isEncryptionEnabled()

if (!encryptionEnabled) {
  console.warn('┌─────────────────────────────────────────────────────────────────┐')
  console.warn('│ WARNING  ENCRYPTION DISABLED — share2 stored as PLAIN TEXT in DB    │')
  console.warn('│                                                                 │')
  console.warn('│ Set DB_ENCRYPTION_KEY or AGENT_PRIVATE_KEY to enable.          │')
  console.warn('│ Generate one:                                                  │')
  console.warn('│   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"  │')
  console.warn('└─────────────────────────────────────────────────────────────────┘')
} else {
  console.log(`[agent] Encryption at rest: ENABLED (key source: ${process.env.DB_ENCRYPTION_KEY ? 'DB_ENCRYPTION_KEY' : 'derived from AGENT_PRIVATE_KEY'})`)
}

// ─── Filecoin Calibration Chain ─────────────────────────────
const filecoinCalibration = defineChain({
  id: 314159,
  name: 'Filecoin Calibration',
  nativeCurrency: { name: 'Filecoin', symbol: 'tFIL', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1'] },
  },
})

// ─── Contract ABI (minimal — only what agent needs) ─────────
const AGENT_ABI = [
  {
    type: 'function',
    name: 'getWill',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [{
      name: '', type: 'tuple',
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
    }],
    stateMutability: 'view',
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
] as const

// ─── Clients ───────────────────────────────────────────────
const prisma = new PrismaClient()

const publicClient = createPublicClient({
  chain: filecoinCalibration,
  transport: http(),
  cacheTime: 0,
})

// Agent wallet — uses env var AGENT_PRIVATE_KEY
// If not set, agent runs in "monitor-only" mode (can track but can't reveal)
function getWalletClient() {
  const pk = process.env.AGENT_PRIVATE_KEY
  if (!pk || pk === '') return null
  try {
    // Normalize private key: ensure 0x prefix and lowercase
    const normalizedKey = pk.startsWith('0x') ? pk.toLowerCase() : `0x${pk.toLowerCase()}`

    // Derive account from private key using viem's proper method
    const account = privateKeyToAccount(normalizedKey as `0x${string}`)

    // Create wallet client with the properly derived account
    return createWalletClient({
      chain: filecoinCalibration,
      transport: http(),
      account,
    })
  } catch {
    return null
  }
}

// ─── HTTP Server + Health Check ────────────────────────────
const httpServer = createServer()

httpServer.on('error', (err) => {
  console.error('[agent] HTTP server error:', err)
})
httpServer.on('close', () => {
  console.warn('[agent] HTTP server closed unexpectedly')
})

// Health check endpoint — used by Render / Railway / Fly.io for monitoring
httpServer.on('request', (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      encryption: encryptionEnabled ? 'enabled' : 'disabled',
      mode: wallet ? 'auto-reveal' : 'monitor-only',
      monitored: monitoredWillCount,
      revealed: totalRevealed,
      lastPoll: lastPollTime,
    }))
    return
  }

  // Fallback: 404 for non-socket.io, non-health requests
  res.writeHead(404)
  res.end('Not Found')
})

// ─── Socket.IO Server ──────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // SOCKET_PATH:
  //   '/socket.io' → default, works for direct connections (Render, Railway, local)
  //   '/'           → required for this sandbox's Caddy XTransformPort proxy
  path: SOCKET_PATH,
})

io.on('error', (err) => {
  console.error('[agent] Socket.IO server error:', err)
})

// ─── State ─────────────────────────────────────────────────
let monitoredWillCount = 0
let totalRevealed = 0
let lastPollTime: string | null = null
let lastPollError: string | null = null
let agentAddress: string | null = null

const wallet = getWalletClient()
if (wallet) {
  agentAddress = wallet.account.address
}

// ─── Encrypt/Decrypt helpers (wraps crypto.ts for DB ops) ──

function encryptShare2(share2Hex: string): string {
  if (!masterKey) return share2Hex // dev mode: plaintext
  return encryptAtRest(share2Hex, masterKey)
}

function decryptShare2(encrypted: string): string | null {
  if (!masterKey) return encrypted // dev mode: already plaintext
  return decryptAtRest(encrypted, masterKey)
}

// ─── Socket Event Handlers ──────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[agent] Client connected: ${socket.id}`)

  // Send agent info on connect
  socket.emit('agent-info', {
    status: wallet ? 'connected' : 'monitor-only',
    agentAddress,
    canReveal: !!wallet,
    encryptionEnabled,
    monitoredWillCount,
    totalRevealed,
    lastPollTime,
    lastPollError,
    message: wallet
      ? `Agent is online. Auto-reveal enabled. Encryption: ${encryptionEnabled ? 'ON' : 'OFF (dev mode)'}.`
      : `Agent online in MONITOR-ONLY mode. Encryption: ${encryptionEnabled ? 'ON' : 'OFF'}. Set AGENT_PRIVATE_KEY for auto-reveal.`,
  })

  // Register share2 for a will
  socket.on('register-share2', async (data: { willId: number; share2Hex: string; ownerAddress?: string; cid?: string }) => {
    try {
      const { willId, share2Hex, ownerAddress, cid } = data

      if (!share2Hex || (!willId && willId !== 0)) {
        socket.emit('error', { message: 'Invalid data: willId and share2Hex required' })
        return
      }

      // Encrypt share2 before storing
      const share2Encrypted = encryptShare2(share2Hex)

      await prisma.willShare.upsert({
        where: { willId },
        create: { willId, share2Encrypted, ownerAddress, cid },
        update: { share2Encrypted, ownerAddress, cid },
      })

      monitoredWillCount = await prisma.willShare.count()
      console.log(`[agent] Share2 registered for will #${willId} (total: ${monitoredWillCount}, encrypted: ${encryptionEnabled})`)

      socket.emit('share2-registered', {
        success: true,
        willId,
        monitoredWillCount,
        timestamp: new Date().toISOString(),
      })

      socket.broadcast.emit('share2-registered', {
        success: true,
        willId,
        monitoredWillCount,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to register share2'
      socket.emit('error', { message: msg })
      console.error(`[agent] register-share2 error:`, msg)
    }
  })

  // Get status of all monitored wills
  socket.on('get-status', async () => {
    try {
      const shares = await prisma.willShare.findMany({
        orderBy: { createdAt: 'desc' },
      })
      socket.emit('status', {
        monitoredWillCount: shares.length,
        totalRevealed,
        lastPollTime,
        lastPollError,
        encryptionEnabled,
        wills: shares.map((s) => ({
          willId: s.willId,
          createdAt: s.createdAt,
          revealedAt: s.revealedAt,
          revealTxHash: s.revealTxHash,
        })),
      })
    } catch (err) {
      socket.emit('error', { message: 'Failed to get status' })
    }
  })

  socket.on('disconnect', (reason) => {
    console.log(`[agent] Client disconnected: ${socket.id}, reason: ${reason}`)
  })

  socket.on('error', (err) => {
    console.error(`[agent] Socket error for ${socket.id}:`, err)
  })
})

// ─── Background Poller ─────────────────────────────────────
async function pollAndReveal() {
  lastPollTime = new Date().toISOString()
  lastPollError = null

  try {
    const monitoredShares = await prisma.willShare.findMany({
      where: { revealedAt: null },
    })

    monitoredWillCount = await prisma.willShare.count()
    console.log(`[poll] Checking ${monitoredShares.length} unrevealed will(s)...`)

    for (const share of monitoredShares) {
      try {
        const will = await Promise.race([
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: AGENT_ABI,
            functionName: 'getWill',
            args: [BigInt(share.willId)],
          }) as any,
          new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout after 30s')), 30000)
      ),
        ]) as any

        if (!will.exists) {
          console.log(`[poll] Will #${share.willId} does not exist on-chain, skipping`)
          continue
        }

        // Debug: log contract state
        console.log(`[poll] Will #${share.willId} state: isReleased=${will.isReleased}, revealed=${will.revealed}`)
// Sync DB state with contract state if out of sync
if (will.revealed && !share.revealedAt) {
  console.log(`[poll] SYNC: Will #${share.willId} is revealed on-chain but not in DB. Updating DB state...`)
  await prisma.willShare.update({
    where: { willId: share.willId },
    data: { revealedAt: new Date() },
  })
  totalRevealed++

  io.emit('share-revealed', {
    willId: share.willId,
    txHash: share.revealTxHash || 'unknown',
    revealedAt: new Date().toISOString(),
    totalRevealed,
  })
  continue
}

// Reveal if released but not yet revealed on-chain AND not already attempting
if (will.isReleased && !will.revealed && !share.revealTxHash) {
          console.log(`[poll] ALERT Release detected for Will #${share.willId}! Revealing share2...`)

          io.emit('release-detected', {
            willId: share.willId,
            detectedAt: lastPollTime,
            owner: will.owner,
            beneficiary: will.beneficiary,
          })

          if (!wallet) {
            console.log(`[poll] WARNING No wallet configured. Cannot reveal share2 for will #${share.willId}. Set AGENT_PRIVATE_KEY.`)
            io.emit('reveal-failed', {
              willId: share.willId,
              reason: 'No wallet configured. Set AGENT_PRIVATE_KEY env var.',
            })
            continue
          }

          // Decrypt share2 from DB
          const share2Hex = decryptShare2(share.share2Encrypted)
          if (!share2Hex) {
            console.error(`[poll] ERROR Failed to decrypt share2 for Will #${share.willId}. Data may be corrupted.`)
            io.emit('reveal-failed', {
              willId: share.willId,
              reason: 'Failed to decrypt share2 from database. Data may be corrupted or encryption key changed.',
            })
            continue
          }

          try {
            const cleanHex = share2Hex.startsWith('0x') ? share2Hex.slice(2) : share2Hex
            const share2Bytes = `0x${cleanHex}` as `0x${string}`
            console.log(`[poll] Attempting reveal TX for Will #${share.willId}...`)
            const hash = await wallet.writeContract({
              address: CONTRACT_ADDRESS,
              abi: AGENT_ABI,
              functionName: 'revealShare',
              args: [BigInt(share.willId), share2Bytes],
            })

            console.log(`[poll] TX submitted: ${hash}. Will check confirmation on next poll cycle...`)
            
            // Store tx hash in DB immediately to prevent duplicate attempts
            await prisma.willShare.update({
              where: { willId: share.willId },
              data: { revealTxHash: hash },
            })
            
            io.emit('reveal-submitted', {
              willId: share.willId,
              txHash: hash,
              submittedAt: new Date().toISOString(),
            })
          } catch (txErr) {
            const txMsg = txErr instanceof Error ? txErr.message : 'Unknown transaction error'
            
            // Check if error is "AlreadyRevealed" - means TX actually succeeded
            const isAlreadyRevealed = txMsg.includes('0xa3a57894') || txMsg.includes('AlreadyRevealed')
            
            if (isAlreadyRevealed) {
              console.log(`[poll] Will #${share.willId} already revealed (TX succeeded). Syncing DB...`)
              await prisma.willShare.update({
                where: { willId: share.willId },
                data: { revealedAt: new Date() },
              })
              totalRevealed++
              io.emit('share-revealed', {
                willId: share.willId,
                txHash: 'unknown',
                revealedAt: new Date().toISOString(),
                totalRevealed,
              })
            } else {
              console.error(`[poll] ERROR Reveal TX failed for Will #${share.willId}:`, txMsg)
              
              // Clear revealTxHash so it can retry on next poll
              await prisma.willShare.update({
                where: { willId: share.willId },
                data: { revealTxHash: null },
              })
              
              io.emit('reveal-failed', {
                willId: share.willId,
                reason: `${txMsg}. Will retry on next poll.`,
              })
            }
          }
        }
      } catch (readErr) {
        console.error(`[poll] Error reading Will #${share.willId}:`, readErr)
      }
    }

    io.emit('poll-summary', {
      monitored: monitoredWillCount,
      unrevealed: monitoredShares.length,
      totalRevealed,
      lastPollTime,
    })
  } catch (err) {
    lastPollError = err instanceof Error ? err.message : 'Poll error'
    console.error(`[poll] Poll error:`, lastPollError)
    io.emit('poll-error', { error: lastPollError, lastPollTime })
  }
}

// ─── Process Safety ────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[agent] UNCAUGHT EXCEPTION:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[agent] UNHANDLED REJECTION:', reason)
})
process.on('SIGINT', () => {
  console.log('[agent] SIGINT — shutting down gracefully')
  process.exit(0)
})
process.on('SIGTERM', () => {
  console.log('[agent] SIGTERM — shutting down gracefully')
  process.exit(0)
})

// ─── Start ─────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log('')
  console.log('  ╔══════════════════════════════════════════════════╗')
  console.log('  ║        SafeDrop Custodian Agent                  ║')
  console.log('  ╠══════════════════════════════════════════════════╣')
  console.log(`  ║  Port:           ${String(PORT).padEnd(36)}║`)
  console.log(`  ║  Socket path:    ${SOCKET_PATH.padEnd(36)}║`)
  console.log(`  ║  Encryption:     ${(encryptionEnabled ? 'AES-256-GCM' : 'DISABLED (dev)').padEnd(36)}║`)
  console.log(`  ║  Wallet:         ${(agentAddress || 'NOT CONFIGURED (monitor-only)').padEnd(36)}║`)
  console.log(`  ║  Poll interval:  ${(POLL_INTERVAL / 1000 + 's').padEnd(36)}║`)
  console.log(`  ║  Contract:       ${CONTRACT_ADDRESS.padEnd(36)}║`)
  console.log('  ╠══════════════════════════════════════════════════╣')
  console.log(`  ║  Health:         http://localhost:${PORT}/health${' '.repeat(20)}║`)
  console.log('  ╚══════════════════════════════════════════════════╝')
  console.log('')
})

// Keep event loop alive
const keepAlive = setInterval(() => {}, 10_000)
process.on('exit', () => clearInterval(keepAlive))

// Initial poll after 5s delay
setTimeout(() => {
  pollAndReveal().catch((err) => console.error('[agent] Initial poll error:', err))
}, 5000)

// Infinite poll loop
async function pollLoop() {
  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))
    try {
      await pollAndReveal()
    } catch (err) {
      console.error('[agent] Poll loop error:', err)
    }
  }
}
pollLoop().catch((err) => {
  console.error('[agent] Fatal poll loop error:', err)
})
