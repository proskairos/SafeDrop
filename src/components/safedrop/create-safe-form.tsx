'use client'

import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, usePublicClient, useSwitchChain } from 'wagmi'
import { QRCodeSVG } from 'qrcode.react'
import {
  FileText,
  User,
  Clock,
  Check,
  ArrowRight,
  ArrowLeft,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Shield,
  KeyRound,
  Upload,
  Lock,
  Wallet,
  ExternalLink,
  Loader2,
  Blocks,
  UploadCloud,
  PenTool,
  Hourglass,
  QrCode,
  RefreshCw,
  Link2,
  MessageSquare,
  Eye,
  EyeOff,
  X,
  Paperclip,
  Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSafeDropStore } from '@/store/safedrop-store'
import { useToast } from '@/hooks/use-toast'
import { useCreateWill } from '@/hooks/use-dead-mans-switch'
import { getExplorerTxUrl, truncateAddress } from '@/lib/contract'
import { filecoinCalibration } from '@/lib/wagmi'
import {
  generateEncryptionKey,
  encryptMessage,
  buildRecoveryUrl,
  splitKey,
  base64ToHex,
  type EncryptResult,
} from '@/lib/crypto'
import { uploadEncryptedBlob } from '@/lib/storacha'

// ─── Imports for Storacha ─────────────────────────────────────
import { StorachaConnect, StorachaStatusBadge } from '@/components/safedrop/storacha-connect'
import { useStorachaStore } from '@/store/storacha-store'

// ─── Imports for Custodian Agent ──────────────────────────────
import { AgentStatusBadge } from '@/components/safedrop/agent-panel'
import { agentClient } from '@/lib/agent-client'

// ─── Types ───────────────────────────────────────────────────

type CreatePhase = 'idle' | 'encrypting' | 'uploading' | 'signing' | 'confirming'

const PHASE_CONFIG: Record<CreatePhase, { icon: typeof Lock; label: string; desc: string }> = {
  idle: { icon: Lock, label: 'Preparing...', desc: '' },
  encrypting: { icon: Lock, label: 'Encrypting message', desc: 'AES-256-GCM encryption in your browser' },
  uploading: { icon: UploadCloud, label: 'Uploading to IPFS', desc: 'Storing encrypted blob on Storacha/IPFS' },
  signing: { icon: PenTool, label: 'Sign transaction', desc: 'Confirm the smart contract call in your wallet' },
  confirming: { icon: Hourglass, label: 'Confirming on-chain', desc: 'Waiting for blockchain confirmation' },
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function CreateSafeForm() {
  const { addSafe, setCurrentView, createStep, setCreateStep, isCreating, setIsCreating } =
    useSafeDropStore()
  const { toast } = useToast()
  const { address, isConnected, chain } = useAccount()
  const { switchChain } = useSwitchChain()
  const { createWill, hash: txHash, createdWillId, isPending: isTxPending, isSuccess: isTxSuccess, error: txError, reset: resetTx } = useCreateWill()
  const storachaStatus = useStorachaStore((s) => s.status)
  const [agentConnected, setAgentConnected] = useState(false)
  const [pendingShare2Reg, setPendingShare2Reg] = useState<{ share2Hex: string; owner: string; cid: string } | null>(null)

  // Track agent connection — connect eagerly so we know status before step 2
  useEffect(() => {
    agentClient.connect()
    const unsub = agentClient.on('_connection-change', (data) => {
      setAgentConnected(data.connected)
    })
    const unsubInfo = agentClient.on('agent-info', () => {
      setAgentConnected(agentClient.isConnected)
    })
    return () => { unsub(); unsubInfo() }
  }, [])

  // Register share2 with agent AFTER tx confirms (we need the willId)
  useEffect(() => {
    if (isTxSuccess && createdWillId !== null && pendingShare2Reg && agentConnected) {
      agentClient.registerShare2(
        createdWillId,
        pendingShare2Reg.share2Hex,
        pendingShare2Reg.owner,
        pendingShare2Reg.cid,
      )
      setPendingShare2Reg(null)
    }
  }, [isTxSuccess, createdWillId, pendingShare2Reg, agentConnected])

  // ─── Form State ────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [timeoutDays, setTimeoutDays] = useState(30)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Crypto State (created during encryption) ──────────────
  const [encryptionResult, setEncryptionResult] = useState<EncryptResult | null>(null)
  const encryptedBlobRef = useRef<Uint8Array | null>(null) // sync ref — IPFS blob
  const share1Ref = useRef('') // sync ref — XOR share 1 (goes in recovery link)
  const share2HexRef = useRef('') // sync ref — XOR share 2 (goes on-chain as encryptedKey)
  const [createdCid, setCreatedCid] = useState('')
  const [recoveryUrl, setRecoveryUrl] = useState('')
  const [ivHex, setIvHex] = useState('')

  // ─── UI State ──────────────────────────────────────────────
  const [copiedCid, setCopiedCid] = useState(false)
  const [copiedTx, setCopiedTx] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedIv, setCopiedIv] = useState(false)
  const [createPhase, setCreatePhase] = useState<CreatePhase>('idle')
  const [showQrModal, setShowQrModal] = useState(false)

  // Hydration-safe mount detection
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  // Derive effective phase
  const effectivePhase: CreatePhase = (txHash && createPhase === 'signing') ? 'confirming' : createPhase

  // Auto-transition createPhase from 'signing' → 'confirming' when txHash appears
  useEffect(() => {
    if (txHash && createPhase === 'signing') {
      setCreatePhase('confirming')
    }
  }, [txHash, createPhase])

  // Public client for manual receipt checking (Filecoin FEVM fallback)
  const publicClient = usePublicClient()
  const [isManualChecking, setIsManualChecking] = useState(false)

  // Refs to prevent duplicate effect firings
  const successHandled = useRef(false)
  const errorHandled = useRef(false)

  const handleTxSuccess = useCallback(() => {
    if (successHandled.current) return
    successHandled.current = true
    addSafe({
      title,
      recipient: recipientEmail || recipientAddress,
      message,
      timeoutDays,
      lastActive: Date.now(),
      cid: createdCid,
      encryptionKey: encryptionResult?.keyBase64 || '',
    })
    setIsCreating(false)
    setCreateStep(3)
    toast({
      title: 'Will created on-chain!',
      description: `Will #${createdWillId ?? '?'} registered. Share the recovery link — it contains no key, only a reference to the on-chain will.`,
    })
  }, [title, recipientEmail, recipientAddress, message, timeoutDays, createdCid, encryptionResult, createdWillId, addSafe, setIsCreating, setCreateStep, toast])

  // ─── When transaction confirms (auto-detect via wagmi) ──────
  useEffect(() => {
    if (isTxSuccess && !successHandled.current && createPhase === 'confirming') {
      handleTxSuccess()
    }
  }, [isTxSuccess, createPhase, handleTxSuccess])

  // ─── Manual receipt check (Filecoin FEVM polling fallback) ──
  const handleManualCheck = useCallback(async () => {
    if (!txHash || !publicClient) return
    setIsManualChecking(true)
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 15_000,
      })
      if (receipt && receipt.status === 'success') {
        handleTxSuccess()
      } else if (receipt) {
        errorHandled.current = true
        toast({ title: 'Transaction reverted', description: 'The on-chain transaction was reverted. Please check the block explorer and try again.', variant: 'destructive' })
        setCreatePhase('idle')
        setIsCreating(false)
      }
    } catch {
      toast({ title: 'Not confirmed yet', description: 'The transaction is still pending. Wait a moment and try again, or check the block explorer directly.', variant: 'destructive' })
    } finally {
      setIsManualChecking(false)
    }
  }, [txHash, publicClient, handleTxSuccess, toast, setIsCreating])

  // ─── Force proceed (last resort — user confirmed on explorer) ──
  const handleForceProceed = useCallback(() => {
    handleTxSuccess()
  }, [handleTxSuccess])

  // ─── When transaction errors ───────────────────────────────
  useEffect(() => {
    if (txError && !errorHandled.current && createPhase !== 'idle') {
      errorHandled.current = true
      toast({
        title: 'Transaction failed',
        description: txError?.message?.includes('User rejected')
          ? 'Transaction was rejected in your wallet.'
          : 'The on-chain transaction failed. Please try again.',
        variant: 'destructive',
      })
      setCreatePhase('idle')
      setIsCreating(false)
    }
  }, [txError, createPhase])

  // Reset handled flags when phase changes
  useEffect(() => {
    successHandled.current = false
    errorHandled.current = false
  }, [createPhase])

  // ─── File handling ────────────────────────────────────────
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 10MB.', variant: 'destructive' })
      e.target.value = ''
      return
    }
    setAttachedFile(file)
  }, [toast])

  const handleRemoveFile = useCallback(() => {
    setAttachedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // Drag & drop
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 10MB.', variant: 'destructive' })
      return
    }
    setAttachedFile(file)
  }, [toast])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragOver(false), [])

  // Build the combined payload: message + optional file
  const encryptionPayload = useMemo(() => {
    if (!attachedFile) return message
    // When a file is attached, wrap everything into a structured payload
    // (file content will be read during encryption, not here)
    return null // signal that we need async file reading
  }, [message, attachedFile])

  const fileSizeLabel = attachedFile ? `${(attachedFile.size / 1024).toFixed(1)}KB` : ''

  // ─── CREATE WILL: Real encryption + real upload + real tx ──
  const handleCreate = async () => {
    setIsCreating(true)
    resetTx()
    successHandled.current = false
    errorHandled.current = false
    encryptedBlobRef.current = null
    share1Ref.current = ''
    share2HexRef.current = ''

    // Phase 1: REAL ENCRYPTION (AES-256-GCM in browser)
    setCreatePhase('encrypting')
    try {
      const key = await generateEncryptionKey()
      let result: EncryptResult

      if (attachedFile) {
        // Read file and base64-encode in chunks (avoids call stack overflow on large files)
        const fileBuffer = await attachedFile.arrayBuffer()
        const fileBytes = new Uint8Array(fileBuffer)
        const chunks: string[] = []
        const chunkSize = 8192
        for (let i = 0; i < fileBytes.length; i += chunkSize) {
          const slice = fileBytes.subarray(i, i + chunkSize)
          chunks.push(String.fromCharCode(...slice))
        }
        const fileBase64 = btoa(chunks.join(''))
        const payload = JSON.stringify({
          message,
          fileName: attachedFile.name,
          fileType: attachedFile.type || 'application/octet-stream',
          fileSize: attachedFile.size,
          fileData: fileBase64,
        })
        result = await encryptMessage(payload, key, address)
      } else {
        // Text-only — encrypt the message directly
        result = await encryptMessage(message, key, address)
      }

      // Store in BOTH state (for UI) and ref (for synchronous later access)
      setEncryptionResult(result)
      encryptedBlobRef.current = result.blob
      const ivHexStr = Array.from(result.iv).map(b => b.toString(16).padStart(2, '0')).join('')
      setIvHex(ivHexStr)
      // XOR-split the key: share1 → recovery link, share2 → on-chain
      const { share1, share2 } = splitKey(result.keyBase64)
      share1Ref.current = share1
      share2HexRef.current = base64ToHex(share2)
    } catch (err) {
      toast({
        title: 'Encryption failed',
        description: 'Could not encrypt your message. Please try again.',
        variant: 'destructive',
      })
      setCreatePhase('idle')
      setIsCreating(false)
      encryptedBlobRef.current = null
      share1Ref.current = ''
      share2HexRef.current = ''
      return
    }

    // Phase 2: REAL IPFS UPLOAD via Storacha
    setCreatePhase('uploading')
    let uploadCid = ''
    try {
      // Use the ref — guaranteed to be set synchronously above
      const blob = encryptedBlobRef.current!
      uploadCid = await uploadEncryptedBlob(blob)
      setCreatedCid(uploadCid)
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Could not upload to IPFS via Storacha. Check your connection and try again.',
        variant: 'destructive',
      })
      setCreatePhase('idle')
      setIsCreating(false)
      return
    }

    // Phase 3: SIGN TRANSACTION (real on-chain call)
    // NEW FLOW: Save share2 for agent registration after tx confirms.
    // Contract gets empty encryptedKey. Agent reveals share2 after release.
    // If agent is offline, fall back to v1 flow (share2 in contract directly).
    setCreatePhase('signing')
    const timeoutDuration = timeoutDays * 24 * 60 * 60
    const useAgentFlow = agentConnected

    if (useAgentFlow) {
      // Save share2 for registration AFTER tx confirms (need willId)
      setPendingShare2Reg({
        share2Hex: share2HexRef.current,
        owner: address ?? '',
        cid: uploadCid,
      })
      // Send empty bytes as encryptedKey (agent will call revealShare later)
      createWill(
        uploadCid,
        '0x' as `0x${string}`,
        recipientAddress as `0x${string}`,
        timeoutDuration,
        0n,
      )
    } else {
      // Fallback: put share2 directly in contract (v1 behavior)
      createWill(
        uploadCid,
        share2HexRef.current as `0x${string}`,
        recipientAddress as `0x${string}`,
        timeoutDuration,
        0n,
      )
    }
  }

  // ─── Form Validation ────────────────────────────────────────
  const canProceedStep1 = message.trim().length > 0 && title.trim().length > 0
  const canProceedStep2 = isValidAddress(recipientAddress) && timeoutDays >= 1

  const timeoutOptions = [
    { days: 1, label: '1 Day', desc: 'Testing' },
    { days: 7, label: '7 Days', desc: 'Short-term' },
    { days: 30, label: '30 Days', desc: 'Monthly' },
    { days: 90, label: '90 Days', desc: 'Quarterly' },
    { days: 365, label: '365 Days', desc: 'Annual' },
  ]

  // ─── Clipboard Helpers ──────────────────────────────────────
  const handleCopy = useCallback(async (text: string, type: 'cid' | 'link' | 'tx' | 'iv') => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for mobile
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    const labels = { cid: 'CID', link: 'Recovery link', tx: 'Transaction hash', iv: 'IV (initialization vector)' }
    if (type === 'cid') { setCopiedCid(true); setTimeout(() => setCopiedCid(false), 2000) }
    else if (type === 'link') { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) }
    else if (type === 'tx') { setCopiedTx(true); setTimeout(() => setCopiedTx(false), 2000) }
    else if (type === 'iv') { setCopiedIv(true); setTimeout(() => setCopiedIv(false), 2000) }
    toast({ title: 'Copied!', description: `${labels[type]} copied to clipboard.` })
  }, [toast])

  // ─── Build Recovery URL (after success — willId + share1, no full key) ──
  useEffect(() => {
    if (createdWillId !== null && share1Ref.current) {
      const baseUrl = `${window.location.origin}${window.location.pathname}`
      const url = buildRecoveryUrl(baseUrl, createdWillId, share1Ref.current)
      setRecoveryUrl(url)
    }
  }, [createdWillId])

  const resetForm = useCallback(() => {
    setTitle('')
    setMessage('')
    setRecipientAddress('')
    setRecipientEmail('')
    setTimeoutDays(30)
    setAttachedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setCreatedCid('')
    setEncryptionResult(null)
    encryptedBlobRef.current = null
    share1Ref.current = ''
    share2HexRef.current = ''
    setIvHex('')
    setRecoveryUrl('')
    setCreatePhase('idle')
    setPendingShare2Reg(null)
    resetTx()
    successHandled.current = false
    errorHandled.current = false
    setShowQrModal(false)
    setCreateStep(0)
  }, [resetTx, setCreateStep])

  const stepConfig = [
    { icon: FileText, label: 'Content' },
    { icon: User, label: 'Recipient' },
    { icon: Clock, label: 'Review' },
    { icon: Check, label: 'Complete' },
  ]

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <section className="relative py-24 lg:py-32 min-h-screen">
      <div className="absolute top-0 left-0 right-0 section-divider" />
      <div className="absolute inset-0 grid-bg opacity-30" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-4">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Create a Will
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Encrypt & Store Your{' '}
            <span className="text-gradient-emerald">Secret</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Your message will be encrypted in-browser with AES-256-GCM, stored on IPFS,
            and registered on the Filecoin blockchain as a trustless dead man&apos;s switch.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/15 bg-primary/5 text-xs text-primary font-medium">
              <Blocks className="h-3 w-3" />
              Filecoin Calibration Testnet
            </div>
          </div>
        </motion.div>

        {/* Wallet not connected */}
        {mounted && !isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20"
          >
            <Wallet className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-400">Wallet Required</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect your wallet to create a decentralized will on the Filecoin blockchain.
              </p>
            </div>
          </motion.div>
        )}

        {/* Wrong network */}
        {mounted && isConnected && chain?.id !== 314159 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20"
          >
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">Wrong Network</p>
              <p className="text-xs text-muted-foreground mt-1">
                You&apos;re connected to {chain?.name || `Chain ${chain?.id}`}. Please switch to Filecoin Calibration Testnet.
              </p>
              <Button
                onClick={() => switchChain?.({ chainId: filecoinCalibration.id })}
                size="sm"
                className="mt-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 gap-2"
              >
                <Blocks className="h-3.5 w-3.5" />
                Switch to Filecoin Calibration
              </Button>
            </div>
          </motion.div>
        )}

        {/* Storacha IPFS Connection — required for upload */}
        {mounted && storachaStatus !== 'ready' && !isCreating && (
          <div className="mb-8">
            <div className="glass-card rounded-2xl p-5 sm:p-6">
              <StorachaConnect compact />
            </div>
          </div>
        )}

        {/* Storacha Connected — show status badge */}
        {mounted && storachaStatus === 'ready' && !isCreating && createStep < 3 && (
          <div className="mb-4 flex items-center justify-center gap-3">
            <StorachaStatusBadge />
            <AgentStatusBadge />
          </div>
        )}

        {/* Agent offline warning */}
        {mounted && storachaStatus === 'ready' && !agentConnected && !isCreating && createStep === 2 && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <Bot className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-400">Custodian Agent Offline</p>
              <p className="text-xs text-muted-foreground mt-1">
                Share2 will be stored directly on-chain (v1 mode). Start the agent for enhanced security with delayed reveal.
              </p>
            </div>
          </div>
        )}

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {stepConfig.map((step, index) => (
            <div key={step.label} className="flex items-center">
              <motion.div
                animate={{ scale: createStep === index ? 1.05 : 1 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  createStep === index
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : createStep > index
                      ? 'bg-primary/5 text-primary/70 border border-primary/10'
                      : 'bg-secondary text-muted-foreground border border-transparent'
                }`}
              >
                {createStep > index ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <step.icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </motion.div>
              {index < stepConfig.length - 1 && (
                <div className={`w-6 sm:w-10 h-px mx-1 ${createStep > index ? 'bg-primary/30' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={createStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card rounded-2xl p-6 sm:p-8">

              {/* ─── Step 0: Content ─────────────────────── */}
              {createStep === 0 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium text-foreground/90">Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Emergency Bitcoin Wallet Access"
                      className="safe-input h-12 rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">A descriptive name for your will.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-medium text-foreground/90">Your Secret Message</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write your secret — passwords, wallet seeds, instructions, or anything you want to share after the timeout..."
                      className="safe-input min-h-[180px] rounded-xl resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        AES-256-GCM encrypted in your browser
                      </p>
                      <p className="text-xs text-muted-foreground">{message.length.toLocaleString()} chars</p>
                    </div>
                  </div>
                  {/* File upload */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground/90 flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5" />
                      Attach File (Optional)
                    </Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    {attachedFile ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                        <Paperclip className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{attachedFile.name}</p>
                          <p className="text-[11px] text-muted-foreground">{fileSizeLabel} &bull; {attachedFile.type || 'unknown type'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group ${
                          isDragOver
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-primary/15 hover:border-primary/30 hover:bg-primary/3'
                        }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2 group-hover:text-primary transition-colors" />
                        <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">Drop a file here or click to upload</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Max 10MB &bull; Files are encrypted before upload</p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setCreateStep(1)} disabled={!canProceedStep1} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow">
                      Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── Step 1: Recipient & Timer ─────────── */}
              {createStep === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="recipient-addr" className="text-sm font-medium text-foreground/90 flex items-center gap-2">
                      Beneficiary Wallet Address
                      <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">Required</span>
                    </Label>
                    <Input
                      id="recipient-addr"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder="0x..."
                      className="safe-input h-12 rounded-xl font-mono text-sm"
                    />
                    {recipientAddress.length > 0 && !isValidAddress(recipientAddress) && (
                      <p className="text-xs text-destructive">Please enter a valid Ethereum address (0x + 40 hex characters)</p>
                    )}
                    <p className="text-xs text-muted-foreground">The on-chain address that can claim deposited funds after release.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipient-email" className="text-sm font-medium text-foreground/90 flex items-center gap-2">
                      Beneficiary Email (Optional)
                      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">Memo</span>
                    </Label>
                    <Input
                      id="recipient-email"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="beneficiary@example.com (for your reference only)"
                      className="safe-input h-12 rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">Not stored on-chain. Local memo only.</p>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground/90">Inactivity Timer</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {timeoutOptions.map((option) => (
                        <button
                          key={option.days}
                          onClick={() => setTimeoutDays(option.days)}
                          className={`relative p-4 rounded-xl text-center transition-all duration-200 border ${
                            timeoutDays === option.days
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-secondary/50 border-border hover:border-primary/20 hover:bg-primary/5'
                          }`}
                        >
                          <p className="text-lg font-bold">{option.label}</p>
                          <p className="text-xs opacity-60 mt-0.5">{option.desc}</p>
                          {timeoutDays === option.days && (
                            <motion.div
                              layoutId="timeout-selected"
                              className="absolute inset-0 rounded-xl border-2 border-primary -z-10"
                              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-warning" />
                      After this period, anyone can trigger the release on-chain.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-days" className="text-sm font-medium text-foreground/90">Or enter custom days (min 1 day)</Label>
                    <Input
                      id="custom-days"
                      type="number"
                      min={1}
                      max={3650}
                      value={timeoutDays}
                      onChange={(e) => setTimeoutDays(Number(e.target.value) || 0)}
                      className="safe-input h-12 rounded-xl w-32"
                    />
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setCreateStep(0)} className="border-border hover:bg-secondary text-muted-foreground gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button onClick={() => setCreateStep(2)} disabled={!canProceedStep2} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow">
                      Review <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── Step 2: Review & Create ─────────── */}
              {createStep === 2 && !isCreating && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Review Your Will</h3>
                  <div className="space-y-4 p-5 rounded-xl bg-secondary/30 border border-border/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Title</p>
                        <p className="text-sm font-medium text-foreground truncate">{title}</p>
                      </div>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Message Preview</p>
                      <p className="text-sm text-foreground/80 line-clamp-3 bg-secondary/50 rounded-lg p-3">{message}</p>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Beneficiary</p>
                        <p className="text-sm font-medium text-foreground font-mono">{truncateAddress(recipientAddress)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Timer</p>
                        <p className="text-sm font-medium text-primary">{timeoutDays} days</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Network</p>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Blocks className="h-3.5 w-3.5 text-primary" /> Filecoin Calibration
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
                    <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">End-to-End Encrypted</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your message will be encrypted with AES-256-GCM in your browser. The encryption key
                        is embedded in a recovery link that only your beneficiary can use. Not even SafeDrop
                        can read your data.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/50 border border-border/50">
                    <Link2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Recovery Link + QR Code</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        After creation, you&apos;ll receive a one-click recovery link and QR code.
                        Share it with your beneficiary via Signal, email, or print it. They can open
                        it on any device to decrypt after the will is released.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setCreateStep(1)} className="border-border hover:bg-secondary text-muted-foreground gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button onClick={handleCreate} disabled={!isConnected || storachaStatus !== 'ready' || timeoutDays < 1} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow px-8">
                      {!isConnected ? (
                        <><Wallet className="h-4 w-4" /> Connect Wallet First</>
                      ) : storachaStatus !== 'ready' ? (
                        <><UploadCloud className="h-4 w-4" /> Connect Storacha First</>
                      ) : (
                        <><Shield className="h-4 w-4" /> Encrypt & Register On-Chain</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── Step 2: Processing ──────────────── */}
              {createStep === 2 && isCreating && (
                <div className="space-y-6 py-4">
                  <div className="text-center mb-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-4"
                    >
                      <Shield className="h-7 w-7 text-primary" />
                    </motion.div>
                    <h3 className="text-lg font-bold text-foreground">
                      {effectivePhase !== 'idle' ? PHASE_CONFIG[effectivePhase].label : 'Creating your will...'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {effectivePhase !== 'idle' ? PHASE_CONFIG[effectivePhase].desc : 'This may take a moment'}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {(['encrypting', 'uploading', 'signing', 'confirming'] as CreatePhase[]).map((phase, index) => {
                      const phases: CreatePhase[] = ['encrypting', 'uploading', 'signing', 'confirming']
                      const phaseIndex = phases.indexOf(phase)
                      const currentPhaseIndex = phases.indexOf(effectivePhase)
                      const isComplete = currentPhaseIndex > phaseIndex
                      const isCurrent = currentPhaseIndex === phaseIndex
                      return (
                        <motion.div
                          key={phase}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                            isComplete ? 'bg-primary/5 border border-primary/15'
                              : isCurrent ? 'bg-primary/10 border border-primary/25'
                              : 'bg-secondary/30 border border-transparent'
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isComplete ? 'bg-primary/20' : isCurrent ? 'bg-primary/15' : 'bg-secondary'
                          }`}>
                            {isComplete ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : isCurrent ? (
                              <Loader2 className="h-4 w-4 text-primary animate-spin" />
                            ) : (() => { const PhaseIcon = PHASE_CONFIG[phase].icon; return <PhaseIcon className="h-4 w-4 text-muted-foreground/40" /> })()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {PHASE_CONFIG[phase].label}
                            </p>
                            <p className="text-xs text-muted-foreground">{PHASE_CONFIG[phase].desc}</p>
                          </div>
                          {isCurrent && phase === 'signing' && (
                            <span className="text-xs text-primary animate-pulse flex-shrink-0">Check wallet...</span>
                          )}
                          {isComplete && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                        </motion.div>
                      )
                    })}
                  </div>
                  {txHash && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-foreground/70 break-all flex-1">{txHash}</code>
                        <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </motion.div>
                  )}
                  {/* Fallback buttons when stuck on confirming */}
                  {txHash && effectivePhase === 'confirming' && !isTxSuccess && (
                    <div className="space-y-2">
                      <p className="text-xs text-center text-muted-foreground">Taking longer than expected? Filecoin blocks take ~30s.</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          onClick={handleManualCheck}
                          disabled={isManualChecking}
                          variant="outline"
                          className="flex-1 border-primary/30 text-primary hover:bg-primary/10 gap-2"
                        >
                          {isManualChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          {isManualChecking ? 'Checking...' : 'Check Status'}
                        </Button>
                        <Button
                          onClick={handleForceProceed}
                          variant="ghost"
                          className="flex-1 text-muted-foreground hover:text-foreground gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          I confirmed on explorer — Continue
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Step 3: Success + Recovery Link ── */}
              {createStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/15 mb-4"
                    >
                      <CheckCircle2 className="h-8 w-8 text-primary" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-foreground">Will Created On-Chain</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your message was encrypted, uploaded, and registered on Filecoin.
                    </p>
                    {txHash && (
                      <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary hover:text-primary/80 transition-colors">
                        View transaction <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {/* ── RECOVERY LINK (The Core Innovation) ── */}
                  <div className="space-y-3 p-5 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <QrCode className="h-5 w-5 text-primary" />
                      <h4 className="text-sm font-semibold text-foreground">Recovery Link</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Share this ONE link with your beneficiary. It contains <span className="text-primary font-medium">no usable key</span> —
                      only a random share (useless alone). The other share is on-chain in your smart contract.
                      Both are needed to decrypt, and the app enforces the release timer.
                    </p>

                    {/* The URL — share1 in fragment, useless alone */}
                    <div className="relative">
                      <div className="safe-input rounded-xl p-3 pr-12 text-xs break-all leading-relaxed">
                        <span className="text-foreground/70">{recoveryUrl.split('#')[0]}</span>
                        <span className="text-primary/40">#s1=•••••••••••••••••••••••••••••••••••••••••••••••</span>
                      </div>
                      <button
                        onClick={() => handleCopy(recoveryUrl, 'link')}
                        className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                      >
                        {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() => setShowQrModal(true)}
                        variant="outline"
                        className="flex-1 border-primary/30 text-primary hover:bg-primary/10 gap-2"
                      >
                        <QrCode className="h-4 w-4" />
                        Show QR Code
                      </Button>
                      <Button
                        onClick={() => {
                          const signalText = `🔐 SafeDrop Recovery Link\n\nIf something happens to me, open this link to access my encrypted will:\n\n${recoveryUrl}\n\n⚠️ Keep this safe. Only you can decrypt it.`
                          handleCopy(signalText, 'link')
                        }}
                        variant="outline"
                        className="flex-1 border-primary/30 text-primary hover:bg-primary/10 gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Copy for Signal
                      </Button>
                    </div>
                  </div>

                  {/* QR Code Modal */}
                  <AnimatePresence>
                    {showQrModal && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-5 rounded-xl bg-secondary/50 border border-border/50 text-center"
                      >
                        <p className="text-xs text-muted-foreground mb-3">Scan with any QR reader to open recovery</p>
                        <div className="inline-flex p-4 bg-white rounded-xl">
                          <QRCodeSVG
                            value={recoveryUrl}
                            size={200}
                            bgColor="#ffffff"
                            fgColor="#0f172a"
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">The decryption key is embedded in the QR (URL fragment)</p>
                        <Button variant="ghost" size="sm" onClick={() => setShowQrModal(false)} className="mt-2 text-xs text-muted-foreground">
                          Close
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Technical Details (collapsed) ── */}
                  <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">Technical Details</p>
                    </div>

                    {txHash && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-2">
                          <Blocks className="h-3 w-3 text-primary" /> Transaction Hash
                        </Label>
                        <div className="relative">
                          <div className="safe-input rounded-xl p-3 pr-10 font-mono text-xs break-all">{txHash}</div>
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                            <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button onClick={() => handleCopy(txHash, 'tx')} className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                              {copiedTx ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2">
                        <KeyRound className="h-3 w-3 text-primary" /> CID (IPFS)
                      </Label>
                      <div className="relative">
                        <div className="safe-input rounded-xl p-3 pr-10 font-mono text-xs break-all">{createdCid}</div>
                        <button onClick={() => handleCopy(createdCid, 'cid')} className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                          {copiedCid ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {ivHex && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-2">
                          <Lock className="h-3 w-3 text-primary" /> IV (stored on-chain)
                        </Label>
                        <div className="relative">
                          <div className="safe-input rounded-xl p-3 pr-10 font-mono text-xs break-all">0x{ivHex}</div>
                          <button onClick={() => handleCopy(`0x${ivHex}`, 'iv')} className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                            {copiedIv ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">The IV is non-secret — it&apos;s stored on-chain for decryption convenience.</p>
                      </div>
                    )}
                  </div>

                  {/* Security warning */}
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/15">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Share the recovery link securely</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        The recovery link contains the decryption key in its URL fragment (#key=...).
                        Browsers never send fragments to servers, so the key stays private. But anyone who
                        has the link can decrypt — share it via Signal or a printed QR code.
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button onClick={resetForm} variant="outline" className="flex-1 border-border hover:bg-secondary text-muted-foreground gap-2">
                      <Shield className="h-4 w-4" /> Create Another
                    </Button>
                    <Button onClick={() => setCurrentView('dashboard')} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow">
                      View My Wills <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
