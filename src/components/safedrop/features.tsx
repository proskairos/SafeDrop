'use client'

import { motion } from 'framer-motion'
import {
  ShieldCheck,
  Lock,
  GitBranch,
  Bot,
  Blocks,
  FileCode2,
  HardDrive,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ── Inline SVG logos for less-common icons ── */

function StorachaLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2L4 9v14l12 7 12-7V9L16 2z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="16" cy="16" r="5" fill="currentColor" opacity="0.3" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
    </svg>
  )
}

interface Feature {
  icon: LucideIcon | typeof StorachaLogo
  title: string
  description: string
  highlight: string
}

const features: Feature[] = [
  {
    icon: Lock,
    title: 'AES-256-GCM Encryption',
    description:
      'Your messages are encrypted in-browser using military-grade AES-256-GCM with Web Crypto API. Random 12-byte IV and AAD binding prevent tampering.',
    highlight: 'In-browser only',
  },
  {
    icon: GitBranch,
    title: 'XOR Key Splitting',
    description:
      'The 256-bit key is split via XOR into two shares. Neither share alone reveals anything — information-theoretically secure. Share1 in recovery link, share2 to the custodian agent.',
    highlight: 'Information-theoretic security',
  },
  {
    icon: StorachaLogo,
    title: 'IPFS via Storacha',
    description:
      'Encrypted blobs are stored on IPFS through Storacha. No single server, no censorship, no takedown. Your data lives on the decentralized web.',
    highlight: 'Censorship resistant',
  },
  {
    icon: Bot,
    title: 'Custodian Agent',
    description:
      'An autonomous agent monitors your wills every 30 seconds. When a timer expires, it reveals share2 on-chain. The agent\'s database is encrypted at rest with AES-256-GCM.',
    highlight: 'Autonomous & encrypted',
  },
  {
    icon: Blocks,
    title: 'Filecoin Smart Contract',
    description:
      'The timeout timer lives in a Solidity contract on Filecoin FEVM with OpenZeppelin ReentrancyGuard. No one — not even SafeDrop — can stop the release mechanism.',
    highlight: 'Trustless on-chain timer',
  },
  {
    icon: FileCode2,
    title: 'Open Source',
    description:
      'Fully auditable codebase. Verify our encryption, inspect the agent, audit the contract. Trust the math — not the company.',
    highlight: 'Trust through transparency',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export function Features() {
  return (
    <section id="features" className="relative py-24 lg:py-32">
      <div className="absolute top-0 left-0 right-0 section-divider" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-primary/3 blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-4">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Core Features
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Security Without{' '}
            <span className="text-gradient-emerald">Compromise</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Built from the ground up with cryptography-first design. Every
            component prioritizes your sovereignty.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={cardVariants} className="group">
              <div className="relative glass-card glass-card-hover rounded-2xl p-6 lg:p-7 h-full transition-all duration-300">
                <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {feature.description}
                </p>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/10">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-xs font-medium text-primary/80">
                    {feature.highlight}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
