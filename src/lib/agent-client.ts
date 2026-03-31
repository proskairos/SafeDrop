// ─── SafeDrop Custodian Agent Client ─────────────────────────
// Singleton Socket.IO client for real-time communication
// with the custodian agent mini-service.
//
// Connection modes:
//   1. NEXT_PUBLIC_AGENT_URL is set (e.g. "https://safedrop-agent.onrender.com")
//      → Connects directly to the deployed agent using standard /socket.io path
//   2. No NEXT_PUBLIC_AGENT_URL (or empty)
//      → Connects through the Caddy proxy using XTransformPort query param
//        (sandbox development mode)
//
// Usage:
//   import { agentClient } from '@/lib/agent-client'
//   agentClient.registerShare2(willId, share2Hex, ownerAddress, cid)
//   agentClient.on('share-revealed', (data) => { ... })

import { io, Socket } from 'socket.io-client'

// ─── Agent Event Types ──────────────────────────────────────

export interface AgentInfo {
  status: 'connected' | 'monitor-only'
  agentAddress: string | null
  canReveal: boolean
  encryptionEnabled?: boolean
  monitoredWillCount: number
  totalRevealed: number
  lastPollTime: string | null
  lastPollError: string | null
  message: string
}

export interface Share2Registered {
  success: boolean
  willId: number
  monitoredWillCount: number
  timestamp: string
}

export interface ReleaseDetected {
  willId: number
  detectedAt: string
  owner: string
  beneficiary: string
}

export interface ShareRevealed {
  willId: number
  txHash: string
  revealedAt: string
  totalRevealed: number
}

export interface RevealFailed {
  willId: number
  reason: string
}

export interface PollSummary {
  monitored: number
  unrevealed: number
  totalRevealed: number
  lastPollTime: string
}

export interface MonitoredWill {
  willId: number
  createdAt: string
  revealedAt: string | null
  revealTxHash: string | null
}

export interface AgentStatus {
  monitoredWillCount: number
  totalRevealed: number
  lastPollTime: string | null
  lastPollError: string | null
  encryptionEnabled?: boolean
  wills: MonitoredWill[]
}

export type AgentEventMap = {
  'agent-info': AgentInfo
  'share2-registered': Share2Registered
  'release-detected': ReleaseDetected
  'share-revealed': ShareRevealed
  'reveal-failed': RevealFailed
  'poll-summary': PollSummary
  'poll-error': { error: string; lastPollTime: string }
  'status': AgentStatus
  'error': { message: string }
}

// ─── Connection Config ─────────────────────────────────────

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || ''

/**
 * Determine if we're in sandbox proxy mode or direct deploy mode.
 *
 * Sandbox mode:   agent URL is empty → route through Caddy via XTransformPort
 * Deployed mode:  agent URL is set → connect directly
 */
function getConnectionConfig(): { url: string; path: string } {
  if (AGENT_URL) {
    // Direct connection to deployed agent (Render, Railway, Fly.io, etc.)
    return {
      url: AGENT_URL,
      path: '/socket.io',
    }
  }

  // Sandbox mode — route through Caddy proxy
  return {
    url: '/?XTransformPort=3003',
    path: '/',
  }
}

// ─── Singleton Client ───────────────────────────────────────

class AgentClient {
  private socket: Socket | null = null
  private listeners: Map<string, Set<(data: any) => void>> = new Map()
  private _isConnected = false
  private _agentInfo: AgentInfo | null = null
  private _pollSummary: PollSummary | null = null

  get isConnected(): boolean {
    return this._isConnected
  }

  get agentInfo(): AgentInfo | null {
    return this._agentInfo
  }

  get pollSummary(): PollSummary | null {
    return this._pollSummary
  }

  get connectionMode(): 'deployed' | 'sandbox' {
    return AGENT_URL ? 'deployed' : 'sandbox'
  }

  connect(): void {
    if (this.socket?.connected) {
      // Already connected - emit current state for new listeners (deferred to next tick)
      queueMicrotask(() => {
        this.emit('_connection-change', { connected: true })
        if (this._agentInfo) {
          this.emit('agent-info', this._agentInfo)
        }
        if (this._pollSummary) {
          this.emit('poll-summary', this._pollSummary)
        }
      })
      return
    }

    const { url, path } = getConnectionConfig()

    this.socket = io(url, {
      path,
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
    })

    this.socket.on('connect', () => {
      this._isConnected = true
      console.log(`[agent-client] Connected (${this.connectionMode} mode)`)
      this.emit('_connection-change', { connected: true })
    })

    this.socket.on('disconnect', () => {
      this._isConnected = false
      this.emit('_connection-change', { connected: false })
    })

    this.socket.on('connect_error', (err) => {
      console.warn('[agent-client] Connection error:', err.message)
      this._isConnected = false
    })

    // Wire up built-in event tracking
    this.socket.on('agent-info', (data: AgentInfo) => {
      this._agentInfo = data
      this.emit('agent-info', data)
    })

    this.socket.on('poll-summary', (data: PollSummary) => {
      this._pollSummary = data
      this.emit('poll-summary', data)
    })

    // Wire up all other events
    const eventNames = [
      'share2-registered', 'release-detected', 'share-revealed',
      'reveal-failed', 'poll-error', 'status', 'error',
    ] as const

    for (const event of eventNames) {
      this.socket.on(event, (data: any) => {
        this.emit(event, data)
      })
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
      this._isConnected = false
      this._agentInfo = null
      this._pollSummary = null
      this.emit('_connection-change', { connected: false })
    }
  }

  registerShare2(willId: number, share2Hex: string, ownerAddress?: string, cid?: string): void {
    if (!this.socket?.connected) {
      console.warn('[agent-client] Cannot register: not connected to agent')
      return
    }
    this.socket.emit('register-share2', { willId, share2Hex, ownerAddress, cid })
  }

  getStatus(): void {
    if (!this.socket?.connected) return
    this.socket.emit('get-status')
  }

  on<K extends keyof AgentEventMap>(event: K, callback: (data: AgentEventMap[K]) => void): () => void
  on(event: '_connection-change', callback: (data: { connected: boolean }) => void): () => void
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  off(event: string, callback: (data: any) => void): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach((cb) => cb(data))
  }
}

// ─── Export Singleton ───────────────────────────────────────
export const agentClient = new AgentClient()
