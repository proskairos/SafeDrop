'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  Eye,
  Activity,
  Shield,
  Lock,
  ShieldOff,
} from 'lucide-react'
import { agentClient, type PollSummary, type AgentInfo } from '@/lib/agent-client'

// ─── Status Badge (compact, for navbar/create-form) ─────────

export function AgentStatusBadge() {
  const [connected, setConnected] = useState(false)
  const [info, setInfo] = useState<AgentInfo | null>(null)

  useEffect(() => {
    agentClient.connect()

    const unsubConn = agentClient.on('_connection-change', (data) => {
      setConnected(data.connected)
    })
    const unsubInfo = agentClient.on('agent-info', (data) => {
      setInfo(data)
    })

    return () => {
      unsubConn()
      unsubInfo()
    }
  }, [])

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Agent loading...
      </div>
    )
  }

  if (connected && info) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
        <Bot className="h-3 w-3" />
        Agent Online{info.canReveal ? '' : ' (monitor)'}{!info.encryptionEnabled ? ' 🔓' : ''}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs text-red-400">
      <Bot className="h-3 w-3" />
      Agent Offline
    </div>
  )
}

// ─── Full Agent Panel (for dashboard) ──────────────────────

interface ActivityEntry {
  id: string
  type: 'release-detected' | 'share-revealed' | 'reveal-failed' | 'share2-registered' | 'reveal-submitted'
  willId: number
  message: string
  timestamp: string
  txHash?: string
}

export function AgentPanel() {
  const [connected, setConnected] = useState(false)
  const [info, setInfo] = useState<AgentInfo | null>(null)
  const [pollData, setPollData] = useState<PollSummary | null>(null)
  const [activities, setActivities] = useState<ActivityEntry[]>([])

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  useEffect(() => {
    agentClient.connect()
    agentClient.getStatus()

    const unsubs = [
      agentClient.on('_connection-change', (data) => setConnected(data.connected)),
      agentClient.on('agent-info', (data) => setInfo(data)),
      agentClient.on('poll-summary', (data) => setPollData(data)),
      agentClient.on('share2-registered', (data) => {
        setActivities((prev) => {
          const newEntry: ActivityEntry = {
            id: `reg-${data.willId}-${Date.now()}`,
            type: 'share2-registered',
            willId: data.willId,
            message: `Share2 registered for Will #${data.willId}`,
            timestamp: data.timestamp,
          }
          return [newEntry, ...prev].slice(0, 20)
        })
      }),
      agentClient.on('release-detected', (data) => {
        setActivities((prev) => {
          const newEntry: ActivityEntry = {
            id: `rel-${data.willId}-${Date.now()}`,
            type: 'release-detected',
            willId: data.willId,
            message: `🚨 Release detected for Will #${data.willId}!`,
            timestamp: data.detectedAt,
          }
          return [newEntry, ...prev].slice(0, 20)
        })
      }),
      agentClient.on('reveal-submitted', (data) => {
        setActivities((prev) => {
          const newEntry: ActivityEntry = {
            id: `sub-${data.willId}-${Date.now()}`,
            type: 'reveal-submitted',
            willId: data.willId,
            message: `📤 Reveal TX submitted for Will #${data.willId}`,
            timestamp: data.submittedAt,
            txHash: data.txHash,
          }
          return [newEntry, ...prev].slice(0, 20)
        })
      }),
      agentClient.on('share-revealed', (data) => {
        setActivities((prev) => {
          const newEntry: ActivityEntry = {
            id: `rev-${data.willId}-${Date.now()}`,
            type: 'share-revealed',
            willId: data.willId,
            message: `✅ Share2 revealed for Will #${data.willId}`,
            timestamp: data.revealedAt,
            txHash: data.txHash,
          }
          return [newEntry, ...prev].slice(0, 20)
        })
      }),
      agentClient.on('reveal-failed', (data) => {
        setActivities((prev) => {
          const newEntry: ActivityEntry = {
            id: `fail-${data.willId}-${Date.now()}`,
            type: 'reveal-failed',
            willId: data.willId,
            message: `Reveal failed for Will #${data.willId}: ${data.reason}`,
            timestamp: new Date().toISOString(),
          }
          return [newEntry, ...prev].slice(0, 20)
        })
      }),
      agentClient.on('poll-error', (data) => {
        setActivities((prev) => {
          const newEntry: ActivityEntry = {
            id: `pollerr-${Date.now()}`,
            type: 'reveal-failed' as const,
            willId: 0,
            message: `Poll error: ${data.error}`,
            timestamp: data.lastPollTime,
          }
          return [newEntry, ...prev].slice(0, 20)
        })
      }),
      agentClient.on('status', (data) => {
        // Full status with wills[] — update counts
        if (data.monitoredWillCount !== undefined) {
          // Update via pollData if not already set
          setPollData((prev) => prev ? { ...prev, monitored: data.monitoredWillCount, totalRevealed: data.totalRevealed } : { monitored: data.monitoredWillCount, unrevealed: data.monitoredWillCount - data.totalRevealed, totalRevealed: data.totalRevealed, lastPollTime: data.lastPollTime || '' })
        }
      }),
      agentClient.on('error', (data) => {
        setActivities((prev) => [{
          id: `err-${Date.now()}`,
          type: 'reveal-failed' as const,
          willId: 0,
          message: `Agent error: ${data.message}`,
          timestamp: new Date().toISOString(),
        }, ...prev].slice(0, 20))
      }),
    ]

    return () => unsubs.forEach((u) => u())
  }, [])

  if (!mounted) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="glass-card rounded-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              connected ? 'bg-emerald-500/15' : 'bg-red-500/10'
            }`}>
              {connected ? (
                <Bot className="h-5 w-5 text-emerald-400" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Custodian Agent</p>
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
                  connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {connected ? (
                    <><Wifi className="h-2.5 w-2.5" /> Connected</>
                  ) : (
                    <><WifiOff className="h-2.5 w-2.5" /> Disconnected</>
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitors wills &amp; auto-reveals share2 after release
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {connected && (
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>
        </div>

        {/* Agent Info */}
        {connected && info && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Mode</p>
              <div className="flex items-center gap-1.5">
                {info.canReveal ? (
                  <Shield className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-primary" />
                )}
                <p className="text-xs font-medium text-foreground">
                  {info.canReveal ? 'Auto-Reveal' : 'Monitor Only'}
                </p>
              </div>
              {info.agentAddress && (
                <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                  {info.agentAddress.slice(0, 10)}...{info.agentAddress.slice(-6)}
                </p>
              )}
              <div className="flex items-center gap-1 mt-1">
                {info.encryptionEnabled ? (
                  <Lock className="h-2.5 w-2.5 text-emerald-400" />
                ) : (
                  <ShieldOff className="h-2.5 w-2.5 text-amber-400" />
                )}
                <p className={`text-[10px] ${info.encryptionEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {info.encryptionEnabled ? 'DB encrypted' : 'DB unencrypted'}
                </p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Monitored</p>
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-medium text-foreground">
                  {pollData?.monitored ?? info.monitoredWillCount} will(s)
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {pollData?.unrevealed ?? 0} awaiting reveal
              </p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Revealed</p>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <p className="text-xs font-medium text-emerald-400">
                  {pollData?.totalRevealed ?? info.totalRevealed} share(s)
                </p>
              </div>
              {pollData?.lastPollTime && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Last poll: {new Date(pollData.lastPollTime).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Not connected warning */}
        {!connected && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-400">Agent not connected</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                The custodian agent mini-service is not running. Start it with: <code className="text-foreground/60">cd mini-services/custodian-agent &amp;&amp; bun run dev</code>
              </p>
            </div>
          </div>
        )}

        {/* Activity Feed */}
        {activities.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Activity Feed</p>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              <AnimatePresence initial={false}>
                {activities.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
                      entry.type === 'release-detected'
                        ? 'bg-amber-500/5 border border-amber-500/10'
                        : entry.type === 'share-revealed'
                          ? 'bg-emerald-500/5 border border-emerald-500/10'
                          : entry.type === 'reveal-failed'
                            ? 'bg-red-500/5 border border-red-500/10'
                            : entry.type === 'reveal-submitted'
                              ? 'bg-blue-500/5 border border-blue-500/10'
                              : 'bg-secondary/30 border border-border/30'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${
                        entry.type === 'release-detected' ? 'text-amber-400'
                          : entry.type === 'share-revealed' ? 'text-emerald-400'
                          : entry.type === 'reveal-failed' ? 'text-red-400'
                          : entry.type === 'reveal-submitted' ? 'text-blue-400'
                          : 'text-foreground/80'
                      }`}>
                        {entry.message}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        {entry.txHash && (
                          <a
                            href={`https://calibration.filscan.io/en/tx/${entry.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline"
                          >
                            View TX →
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* No activity */}
        {connected && activities.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/20 border border-border/30">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              No activity yet. Create a will and the agent will start monitoring it.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
