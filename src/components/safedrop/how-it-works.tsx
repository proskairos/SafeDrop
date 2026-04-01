'use client'

import { motion } from 'framer-motion'
import {
  FileEdit,
  KeyRound,
  FileCode2,
  HeartPulse,
  Unlock,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'

const steps = [
  {
    icon: FileEdit,
    title: 'Write & Encrypt',
    description:
      'Write a message or attach a file. AES-256-GCM encryption happens entirely in your browser — your data never leaves your device unencrypted.',
  },
  {
    icon: KeyRound,
    title: 'Split the Key',
    description:
      'Your encryption key is XOR-split into two shares. Neither share alone reveals anything — information-theoretically secure, like a one-time pad.',
  },
  {
    icon: FileCode2,
    title: 'Register On-Chain',
    description:
      'Encrypted blob goes to IPFS. Share1 embeds in a recovery link + QR. Share2 is held by the Custodian Agent (AES-256-GCM encrypted at rest). Smart contract tracks the timer.',
  },
  {
    icon: HeartPulse,
    title: 'Check In Regularly',
    description:
      "Log in and click \"I'm Alive\" to reset your timer. Choose 1–365 days. As long as you check in, nothing happens.",
  },
  {
    icon: Unlock,
    title: 'Auto-Reveal on Timeout',
    description:
      'Timer expires → Agent detects release → publishes share2 on-chain. Beneficiary uses recovery link to combine shares and decrypt.',
  },
]

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-0 left-0 right-0 section-divider" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/3 blur-[160px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-4">
            <Unlock className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              How It Works
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Five Steps to{' '}
            <span className="text-gradient-emerald">Digital Peace of Mind</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your secrets are encrypted client-side with XOR key splitting before
            they ever leave your browser. Simple to set up, impossible to break.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="space-y-5"
        >
          {steps.map((step, i) => (
            <motion.div key={`step-${i}`} variants={fadeUp}>
              <div className="relative glass-card glass-card-hover rounded-2xl p-6 sm:p-8 flex gap-5 sm:gap-6 items-start transition-all duration-300">
                {/* Step number — left accent */}
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  {/* Connector dot between steps */}
                  {i < steps.length - 1 && (
                    <div className="w-px h-6 bg-gradient-to-b from-primary/20 to-transparent mt-2" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-xs font-bold text-primary/50 tabular-nums">0{i + 1}</span>
                    <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Arrow indicator (desktop) */}
                <div className="hidden sm:flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-4 w-4 text-primary/20" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Security note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-16 text-center"
        >
          <div className="glass-card rounded-2xl border border-primary/10 max-w-3xl mx-auto p-6 sm:p-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <h4 className="text-lg font-semibold text-foreground">
                Zero-Knowledge Architecture
              </h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Your data is encrypted <strong className="text-foreground">BEFORE</strong> it leaves
              your browser — SafeDrop never sees your plaintext. The Custodian
              Agent&apos;s database is encrypted at rest with AES-256-GCM.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
