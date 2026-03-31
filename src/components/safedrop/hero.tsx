'use client'

import { motion } from 'framer-motion'
import { Shield, Lock, ArrowRight, Blocks, Bot, KeyRound, Link2, Timer, Globe, Cpu, Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSafeDropStore } from '@/store/safedrop-store'

/* ── Inline SVG logos ── */
function IPFSLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M128 0C57.308 0 0 57.308 0 128s57.308 128 128 128 128-57.308 128-128S198.692 0 128 0zm-8.083 191.25c-1.842.988-4.116.638-5.602-.866L71.83 148.9c-1.471-1.478-1.834-3.74-.911-5.6l18.564-38.416c.77-1.59 2.48-2.562 4.283-2.374l38.416 3.84c1.803.18 3.304 1.427 3.84 3.13l14.4 45.6c.558 1.759-.057 3.687-1.527 4.81l-25.978 31.36z" opacity=".6"/>
      <path d="M170.667 194.883c-1.92 0-3.84-.917-5.014-2.633L120.15 126.75c-1.834-2.633-1.034-6.283 1.6-8.117 2.633-1.833 6.283-1.033 8.116 1.6l45.504 65.5c1.833 2.634 1.033 6.284-1.6 8.117-1.034.733-2.183 1.033-3.103 1.033z" opacity=".8"/>
      <path d="M128 32c-53.019 0-96 42.981-96 96s42.981 96 96 96 96-42.981 96-96-42.981-96-96-96zm0 176c-44.183 0-80-35.817-80-80s35.817-80 80-80 80 35.817 80 80-35.817 80-80 80z" opacity=".4"/>
    </svg>
  )
}

function FilecoinLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M287.6 39.4c-22.5 0-40.8 18.3-40.8 40.8v56.9c0 22.5 18.3 40.8 40.8 40.8h56.9c22.5 0 40.8-18.3 40.8-40.8V80.2c0-22.5-18.3-40.8-40.8-40.8h-56.9zM167.5 159.5c-22.5 0-40.8 18.3-40.8 40.8v56.9c0 22.5 18.3 40.8 40.8 40.8h56.9c22.5 0 40.8-18.3 40.8-40.8v-56.9c0-22.5-18.3-40.8-40.8-40.8h-56.9zM167.5 279.7c-22.5 0-40.8 18.3-40.8 40.8v56.9c0 22.5 18.3 40.8 40.8 40.8h56.9c22.5 0 40.8-18.3 40.8-40.8v-56.9c0-22.5-18.3-40.8-40.8-40.8h-56.9zM287.6 159.5c-22.5 0-40.8 18.3-40.8 40.8v56.9c0 22.5 18.3 40.8 40.8 40.8h56.9c22.5 0 40.8-18.3 40.8-40.8v-56.9c0-22.5-18.3-40.8-40.8-40.8h-56.9zM287.6 279.7c-22.5 0-40.8 18.3-40.8 40.8v56.9c0 22.5 18.3 40.8 40.8 40.8h56.9c22.5 0 40.8-18.3 40.8-40.8v-56.9c0-22.5-18.3-40.8-40.8-40.8h-56.9z" opacity=".7"/>
    </svg>
  )
}

/* static "floating" tech badges — no rotation, just gentle float */
const badges = [
  { icon: KeyRound, label: 'AES-256', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/15', x: '5%', y: '20%', delay: 0 },
  { icon: Bot, label: 'Agent', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/15', x: '85%', y: '15%', delay: 0.8 },
  { icon: Lock, label: 'XOR Split', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/15', x: '10%', y: '75%', delay: 1.6 },
  { icon: Timer, label: 'On-Chain', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/15', x: '80%', y: '78%', delay: 0.4 },
  { icon: Link2, label: 'Recovery Link', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/15', x: '20%', y: '48%', delay: 1.2 },
  { icon: Globe, label: 'IPFS', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/15', x: '75%', y: '50%', delay: 2 },
]

export function Hero() {
  const { setCurrentView } = useSafeDropStore()

  const stats = [
    { value: 'AES-256-GCM', label: 'Encryption' },
    { value: 'IPFS', label: 'via Storacha' },
    { value: 'Filecoin FEVM', label: 'Smart Contract' },
  ]

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background — grid + radial glows */}
      <div className="absolute inset-0 grid-bg animate-grid-fade" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px] pointer-events-none" />

      {/* ── Floating tech badges (simple float animation, NO rotation) ── */}
      {badges.map((b) => (
        <motion.div
          key={b.label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 + b.delay, duration: 1 }}
          className="absolute pointer-events-none hidden lg:block"
          style={{ left: b.x, top: b.y }}
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 5 + b.delay, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className={`glass-card rounded-xl px-4 py-3 flex items-center gap-2.5 border ${b.border}`}>
              <div className={`h-8 w-8 rounded-lg ${b.bg} flex items-center justify-center`}>
                <b.icon className={`h-4 w-4 ${b.color}`} />
              </div>
              <span className="text-xs font-semibold text-foreground/70">{b.label}</span>
            </div>
          </motion.div>
        </motion.div>
      ))}

      {/* ── Central pulsing rings ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden lg:block">
        {[0, 1.5, 3].map((d) => (
          <motion.div
            key={d}
            animate={{ scale: [0.6, 2.2], opacity: [0.25, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeOut', delay: d }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-primary/15"
          />
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="max-w-2xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <Badge
              variant="outline"
              className="border-primary/30 text-primary bg-primary/5 px-4 py-1.5 mb-6 inline-flex items-center gap-2"
            >
              <Blocks className="h-3.5 w-3.5" />
              Dead Man&apos;s Switch
            </Badge>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
          >
            Your Secrets,{' '}
            <span className="text-gradient-emerald">Released</span>
            <br />
            <span className="text-foreground/90">on Your Terms</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed"
          >
            Encrypt sensitive data with AES-256-GCM, split the key, and let a
            trustless on-chain timer + autonomous agent ensure delivery — only
            when you stop checking in.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              onClick={() => setCurrentView('create')}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-base px-8 py-6 btn-glow glow-emerald-strong"
            >
              <Shield className="h-5 w-5" />
              Create a Safe
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              onClick={() => setCurrentView('recover')}
              variant="outline"
              size="lg"
              className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary gap-2 text-base px-8 py-6"
            >
              <Lock className="h-5 w-5" />
              Recover a Safe
            </Button>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>
                  <span className="text-foreground font-semibold">{stat.value}</span>{' '}
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  )
}
