'use client'

import { useState, useSyncExternalStore, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock,
  KeyRound,
  Download,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Shield,
  Copy,
  Check,
  ArrowRight,
  FileText,
  Blocks,
  ExternalLink,
  Loader2,
  Landmark,
  Link2,
  AlertTriangle,
  Clock,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSafeDropStore } from '@/store/safedrop-store'
import { useToast } from '@/hooks/use-toast'
import { useGetWill, useGetOwnerWills, useGetTimeUntilRelease } from '@/hooks/use-dead-mans-switch'
import { truncateAddress, getExplorerAddressUrl, type OnChainWill, formatTimeRemaining } from '@/lib/contract'
import {
  parseRecoveryUrl,
  decryptMessage,
  combineShares,
} from '@/lib/crypto'
import { fetchFromIpfs } from '@/lib/storacha'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// ─── Countdown timer ──────────────────────────────────────────
function CountdownTimer({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const remaining = deadline - Math.floor(now / 1000)
  if (remaining <= 0) {
    return <span className="text-amber-400 font-bold">Timer expired — release pending</span>
  }
  const days = Math.floor(remaining / 86400)
  const hours = Math.floor((remaining / 3600) % 24)
  const minutes = Math.floor((remaining / 60) % 60)
  const seconds = remaining % 60
  return (
    <span className="font-mono tabular-nums">
      {days > 0 && <>{days}d </>}
      {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  )
}

// ─── On-chain will card ──────────────────────────────────────
function OnChainWillById({ willId, onUseCid }: { willId: number; onUseCid: (cid: string) => void }) {
  const { data: will, isLoading } = useGetWill(willId)
  if (isLoading) {
    return (
      <div className="p-3 rounded-lg bg-secondary/50 border border-border/50 flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground">Loading will #{willId}...</span>
      </div>
    )
  }
  if (!will || !will.exists) return null
  return (
    <div className="p-3 rounded-lg bg-secondary/50 border border-border/50 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Will #{will.willId}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
          will.isReleased ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        }`}>
          {will.isReleased ? 'Released' : 'Active'}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Beneficiary: <code className="font-mono">{truncateAddress(will.beneficiary)}</code>
      </p>
      {will.cid && (
        <Button onClick={() => onUseCid(will.cid)} size="sm" variant="outline" className="w-full text-xs gap-1.5 h-7 mt-1">
          <KeyRound className="h-3 w-3" /> Use this will
        </Button>
      )}
    </div>
  )
}

// ─── Main Recover Component ─────────────────────────────────
export function RecoverSafe() {
  const { isRecovering, setIsRecovering, recoveredMessage, setRecoveredMessage } =
    useSafeDropStore()
  const { toast } = useToast()

  // ─── URL detection state ──────────────────────────────────
  const [detectedWillId, setDetectedWillId] = useState<number | null>(null)
  const [detectedShare1, setDetectedShare1] = useState<string | null>(null)

  // ─── Manual entry state ───────────────────────────────────
  const [mode, setMode] = useState<'link' | 'manual' | 'contract'>('link')
  const [manualWillId, setManualWillId] = useState('')
  const [manualShare1, setManualShare1] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')

  // ─── Active recovery state ────────────────────────────────
  const [activeWillId, setActiveWillId] = useState<number | undefined>(undefined)
  const [activeShare1, setActiveShare1] = useState<string>('')

  // ─── Result state ─────────────────────────────────────────
  const [error, setError] = useState('')
  const [showDecrypted, setShowDecrypted] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(false)
  const [showShare1, setShowShare1] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)

  // Hydration guard
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  // ─── Auto-detect recovery link in URL ─────────────────────
  useEffect(() => {
    if (!mounted) return
    const url = window.location.href
    const parsed = parseRecoveryUrl(url)
    if (parsed) {
      requestAnimationFrame(() => {
        setDetectedWillId(parsed.willId)
        setDetectedShare1(parsed.share1)
        setMode('link')
        toast({
          title: 'Recovery link detected',
          description: `Will #${parsed.willId} found. Reading from blockchain...`,
        })
      })
    }
  }, [mounted, toast])

  // ─── Read will from contract ──────────────────────────────
  const { data: onChainWill, isLoading: isLoadingWill, isError: willError } = useGetWill(activeWillId)
  const { data: timeUntilRelease } = useGetTimeUntilRelease(activeWillId)

  // Read will IDs from contract (for manual contract lookup)
  const isValidOwner = mounted && isValidAddress(ownerAddress)
  const { data: willIds, isLoading: isLoadingIds } = useGetOwnerWills(
    isValidOwner ? (ownerAddress as `0x${string}`) : undefined
  )

  // ─── Activate a will for recovery ─────────────────────────
  const activateWill = useCallback((willId: number, share1: string) => {
    setActiveWillId(willId)
    setActiveShare1(share1)
    setShowDecrypted(false)
    setError('')
  }, [])

  // Activate from detected link
  useEffect(() => {
    if (detectedWillId !== null && detectedShare1) {
      activateWill(detectedWillId, detectedShare1)
    }
  }, [detectedWillId, detectedShare1, activateWill])

  // ─── Derived state ────────────────────────────────────────
  const will = onChainWill && onChainWill.exists ? onChainWill : null
  const isReleased = will?.isReleased ?? false
  const isRevealed = will?.revealed ?? false
  const hasShare2 = will?.encryptedKey && will.encryptedKey !== '0x' && will.encryptedKey.length > 2
  const releaseDeadline = will ? Number(will.lastCheckIn) + Number(will.timeoutDuration) : 0
  // Decrypt only when: released AND (revealed or share2 is already on-chain)
  const canDecrypt = mounted && will && isReleased && activeShare1 && hasShare2

  // ─── REAL DECRYPTION (with share combining + release check) ──
  const handleRecover = async () => {
    if (!will || !activeShare1) return

    if (!isReleased) {
      setError('This will has not been released yet. The owner must stop checking in for the timer to expire.')
      return
    }

    if (!hasShare2) {
      setError('Share 2 has not been revealed on-chain yet. The custodian agent or owner must call revealShare() after release before decryption is possible.')
      return
    }

    setIsDecrypting(true)
    setError('')
    setShowDecrypted(false)

    try {
      // Step 1: Combine shares to reconstruct the AES key
      const keyBase64 = combineShares(activeShare1, will.encryptedKey)

      // Step 2: Fetch encrypted blob from IPFS
      const encryptedBlob = await fetchFromIpfs(will.cid)

      // Step 3: Decrypt using the reconstructed key (must use same AAD as encryption)
      const { plaintext } = await decryptMessage(encryptedBlob, keyBase64, will.owner)
      setRecoveredMessage(plaintext)
      setShowDecrypted(true)
      toast({ title: 'Decryption successful!', description: 'The secret has been decrypted in your browser.' })
    } catch (err) {
      setError(
        err instanceof Error ? err.message
        : 'Decryption failed. The will may not have been released, or the link is invalid.'
      )
      toast({ title: 'Decryption failed', description: 'Could not decrypt. Check the recovery link and will status.', variant: 'destructive' })
    } finally {
      setIsDecrypting(false)
    }
  }

  const handleCopyMessage = useCallback(async () => {
    try { await navigator.clipboard.writeText(recoveredMessage) } catch { /* fallback */ }
    setCopiedMessage(true)
    setTimeout(() => setCopiedMessage(false), 2000)
    toast({ title: 'Message copied', description: 'The decrypted message has been copied to clipboard.' })
  }, [recoveredMessage, toast])

  const handleReset = () => {
    setShowDecrypted(false)
    setActiveWillId(undefined)
    setActiveShare1('')
    setDetectedWillId(null)
    setDetectedShare1(null)
    setOwnerAddress('')
    setRecoveredMessage('')
    setError('')
    setMode('link')
    setManualWillId('')
    setManualShare1('')
  }

  const handleManualSubmit = () => {
    const wid = parseInt(manualWillId)
    if (!wid || wid < 0 || !manualShare1.trim()) {
      toast({ title: 'Invalid input', description: 'Enter a valid will ID and share.', variant: 'destructive' })
      return
    }
    activateWill(wid, manualShare1.trim())
  }

  const handleUseWillCid = useCallback((willCid: string) => {
    toast({ title: 'CID copied', description: 'Note: You still need the share from the recovery link to decrypt.' })
  }, [toast])

  return (
    <section className="relative py-24 lg:py-32 min-h-screen">
      <div className="absolute top-0 left-0 right-0 section-divider" />
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-4">
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Recover a Will</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Decrypt Your <span className="text-gradient-emerald">Secret</span></h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Open the recovery link, or manually enter the will ID and share to decrypt.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="glass-card rounded-2xl p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {!showDecrypted ? (
                <motion.div key="input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">

                  {/* Mode toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMode('link')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                        mode === 'link' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary/50 border-border text-muted-foreground hover:bg-primary/5'
                      }`}
                    >
                      <Link2 className="h-4 w-4" />
                      Recovery Link
                    </button>
                    <button
                      onClick={() => setMode('manual')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                        mode === 'manual' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary/50 border-border text-muted-foreground hover:bg-primary/5'
                      }`}
                    >
                      <KeyRound className="h-4 w-4" />
                      Manual Entry
                    </button>
                    <button
                      onClick={() => setMode('contract')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                        mode === 'contract' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary/50 border-border text-muted-foreground hover:bg-primary/5'
                      }`}
                    >
                      <Blocks className="h-4 w-4" />
                      Browse Chain
                    </button>
                  </div>

                  {/* ── Link Mode (auto-detected from URL) ── */}
                  {mode === 'link' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.2 }} className="space-y-3">
                      {detectedWillId !== null ? (
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/15">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            <p className="text-sm font-medium text-foreground">Recovery Link Detected</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Will #{detectedWillId}</span>
                            <span className="text-border">|</span>
                            <span>Share loaded from URL fragment</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
                          <div className="flex items-center gap-2 mb-2">
                            <Link2 className="h-5 w-5 text-muted-foreground" />
                            <p className="text-sm font-medium text-foreground">No Recovery Link Detected</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Open a recovery link sent by the will creator. The link format is:<br />
                            <code className="text-primary/70 mt-1 block">safedrop.app/?view=recover&willId=123#s1=...</code>
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            The share in the fragment is encrypted with XOR split — useless without the
                            on-chain counterpart.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button onClick={() => setMode('manual')} variant="outline" size="sm" className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                              <KeyRound className="h-3 w-3" /> Enter manually
                            </Button>
                            <Button onClick={() => setMode('contract')} variant="outline" size="sm" className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                              <Blocks className="h-3 w-3" /> Browse chain
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ── Manual Mode ── */}
                  {mode === 'manual' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.2 }} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="recover-will-id" className="text-sm font-medium text-foreground/90">
                          <Blocks className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
                          Will ID (from blockchain)
                        </Label>
                        <Input
                          id="recover-will-id"
                          type="number"
                          value={manualWillId}
                          onChange={(e) => setManualWillId(e.target.value)}
                          placeholder="0"
                          className="safe-input h-12 rounded-xl font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="recover-share" className="text-sm font-medium text-foreground/90 flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-primary" />
                          Share 1 (from recovery link)
                        </Label>
                        <div className="relative">
                          <Input
                            id="recover-share"
                            type={showShare1 ? 'text' : 'password'}
                            value={manualShare1}
                            onChange={(e) => setManualShare1(e.target.value)}
                            placeholder="Base64 share from recovery link..."
                            className="safe-input h-12 rounded-xl pr-12 font-mono text-sm"
                          />
                          <button onClick={() => setShowShare1(!showShare1)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" type="button">
                            {showShare1 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This share is useless on its own — it must be combined with the on-chain share.
                        </p>
                      </div>
                      <Button onClick={handleManualSubmit} disabled={!manualWillId || !manualShare1.trim()} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow">
                        <KeyRound className="h-4 w-4" /> Load Will
                      </Button>
                    </motion.div>
                  )}

                  {/* ── Contract Browse Mode ── */}
                  {mode === 'contract' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.2 }} className="space-y-2">
                      <Label htmlFor="owner-address" className="text-sm font-medium text-foreground/90 flex items-center gap-2">
                        <Blocks className="h-3.5 w-3.5 text-primary" />
                        Will Owner Address
                      </Label>
                      <Input
                        id="owner-address"
                        value={ownerAddress}
                        onChange={(e) => setOwnerAddress(e.target.value)}
                        placeholder="0x..."
                        className="safe-input h-12 rounded-xl font-mono text-sm"
                      />
                      {ownerAddress.length > 0 && !isValidAddress(ownerAddress) && (
                        <p className="text-xs text-destructive">Please enter a valid Ethereum address</p>
                      )}
                      {isLoadingIds && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Reading from Filecoin blockchain...
                        </div>
                      )}
                      {willIds && willIds.length > 0 && (
                        <div className="space-y-2 mt-3">
                          <p className="text-xs font-medium text-foreground/80">
                            Found {willIds.length} will{willIds.length !== 1 ? 's' : ''}
                          </p>
                          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                            {willIds.map((id) => (
                              <OnChainWillById key={id} willId={id} onUseCid={handleUseWillCid} />
                            ))}
                          </div>
                        </div>
                      )}
                      {willIds && willIds.length === 0 && !isLoadingIds && isValidAddress && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50 border border-border/50 mt-3">
                          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground">No wills found for this address.</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        You still need Share 1 from the recovery link to decrypt.
                      </p>
                    </motion.div>
                  )}

                  {/* ─── On-chain will details (shown when a will is loaded) ── */}
                  {will && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-xl border space-y-4"
                    >
                      {/* Status header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">Will #{will.willId}</span>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          isReleased && hasShare2
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isReleased && !hasShare2
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {isReleased && hasShare2 ? '✓ Released + Revealed' : isReleased ? '⏳ Released, Awaiting Reveal' : '🔒 Not Released'}
                        </span>
                      </div>

                      {/* Will details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-start gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] text-muted-foreground">Owner</p>
                            <code className="text-xs font-mono text-foreground/80">{truncateAddress(will.owner)}</code>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] text-muted-foreground">Beneficiary</p>
                            <code className="text-xs font-mono text-foreground/80">{truncateAddress(will.beneficiary)}</code>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a href={getExplorerAddressUrl(will.owner)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                          View on Explorer <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>

                      {/* Timer / Release info */}
                      {isReleased && hasShare2 ? (
                        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <p className="text-xs font-medium text-emerald-400">Released &amp; share revealed — ready to decrypt</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            The timer expired, the will was released, and Share 2 has been stored on-chain. Combine shares to decrypt.
                          </p>
                        </div>
                      ) : isReleased && !hasShare2 ? (
                        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-400" />
                            <p className="text-xs font-medium text-amber-400">Released, but Share 2 not yet revealed</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            The timer expired and the will was released. However, Share 2 has not been stored on-chain yet.
                            The custodian agent or owner must call <code className="text-foreground/70">revealShare()</code> to enable decryption.
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-400" />
                            <p className="text-xs font-medium text-amber-400">Timer still active</p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-muted-foreground">Time remaining:</span>
                            <span className="text-xs text-foreground/90">
                              <CountdownTimer deadline={releaseDeadline} />
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-2">
                            Decryption is blocked until the timer expires and the will is released.
                            The owner must stop checking in for the countdown to reach zero.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Loading state */}
                  {isLoadingWill && activeWillId !== undefined && (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      <span className="text-sm text-muted-foreground">Reading will #{activeWillId} from blockchain...</span>
                    </div>
                  )}

                  {/* Error */}
                  {willError && activeWillId !== undefined && !will && (
                    <div className="flex items-start gap-2 p-4 rounded-xl bg-destructive/5 border border-destructive/15">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Will not found</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Will #{activeWillId} does not exist on this contract. Check the recovery link.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Decrypt error */}
                  <AnimatePresence>
                    {error && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/15">
                        <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-destructive">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Security info */}
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
                    <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Key-split decryption</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        The AES key is split using XOR. Share 1 is in your recovery link, Share 2 is revealed on-chain
                        only after the will is released. Both must be combined to decrypt, and this app enforces the release timer.
                      </p>
                    </div>
                  </div>

                  {/* Decrypt button */}
                  {will && activeShare1 && (
                    <Button
                      onClick={handleRecover}
                      disabled={!isReleased || !hasShare2 || isDecrypting}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow h-12 text-base"
                    >
                      {isDecrypting ? (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
                          Fetching from IPFS &amp; Decrypting...
                        </>
                      ) : !isReleased ? (
                        <>
                          <Lock className="h-5 w-5" />
                          Locked — Timer Active
                        </>
                      ) : !hasShare2 ? (
                        <>
                          <AlertCircle className="h-5 w-5" />
                          Waiting for Share 2 Reveal
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-5 w-5" />
                          Decrypt Message
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  )}

                  {will && !activeShare1 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/50 border border-border/50">
                      <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Will loaded from chain, but Share 1 is missing. You need the recovery link that contains the share in the URL fragment.
                      </p>
                    </div>
                  )}

                </motion.div>
              ) : (
                /* ─── Decrypted Result ── */
                <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
                  <div className="text-center py-4">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/15 mb-4">
                      <CheckCircle2 className="h-8 w-8 text-primary" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-foreground">Message Decrypted</h3>
                    <p className="text-sm text-muted-foreground mt-1">Shares combined • AES-256-GCM decrypted in-browser</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-primary" /> Decrypted Content
                      </Label>
                      <Button variant="ghost" size="sm" onClick={handleCopyMessage} className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
                        {copiedMessage ? <><Check className="h-3 w-3" />Copied</> : <><Copy className="h-3 w-3" />Copy</>}
                      </Button>
                    </div>
                    <div className="safe-input rounded-xl p-5 min-h-[200px] max-h-[400px] overflow-y-auto">
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-mono">{recoveredMessage}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button onClick={handleReset} variant="outline" className="flex-1 border-border hover:bg-secondary text-muted-foreground gap-2">
                      <Lock className="h-4 w-4" /> Recover Another
                    </Button>
                    <Button onClick={handleCopyMessage} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow">
                      <Download className="h-4 w-4" /> Copy Message
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer badge */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 glass-card rounded-full px-5 py-2.5">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">XOR key-split</span> &mdash; Neither share alone reveals the secret
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
