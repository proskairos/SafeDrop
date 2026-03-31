'use client'

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount } from 'wagmi'
import {
  Shield,
  Clock,
  HeartPulse,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Timer,
  KeyRound,
  Eye,
  EyeOff,
  ExternalLink,
  Blocks,
  Wallet,
  Loader2,
  ArrowRight,
  Hexagon,
  Landmark,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSafeDropStore, type SafeItem, type SafeStatus } from '@/store/safedrop-store'
import {
  useGetWill,
  useGetOwnerWills,
  useCheckIn,
  useTriggerRelease,
  useOwnerRelease,
  useRevealShare,
  useCanRelease,
  useGetTimeUntilRelease,
} from '@/hooks/use-dead-mans-switch'
import {
  type OnChainWill,
  type WillStatus,
  getWillStatus,
  formatTimeRemaining,
  truncateAddress,
  getExplorerTxUrl,
  getExplorerAddressUrl,
} from '@/lib/contract'
import { useToast } from '@/hooks/use-toast'
import { AgentPanel } from '@/components/safedrop/agent-panel'

function getTimeRemaining(lastActive: number, timeoutDays: number) {
  const now = Date.now()
  const timeoutMs = timeoutDays * 24 * 60 * 60 * 1000
  const remaining = timeoutMs - (now - lastActive)
  if (remaining <= 0) return { days: 0, hours: 0, minutes: 0, total: 0, expired: true }
  return {
    days: Math.floor(remaining / (1000 * 60 * 60 * 24)),
    hours: Math.floor((remaining / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((remaining / (1000 * 60)) % 60),
    total: remaining,
    expired: false,
  }
}

function StatusBadge({ status }: { status: WillStatus }) {
  const config = {
    active: { className: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5', label: 'Active', icon: CheckCircle2 },
    warning: { className: 'border-amber-500/30 text-amber-400 bg-amber-500/5', label: 'Expiring Soon', icon: AlertTriangle },
    expired: { className: 'border-red-500/30 text-red-400 bg-red-500/5', label: 'Expired', icon: AlertTriangle },
    released: { className: 'border-blue-500/30 text-blue-400 bg-blue-500/5', label: 'Released', icon: CheckCircle2 },
  }
  const c = config[status]
  const Icon = c.icon
  return (
    <Badge variant="outline" className={`${c.className} gap-1.5 px-3 py-1`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  )
}

function LocalSafeCard({ safe, index }: { safe: SafeItem; index: number }) {
  const { updateSafeActivity, removeSafe } = useSafeDropStore()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [isAliveLoading, setIsAliveLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining(safe.lastActive, safe.timeoutDays))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeRemaining(safe.lastActive, safe.timeoutDays))
    }, 60000)
    return () => clearInterval(interval)
  }, [safe.lastActive, safe.timeoutDays])

  const handleImAlive = async () => {
    setIsAliveLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    updateSafeActivity(safe.id)
    setTimeLeft(getTimeRemaining(Date.now(), safe.timeoutDays))
    setIsAliveLoading(false)
    toast({ title: 'Activity confirmed!', description: `Timer for "${safe.title}" has been reset.` })
  }

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    toast({ title: 'Copied', description: `${label} copied to clipboard.` })
  }

  const progressPercent = useMemo(() => {
    if (timeLeft.expired) return 100
    const total = safe.timeoutDays * 24 * 60 * 60 * 1000
    const elapsed = total - timeLeft.total
    return Math.min((elapsed / total) * 100, 100)
  }, [timeLeft.total, safe.timeoutDays])

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.1 }} layout>
      <div className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 ${safe.status === 'warning' ? 'border-amber-500/25' : safe.status === 'expired' || safe.status === 'released' ? 'border-red-500/20' : 'border-border/50'}`}>
        <div className="h-0.5 bg-secondary w-full">
          <motion.div className={`h-full transition-all duration-1000 ${safe.status === 'warning' ? 'bg-amber-500' : safe.status === 'expired' ? 'bg-red-500' : 'bg-primary'}`} initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1.5">
                <h3 className="text-base font-semibold text-foreground truncate">{safe.title}</h3>
                <StatusBadge status={safe.status} />
                <Badge variant="secondary" className="text-[10px] gap-1 opacity-60">
                  <Shield className="h-2.5 w-2.5" />
                  Local
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                <span className="truncate">{safe.recipient}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {(safe.status === 'active' || safe.status === 'warning') && (
                <Button onClick={handleImAlive} disabled={isAliveLoading} size="sm" variant="outline" className={`gap-2 h-9 ${safe.status === 'warning' ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-primary/30 text-primary hover:bg-primary/10'}`}>
                  {isAliveLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HeartPulse className="h-3.5 w-3.5" />}
                  I&apos;m Alive
                </Button>
              )}
              <button onClick={() => setExpanded(!expanded)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {timeLeft.expired ? (
                <span className="text-sm text-red-400 font-medium animate-countdown-pulse">Timer expired</span>
              ) : (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className={`font-mono font-semibold tabular-nums ${safe.status === 'warning' ? 'text-amber-400' : 'text-foreground'}`}>{timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m</span>
                  <span className="text-muted-foreground">remaining</span>
                </div>
              )}
            </div>
            <Badge variant="secondary" className="text-xs gap-1"><Timer className="h-3 w-3" />{safe.timeoutDays}-day timer</Badge>
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                <div className="pt-4 border-t border-border/50 space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ExternalLink className="h-3 w-3" />Content Identifier (CID)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-secondary/50 rounded-lg px-3 py-2 text-foreground/70 break-all font-mono">{safe.cid}</code>
                      <button onClick={() => handleCopy(safe.cid, 'CID')} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"><Copy className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><KeyRound className="h-3 w-3" />Encryption Key</p>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <code className="block text-xs bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2 text-foreground/70 break-all font-mono pr-10">{showKey ? safe.encryptionKey : '••••••••••••••••••••••••••••••••'}</code>
                        <button onClick={() => setShowKey(!showKey)} className="absolute top-1.5 right-1.5 p-1 rounded text-muted-foreground hover:text-foreground transition-colors">{showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                      </div>
                      <button onClick={() => handleCopy(safe.encryptionKey, 'Encryption Key')} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"><Copy className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Created {new Date(safe.createdAt).toLocaleDateString()}</span>
                    <span>Last active {new Date(safe.lastActive).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button variant="ghost" size="sm" onClick={() => removeSafe(safe.id)} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-2"><Trash2 className="h-3.5 w-3.5" />Delete Safe</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

function OnChainWillCard({ will, index }: { will: OnChainWill; index: number }) {
  const { address } = useAccount()
  const { checkIn, hash: pingHash, isPending: isPinging, isSuccess: isPingSuccess } = useCheckIn()
  const { triggerRelease, hash: releaseHash, isPending: isReleasing, isSuccess: isReleaseSuccess } = useTriggerRelease()
  const { ownerRelease, hash: ownerReleaseHash, isPending: isOwnerReleasing, isSuccess: isOwnerReleaseSuccess } = useOwnerRelease()
  const { revealShare, hash: revealHash, isPending: isRevealing, isSuccess: isRevealSuccess } = useRevealShare()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)

  const status = getWillStatus(will)
  const timeLeft = formatTimeRemaining(will)
  const progressPercent = useMemo(() => {
    const totalSeconds = Number(will.timeoutDuration)
    if (totalSeconds <= 0) return 100
    const now = Math.floor(Date.now() / 1000)
    const elapsed = now - Number(will.lastCheckIn)
    return Math.min((elapsed / totalSeconds) * 100, 100)
  }, [will.timeoutDuration, will.lastCheckIn])

  const isOwner = address?.toLowerCase() === will.owner.toLowerCase()

  const handlePing = () => {
    if (will.willId !== undefined) checkIn(will.willId)
  }

  const handleRelease = () => {
    if (will.willId !== undefined) triggerRelease(will.willId)
  }

  const handleOwnerRelease = () => {
    if (will.willId !== undefined) ownerRelease(will.willId)
  }

  const handleRevealShare = () => {
    if (will.willId !== undefined) {
      // For now, prompt the user for share2 hex. Agent will automate this later.
      const share2Hex = prompt('Enter share2 as hex (0x...):') as `0x${string}` | null
      if (share2Hex) revealShare(will.willId, share2Hex)
    }
  }

  useEffect(() => {
    if (isPingSuccess) {
      toast({ title: 'Check-in confirmed!', description: 'Your deadline has been reset.' })
    }
  }, [isPingSuccess, toast])

  useEffect(() => {
    if (isReleaseSuccess) {
      toast({ title: 'Will released', description: 'The will has been marked as released on-chain.' })
    }
  }, [isReleaseSuccess, toast])

  useEffect(() => {
    if (isOwnerReleaseSuccess) {
      toast({ title: 'Owner release confirmed', description: 'You have released this will early.' })
    }
  }, [isOwnerReleaseSuccess, toast])

  useEffect(() => {
    if (isRevealSuccess) {
      toast({ title: 'Share revealed', description: 'XOR share2 has been stored on-chain. Beneficiary can now decrypt.' })
    }
  }, [isRevealSuccess, toast])

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.1 }} layout>
      <div className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 ${status === 'warning' ? 'border-amber-500/25' : status === 'expired' ? 'border-red-500/20' : status === 'released' ? 'border-blue-500/20' : 'border-border/50'}`}>
        <div className="h-0.5 bg-secondary w-full">
          <motion.div className={`h-full transition-all duration-1000 ${status === 'warning' ? 'bg-amber-500' : status === 'expired' || status === 'released' ? 'bg-red-500' : 'bg-primary'}`} initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1.5">
                <StatusBadge status={status} />
                <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/5">
                  <Blocks className="h-2.5 w-2.5" />
                  #{will.willId}
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/5">
                  <Landmark className="h-2.5 w-2.5" />
                  On-Chain
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                <span className="text-xs">Beneficiary:</span>
                <code className="text-xs font-mono text-foreground/80">{truncateAddress(will.beneficiary)}</code>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {(status === 'active' || status === 'warning') && (
                <Button onClick={handlePing} disabled={isPinging} size="sm" variant="outline" className={`gap-2 h-9 ${status === 'warning' ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-primary/30 text-primary hover:bg-primary/10'}`}>
                  {isPinging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HeartPulse className="h-3.5 w-3.5" />}
                  Check-In
                </Button>
              )}
              {status === 'expired' && !will.isReleased && (
                <Button onClick={handleRelease} disabled={isReleasing} size="sm" variant="outline" className="gap-2 h-9 border-red-500/30 text-red-400 hover:bg-red-500/10">
                  {isReleasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hexagon className="h-3.5 w-3.5" />}
                  Release
                </Button>
              )}
              {(status === 'active' || status === 'warning') && isOwner && (
                <Button onClick={handleOwnerRelease} disabled={isOwnerReleasing} size="sm" variant="outline" className="gap-2 h-9 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                  {isOwnerReleasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  Owner Release
                </Button>
              )}
              {status === 'released' && !will.revealed && (
                <Button onClick={handleRevealShare} disabled={isRevealing} size="sm" variant="outline" className="gap-2 h-9 border-primary/30 text-primary hover:bg-primary/10">
                  {isRevealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  Reveal Share
                </Button>
              )}
              <button onClick={() => setExpanded(!expanded)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {timeLeft.expired ? (
                <span className="text-sm text-red-400 font-medium">Deadline passed</span>
              ) : (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className={`font-mono font-semibold tabular-nums ${status === 'warning' ? 'text-amber-400' : 'text-foreground'}`}>{timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m</span>
                  <span className="text-muted-foreground">remaining</span>
                </div>
              )}
            </div>
            <Badge variant="secondary" className="text-xs gap-1">
              <Timer className="h-3 w-3" />
              {Number(will.timeoutDuration) / 86400}-day timer
            </Badge>
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                <div className="pt-4 border-t border-border/50 space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">IPFS CID (stored on-chain)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-secondary/50 rounded-lg px-3 py-2 text-foreground/70 break-all font-mono">{will.cid || '(empty)'}</code>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                    <div>
                      <p className="mb-1">Last Check-In</p>
                      <code className="text-foreground/70">{will.lastCheckIn > 0n ? new Date(Number(will.lastCheckIn) * 1000).toLocaleString() : 'Never'}</code>
                    </div>
                    <div>
                      <p className="mb-1">Timeout Duration</p>
                      <code className="text-foreground/70">{Number(will.timeoutDuration) / 86400} days</code>
                    </div>
                    <div>
                      <p className="mb-1">Released</p>
                      <code className="text-foreground/70">{will.isReleased ? 'Yes' : 'No'}</code>
                    </div>
                    <div>
                      <p className="mb-1">Share2 Revealed</p>
                      <code className={will.revealed ? 'text-emerald-400' : 'text-foreground/70'}>{will.revealed ? 'Yes' : 'Not yet'}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <a href={getExplorerAddressUrl(will.owner)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                      Owner on Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                    <a href={getExplorerAddressUrl(will.beneficiary)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                      Beneficiary on Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                    {pingHash && (
                      <a href={getExplorerTxUrl(pingHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                        Check-In TX <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {releaseHash && (
                      <a href={getExplorerTxUrl(releaseHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
                        Release TX <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {ownerReleaseHash && (
                      <a href={getExplorerTxUrl(ownerReleaseHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
                        Owner Release TX <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {revealHash && (
                      <a href={getExplorerTxUrl(revealHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                        Reveal Share TX <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

function OnChainWillsSection({ ownerAddress }: { ownerAddress: string }) {
  const { data: willIds, isLoading: isLoadingIds } = useGetOwnerWills(ownerAddress as `0x${string}`)

  if (isLoadingIds) {
    return (
      <div className="mb-6 flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 text-primary animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Reading from blockchain...</span>
      </div>
    )
  }

  if (!willIds || willIds.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Blocks className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">On-Chain Wills</h4>
        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5 gap-1">
          {willIds.length} will{willIds.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      <div className="space-y-4">
        {willIds.map((willId, index) => (
          <OnChainWillById key={willId} willId={willId} index={index} />
        ))}
      </div>
    </div>
  )
}

function OnChainWillById({ willId, index }: { willId: number; index: number }) {
  const { data: will, isLoading, isError } = useGetWill(willId)

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-5 flex items-center gap-3">
        <Loader2 className="h-4 w-4 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Loading will #{willId}...</span>
      </div>
    )
  }

  if (isError || !will) return null

  return <OnChainWillCard will={will} index={index} />
}

export function MySafes() {
  const { safes, setCurrentView, refreshSafeStatuses } = useSafeDropStore()
  const { address, isConnected } = useAccount()

  // Hydration guard
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  useEffect(() => {
    refreshSafeStatuses()
  }, [refreshSafeStatuses])

  const activeSafes = safes.filter((s) => s.status === 'active' || s.status === 'warning')
  const expiredSafes = safes.filter((s) => s.status === 'expired')
  const releasedSafes = safes.filter((s) => s.status === 'released')

  return (
    <section className="relative py-24 lg:py-32 min-h-screen">
      <div className="absolute top-0 left-0 right-0 section-divider" />
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-4">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">My Wills</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Your <span className="text-gradient-emerald">Encrypted Wills</span></h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Monitor and manage your dead man&apos;s switches. Check-in to prove you&apos;re alive, or release expired wills.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: safes.length, color: 'text-foreground' },
            { label: 'Active', value: activeSafes.length, color: 'text-emerald-400' },
            { label: 'Warning', value: expiredSafes.length, color: 'text-amber-400' },
            { label: 'Released', value: releasedSafes.length, color: 'text-blue-400' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Wallet connect CTA */}
        {mounted && !isConnected && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="mb-8">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between glass-card rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Connect wallet to see on-chain wills</p>
                  <p className="text-xs text-muted-foreground">Your on-chain dead man&apos;s switches will appear here.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* On-chain wills section */}
        {mounted && isConnected && address && (
          <>
            <AgentPanel />
            <OnChainWillsSection ownerAddress={address} />
          </>
        )}

        {/* Local safes */}
        {safes.length > 0 && (
          <div className="space-y-4">
            {mounted && isConnected && <div className="pt-2 border-t border-border/30" />}
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-muted-foreground">Local Safes (Demo)</h4>
            </div>
            {safes
              .filter((s) => s.status !== 'released')
              .map((safe, index) => (
                <LocalSafeCard key={safe.id} safe={safe} index={index} />
              ))}
            {releasedSafes.length > 0 && (
              <div className="pt-6 border-t border-border/50">
                <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-400" />Released</h4>
                <div className="space-y-4">
                  {releasedSafes.map((safe, index) => (
                    <LocalSafeCard key={safe.id} safe={safe} index={index} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {safes.length === 0 && (!mounted || !isConnected) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-12 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
              <Shield className="h-8 w-8 text-primary/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Wills Yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Connect your wallet and create your first encrypted will with a trustless on-chain timeout.
            </p>
            <Button onClick={() => setCurrentView('create')} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow">
              <Shield className="h-4 w-4" />
              Create Your First Will
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </div>
    </section>
  )
}
