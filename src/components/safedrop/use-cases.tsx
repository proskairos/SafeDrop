'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Shield, Lock, Globe, Zap, Eye, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSafeDropStore } from '@/store/safedrop-store'

const useCases = [
  {
    icon: Shield,
    title: 'Digital Inheritance',
    description:
      'Pass on cryptocurrency wallets, passwords, and important documents to loved ones. XOR-split keys ensure no single party can access your secrets prematurely.',
    gradient: 'from-emerald-500/10 to-transparent',
  },
  {
    icon: Lock,
    title: 'Emergency Access',
    description:
      'Ensure trusted contacts can access critical accounts if something unexpected happens. The custodian agent monitors and auto-reveals without human intervention.',
    gradient: 'from-teal-500/10 to-transparent',
  },
  {
    icon: Eye,
    title: 'Whistleblower Dead Man\'s Switch',
    description:
      'Release sensitive information automatically if you\'re unable to check in. A powerful accountability tool — encrypted on IPFS, unstoppable on Filecoin.',
    gradient: 'from-green-500/10 to-transparent',
  },
  {
    icon: Bot,
    title: 'Autonomous Key Custody',
    description:
      'The on-chain agent holds your key shares with AES-256-GCM encryption at rest. It polls every 30 seconds and auto-reveals when your timer expires — no trust required.',
    gradient: 'from-amber-500/10 to-transparent',
  },
]

export function UseCases() {
  const { setCurrentView } = useSafeDropStore()

  return (
    <section className="relative py-24 lg:py-32">
      <div className="absolute top-0 left-0 right-0 section-divider" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-4">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Use Cases
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Built for What{' '}
            <span className="text-gradient-emerald">Matters Most</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From personal security to organizational resilience, SafeDrop ensures your most
            critical information reaches the right hands — on your terms.
          </p>
        </motion.div>

        {/* Use cases grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <div className="relative glass-card glass-card-hover rounded-2xl p-6 lg:p-8 h-full transition-all duration-300 overflow-hidden">
                {/* Background gradient */}
                <div
                  className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl ${useCase.gradient} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />

                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 mb-5 group-hover:bg-primary/15 transition-colors">
                    <useCase.icon className="h-5 w-5 text-primary" />
                  </div>

                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {useCase.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {useCase.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 lg:mt-20"
        >
          <div className="relative glass-card rounded-3xl p-8 sm:p-12 lg:p-16 overflow-hidden glow-emerald">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-600/5 rounded-full blur-[60px] pointer-events-none" />

            <div className="relative z-10 text-center max-w-2xl mx-auto">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6"
              >
                <Shield className="h-8 w-8 text-primary" />
              </motion.div>

              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
                Ready to Secure Your{' '}
                <span className="text-gradient-emerald">Digital Legacy</span>?
              </h3>
              <p className="text-muted-foreground text-base sm:text-lg mb-8 max-w-lg mx-auto">
                Create your first encrypted safe in under 60 seconds. Your data is encrypted
                before it leaves your browser.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => setCurrentView('create')}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-base px-8 py-6 btn-glow"
                >
                  <Shield className="h-5 w-5" />
                  Create Your First Safe
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  AES-256-GCM
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  IPFS / Storacha
                </span>
                <span className="flex items-center gap-1.5">
                  <Bot className="h-3 w-3" />
                  Custodian Agent
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
