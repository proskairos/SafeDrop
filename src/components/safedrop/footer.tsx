'use client'

import { motion } from 'framer-motion'
import { Shield, Github, ExternalLink, Blocks, Trophy } from 'lucide-react'
import { useSafeDropStore } from '@/store/safedrop-store'

export function Footer() {
  const { setCurrentView } = useSafeDropStore()

  const footerLinks = [
    {
      title: 'Product',
      links: [
        { label: 'Create Safe', action: () => setCurrentView('create') },
        { label: 'Recover Safe', action: () => setCurrentView('recover') },
        { label: 'My Safes', action: () => setCurrentView('dashboard') },
      ],
    },
    {
      title: 'How It Works',
      links: [
        { label: 'Five-Step Flow', href: '#how-it-works' },
        { label: 'Key Splitting', href: '#features' },
        { label: 'Custodian Agent', href: '#features' },
        { label: 'Security Model', href: '#features' },
      ],
    },
    {
      title: 'Community',
      links: [
        { label: 'GitHub', href: 'https://github.com/proskairos/safedrop', icon: Github },
        { label: 'Protocol Labs', href: 'https://protocol.ai', icon: ExternalLink },
        { label: 'Storacha', href: 'https://storacha.network', icon: ExternalLink },
      ],
    },
  ]

  const handleLinkClick = (link: { action?: () => void; href?: string }) => {
    if (link.action) {
      link.action()
      return
    }
    if (link.href) {
      if (link.href.startsWith('http')) {
        window.open(link.href, '_blank', 'noopener,noreferrer')
        return
      }
      setCurrentView('home')
      setTimeout(() => {
        const el = document.querySelector(link.href!)
        el?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }

  return (
    <footer className="relative border-t border-border/50 mt-auto">
      {/* Top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer */}
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <Shield className="h-7 w-7 text-primary" />
                <span className="text-lg font-bold tracking-tight">
                  <span className="text-gradient-emerald">Safe</span>
                  <span className="text-foreground">Drop</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Trustless dead man&apos;s switch on Filecoin. XOR-split keys,
                on-chain timers, and an autonomous custodian agent — your secrets,
                your control.
              </p>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/15 bg-primary/5 w-fit">
                <Blocks className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary/80">Filecoin Calibration</span>
              </div>
            </div>

            {/* Link columns */}
            {footerLinks.map((column) => (
              <div key={column.title}>
                <h4 className="text-sm font-semibold text-foreground mb-4">{column.title}</h4>
                <ul className="space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <button
                        onClick={() => handleLinkClick(link)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 group cursor-pointer"
                      >
                        {link.icon && <link.icon className="h-3.5 w-3.5" />}
                        {link.label}
                        {link.href && link.href.startsWith('http') && (
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap justify-center">
            <span>Built by</span>
            <span className="text-foreground font-medium">Proskairos</span>
            <span>&bull;</span>
            <span className="inline-flex items-center gap-1">
              <Trophy className="h-3 w-3 text-primary" />
              <span>PL_Genesis: Frontiers of Collaboration</span>
            </span>
            <span>&bull;</span>
            <span>by</span>
            <a
              href="https://protocol.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-medium hover:text-primary transition-colors"
            >
              Protocol Labs
            </a>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Blocks className="h-3 w-3" />
              Filecoin FEVM
            </span>
            <span className="hidden sm:inline">&bull;</span>
            <span>IPFS &bull; Storacha &bull; AES-256-GCM</span>
          </div>
          <div className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} SafeDrop
          </div>
        </div>
      </div>
    </footer>
  )
}
