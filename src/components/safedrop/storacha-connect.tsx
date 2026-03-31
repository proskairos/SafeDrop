'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HardDrive,
  Mail,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  CloudUpload,
  Globe,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  CreditCard,
  Fingerprint,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStorachaStore } from '@/store/storacha-store'
import { useToast } from '@/hooks/use-toast'

const STORACHA_CONSOLE = 'https://console.storacha.network/'

// ─── Helpers ────────────────────────────────────────────────

/** Mask email: j***e@example.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '••••'
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local[0]}${'*'.repeat(local.length - 2)}${local.at(-1)}@${domain}`
}

/** Show DID shortened: did:key:z6Mk...abc */
function truncateDid(did: string, head = 8, tail = 6): string {
  if (did.length <= head + tail + 3) return did
  return `${did.slice(0, head)}...${did.slice(-tail)}`
}

// ─── Status badge ────────────────────────────────────────────

export function StorachaStatusBadge() {
  const { status, spaceDid, agentDid } = useStorachaStore()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)

  if (!mounted) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </div>
    )
  }

  if (status === 'ready') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
        <HardDrive className="h-3 w-3" />
        Storacha Connected
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
      <HardDrive className="h-3 w-3" />
      Not Connected
    </div>
  )
}

// ─── Full connection panel ────────────────────────────────────

export function StorachaConnect({ compact = false }: { compact?: boolean }) {
  const {
    status,
    email: storeEmail,
    accountEmail,
    agentDid,
    spaceDid,
    spaceName,
    error,
    init,
    login,
    checkConnection,
    cancel,
  } = useStorachaStore()
  const { toast } = useToast()
  const [emailInput, setEmailInput] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  useEffect(() => { if (mounted) init() }, [])

  const handleSubmit = async () => {
    if (!emailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' })
      return
    }
    await login(emailInput.trim())
  }

  const handleCheckAgain = async () => {
    setIsChecking(true)
    await checkConnection()
    setIsChecking(false)
  }

  const openConsole = () => {
    window.open(STORACHA_CONSOLE, '_blank', 'noopener,noreferrer')
  }

  const maskedEmail = storeEmail || accountEmail || ''

  // ── Already ready ──
  if (status === 'ready') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-400">Storacha IPFS Connected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your encrypted wills will be uploaded to IPFS via Storacha.
            </p>
            {maskedEmail && (
              <p className="text-xs text-muted-foreground mt-1.5">
                <Mail className="h-3 w-3 inline mr-1 opacity-50" />
                <code className="text-foreground/60">{maskEmail(maskedEmail)}</code>
              </p>
            )}
            {agentDid && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <Fingerprint className="h-3 w-3 inline mr-1 opacity-50" />
                <code className="text-foreground/60 font-mono">{truncateDid(agentDid)}</code>
              </p>
            )}
            {spaceDid && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <HardDrive className="h-3 w-3 inline mr-1 opacity-50" />
                {spaceName ? `Space "${spaceName}"` : 'Space'}: <code className="text-foreground/60 font-mono">{truncateDid(spaceDid)}</code>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Awaiting email verification ──
  if (status === 'awaiting-email') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/25">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium text-primary">Check your inbox</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verification email sent to <code className="text-foreground/70">{maskEmail(storeEmail)}</code>
              </p>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={cancel} className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
          <X className="h-3 w-3" /> Cancel
        </Button>
      </motion.div>
    )
  }

  // ── Creating space ──
  if (status === 'creating-space') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/25">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium text-primary">Setting up storage space</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically creating your IPFS namespace...
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Needs plan at console ──
  if (status === 'needs-plan') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* Email verified */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/15">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Email verified!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <code className="text-foreground/60">{maskEmail(maskedEmail)}</code>
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Select a storage plan at Storacha Console</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">1</div>
              <p className="text-xs text-foreground/80">Open Storacha Console and sign in with <code className="text-primary">{maskEmail(maskedEmail)}</code></p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">2</div>
              <p className="text-xs text-foreground/80">Select a storage plan (free tier available)</p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">3</div>
              <p className="text-xs text-foreground/80">Come back here and click &quot;I&apos;m Done&quot; — we&apos;ll auto-create your storage space</p>
            </div>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"
            >
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-400">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={openConsole} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow">
            <ExternalLink className="h-4 w-4" />
            Open Storacha Console
          </Button>
          <Button onClick={handleCheckAgain} variant="outline" disabled={isChecking} className="flex-1 border-primary/30 text-primary hover:bg-primary/10 gap-2">
            {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isChecking ? 'Checking...' : "I'm Done — Check Again"}
          </Button>
        </div>
      </motion.div>
    )
  }

  // ── Initializing ──
  if (status === 'initializing') {
    const hadPreviousSession = typeof window !== 'undefined' && !!localStorage.getItem('safedrop-storacha-connected')
    return (
      <div className="flex items-center justify-center gap-2 py-6">
        <Loader2 className="h-4 w-4 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">
          {hadPreviousSession ? 'Restoring your Storacha session...' : 'Checking for existing session...'}
        </span>
      </div>
    )
  }

  // ── Disconnected — show email login form ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <HardDrive className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Connect Storacha (IPFS)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload encrypted wills to IPFS for decentralized, permanent storage.
          </p>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/15"
          >
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email input — hidden by default with eye toggle */}
      <div className="space-y-2">
        <Label htmlFor="storacha-email" className="text-sm font-medium text-foreground/90">
          <Mail className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
          Email Address
        </Label>
        <div className="relative">
          <Input
            id="storacha-email"
            type={showEmail ? 'email' : 'password'}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@example.com"
            className="safe-input h-12 rounded-xl pr-12"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button
            type="button"
            onClick={() => setShowEmail(!showEmail)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            {showEmail ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          No password — uses decentralized identity (DID). A verification email will be sent.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/50">
          <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground">Verify email</p>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/50">
          <CreditCard className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground">Select plan at console</p>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/50">
          <CloudUpload className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground">Space auto-created</p>
        </div>
      </div>

      {/* Connect button */}
      <Button
        onClick={handleSubmit}
        disabled={!emailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow h-11"
      >
        <Mail className="h-4 w-4" />
        Send Verification Email
      </Button>

      {/* Privacy note */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/15">
        <Globe className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground">Your data stays encrypted</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Files are AES-256-GCM encrypted in your browser BEFORE uploading. Storacha only sees an opaque blob.
            Only someone with your recovery link can decrypt it.
          </p>
        </div>
      </div>
    </motion.div>
  )
}
