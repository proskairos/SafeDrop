'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Menu, X, HeartPulse, Bot, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useSafeDropStore } from '@/store/safedrop-store'
import { WalletButton } from '@/components/safedrop/wallet-button'
import { agentClient } from '@/lib/agent-client'

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { currentView, setCurrentView, safes } = useSafeDropStore()
  const activeSafes = safes.filter((s) => s.status === 'active' || s.status === 'warning')
  const [agentConnected, setAgentConnected] = useState(false)

  // Track agent connection for the navbar badge
  useEffect(() => {
    const unsub = agentClient.on('_connection-change', (data) => {
      setAgentConnected(data.connected)
    })
    agentClient.on('agent-info', () => {
      setAgentConnected(agentClient.isConnected)
    })
    return () => { unsub() }
  }, [])

  const navItems = [
    { id: 'home' as const, label: 'Home' },
    { id: 'create' as const, label: 'Create Safe' },
    { id: 'dashboard' as const, label: 'My Safes' },
    { id: 'recover' as const, label: 'Recover' },
  ]

  const handleNav = (view: typeof currentView) => {
    setCurrentView(view)
    setIsMenuOpen(false)
  }

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={() => handleNav('home')}
              className="flex items-center gap-2.5 group shrink-0"
            >
              <div className="relative">
                <Shield className="h-8 w-8 text-primary transition-all group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                <span className="text-gradient-emerald">Safe</span>
                <span className="text-foreground">Drop</span>
              </span>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    currentView === item.id
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {item.label}
                  {item.id === 'dashboard' && activeSafes.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {activeSafes.length}
                    </span>
                  )}
                  {currentView === item.id && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute inset-0 rounded-lg border border-primary/20 -z-10"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </nav>

            {/* Desktop right section */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <Button
                onClick={() => handleNav('dashboard')}
                variant="outline"
                size="sm"
                className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary gap-2"
              >
                <HeartPulse className="h-4 w-4" />
                I&apos;m Alive
                {activeSafes.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                    {activeSafes.length}
                  </span>
                )}
              </Button>

              {/* Agent status badge */}
              <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ${
                agentConnected
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-muted-foreground/15 bg-secondary/50'
              }`}>
                <span className={`relative flex h-2 w-2`}>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${agentConnected ? 'bg-emerald-400' : 'bg-muted-foreground/40'} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${agentConnected ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                </span>
                <Bot className={`h-3.5 w-3.5 ${agentConnected ? 'text-emerald-400' : 'text-muted-foreground/60'}`} />
                <span className={`text-xs font-medium hidden lg:inline ${agentConnected ? 'text-emerald-400' : 'text-muted-foreground/60'}`}>
                  Agent {agentConnected ? 'Online' : 'Offline'}
                </span>
              </div>

              <WalletButton />
              <Button
                onClick={() => handleNav('create')}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 btn-glow"
              >
                <Shield className="h-4 w-4" />
                New Safe
              </Button>
              <ThemeToggle />
            </div>

            {/* Mobile: wallet + hamburger — flush right */}
            <div className="flex md:hidden items-center gap-2 shrink-0">
              <WalletButton />
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 left-0 right-0 z-40 md:hidden"
          >
            <div className="glass-card border-b border-border/50">
              <div className="px-4 py-4 space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      currentView === item.id
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      {item.label}
                      {item.id === 'dashboard' && activeSafes.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                          {activeSafes.length} active
                        </span>
                      )}
                    </span>
                  </button>
                ))}
                {/* Agent status in mobile */}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${agentConnected ? 'text-emerald-400' : 'text-muted-foreground/60'}`}>
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${agentConnected ? 'bg-emerald-400' : 'bg-muted-foreground/40'} opacity-75`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${agentConnected ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                  </span>
                  <Bot className="h-4 w-4" />
                  <span className="text-xs font-medium">Agent {agentConnected ? 'Online' : 'Offline'}</span>
                </div>
                <div className="pt-3 border-t border-border/50 space-y-2">
                  <Button
                    onClick={() => handleNav('create')}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Create New Safe
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ── Theme Toggle (next-themes, cycles: system → dark → light) ── */
function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  const cycle = () => {
    if (resolvedTheme === 'dark') setTheme('light')
    else if (resolvedTheme === 'light') setTheme('dark')
    else setTheme('light')
  }

  return (
    <button
      onClick={cycle}
      className="relative flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
    </button>
  )
}
