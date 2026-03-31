'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import {
  Wallet,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  LogOut,
  Droplets,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { truncateAddress, getExplorerAddressUrl } from '@/lib/contract'
import { CHAIN_META } from '@/lib/wagmi'

export function WalletButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({ address })

  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Hydration-safe mount detection using useSyncExternalStore
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const isCorrectChain = chain?.id === CHAIN_META.id

  const handleCopy = useCallback(async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [address])

  // Format balance safely — handle undefined, null, NaN
  const formattedBalance = (() => {
    if (!balance?.formatted || isNaN(Number(balance.formatted))) return null
    const num = parseFloat(balance.formatted)
    if (isNaN(num)) return null
    return { value: num.toFixed(4), symbol: balance.symbol || CHAIN_META.symbol }
  })()

  // Not connected (safe to render on server — always shows "Connect Wallet")
  if (!isConnected) {
    return (
      <Button
        onClick={() => {
          const injected = connectors.find((c) => c.id === 'injected')
          if (injected) connect({ connector: injected })
        }}
        disabled={isConnecting}
        className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow"
        size="sm"
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        {isConnecting ? 'Connecting...' : <span className="hidden sm:inline">Connect Wallet</span>}
      </Button>
    )
  }

  // Connected — guard address/chain display with mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="h-9 w-24" /> // placeholder with same height to avoid layout shift
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
          isCorrectChain
            ? 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15'
            : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/15'
        }`}
      >
        {!isCorrectChain && <AlertCircle className="h-3.5 w-3.5" />}
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <span className="hidden sm:inline">{truncateAddress(address!)}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-72 z-50 glass-card rounded-xl overflow-hidden border border-border/50 shadow-2xl"
            >
              {/* Network info */}
              <div className={`p-3 border-b border-border/50 ${!isCorrectChain ? 'bg-amber-500/5' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${isCorrectChain ? 'bg-primary' : 'bg-amber-500 animate-pulse'}`} />
                    <span className="text-xs font-medium text-foreground">
                      {chain?.name || 'Unknown Network'}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Chain {chain?.id}
                  </span>
                </div>
                {!isCorrectChain && (
                  <p className="text-[10px] text-amber-400 mt-1.5">
                    Switch to {CHAIN_META.name} to interact with the contract.
                  </p>
                )}
              </div>

              {/* Address and balance */}
              <div className="p-3 space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Address</p>
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono text-foreground">
                      {truncateAddress(address!)}
                    </code>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleCopy}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-primary" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <a
                        href={getExplorerAddressUrl(address!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>

                {formattedBalance && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Balance</p>
                    <div className="flex items-center gap-2">
                      <Droplets className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        {formattedBalance.value} {formattedBalance.symbol}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-2 border-t border-border/50">
                <button
                  onClick={() => {
                    disconnect()
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
