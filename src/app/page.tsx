'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from '@/components/safedrop/navbar'
import { Hero } from '@/components/safedrop/hero'
import { HowItWorks } from '@/components/safedrop/how-it-works'
import { Features } from '@/components/safedrop/features'
import { UseCases } from '@/components/safedrop/use-cases'
import { CreateSafeForm } from '@/components/safedrop/create-safe-form'
import { MySafes } from '@/components/safedrop/my-safes'
import { RecoverSafe } from '@/components/safedrop/recover-safe'
import { Footer } from '@/components/safedrop/footer'
import { useSafeDropStore } from '@/store/safedrop-store'

export default function Home() {
  const { currentView, setCurrentView } = useSafeDropStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()

  // Sync URL ?view= param → store on mount (for recovery links, deep links, etc.)
  useEffect(() => {
    const viewParam = searchParams.get('view')
    if (viewParam === 'recover' || viewParam === 'create' || viewParam === 'dashboard') {
      setCurrentView(viewParam)
    }
  }, []) // run once on mount only

  useEffect(() => {
    // Scroll to top when view changes
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentView])

  return (
    <div ref={scrollRef} className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Hero />
              <HowItWorks />
              <Features />
              <UseCases />
            </motion.div>
          )}

          {currentView === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <CreateSafeForm />
            </motion.div>
          )}

          {currentView === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <MySafes />
            </motion.div>
          )}

          {currentView === 'recover' && (
            <motion.div
              key="recover"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <RecoverSafe />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  )
}
