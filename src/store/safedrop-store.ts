import { create } from 'zustand'

export type SafeStatus = 'active' | 'warning' | 'expired' | 'released'

export interface SafeItem {
  id: string
  title: string
  recipient: string
  message: string
  timeoutDays: number
  lastActive: number
  createdAt: number
  cid: string
  encryptionKey: string
  status: SafeStatus
  notified: boolean
}

interface SafeDropState {
  safes: SafeItem[]
  currentView: 'home' | 'create' | 'recover' | 'dashboard'
  createStep: number
  isCreating: boolean
  isRecovering: boolean
  recoveredMessage: string
  addSafe: (safe: Omit<SafeItem, 'id' | 'createdAt' | 'status' | 'notified'>) => void
  removeSafe: (id: string) => void
  updateSafeActivity: (id: string) => void
  setCurrentView: (view: 'home' | 'create' | 'recover' | 'dashboard') => void
  setCreateStep: (step: number) => void
  setIsCreating: (value: boolean) => void
  setIsRecovering: (value: boolean) => void
  setRecoveredMessage: (msg: string) => void
  refreshSafeStatuses: () => void
}

function calculateStatus(safe: SafeItem): SafeStatus {
  const now = Date.now()
  const elapsed = now - safe.lastActive
  const timeoutMs = safe.timeoutDays * 24 * 60 * 60 * 1000
  const remaining = timeoutMs - elapsed
  const warningThreshold = 3 * 24 * 60 * 60 * 1000 // 3 days warning

  if (safe.notified) return 'released'
  if (remaining <= 0) return 'expired'
  if (remaining <= warningThreshold) return 'warning'
  return 'active'
}

export const useSafeDropStore = create<SafeDropState>((set, get) => ({
  safes: [
    // Demo data
    {
      id: 'demo-1',
      title: 'Emergency Bitcoin Wallet Access',
      recipient: 'sarah@example.com',
      message: 'My BTC wallet seed phrase is stored securely. If you receive this, something happened to me. The wallet contains 2.5 BTC.',
      timeoutDays: 30,
      lastActive: Date.now() - 25 * 24 * 60 * 60 * 1000,
      createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
      cid: 'bafybeigx4zjw4s2jw4a5nqxk3dih2qj4pzjqy',
      encryptionKey: 'a3F8kL9mN2pQ5rS7tU1vW4xY6zA0bC3dE5fG7hJ9kL1mN',
      status: 'warning',
      notified: false,
    },
    {
      id: 'demo-2',
      title: 'Family Insurance Documents',
      recipient: 'james@example.com',
      message: 'All insurance policy documents and passwords are in the encrypted folder on my laptop. Password for the folder: S3cur3P@ss2024',
      timeoutDays: 90,
      lastActive: Date.now() - 10 * 24 * 60 * 60 * 1000,
      createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
      cid: 'bafybeihj7w2s3k4l5m6n7o8p9q0r1s2t3u4v5w6x',
      encryptionKey: 'x9K2mP5rT8vW1yB4dF7gH0jL3nQ6sU9wZ2cE5fR8iA1',
      status: 'active',
      notified: false,
    },
    {
      id: 'demo-3',
      title: 'Personal Letters & Memories',
      recipient: 'emma@example.com',
      message: 'Dear Emma, I wrote these letters for you over the years. They contain my deepest thoughts and wishes for your future...',
      timeoutDays: 60,
      lastActive: Date.now() - 2 * 24 * 60 * 60 * 1000,
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      cid: 'bafybeidl4k5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a',
      encryptionKey: 'p7R1sT4uV8wY2bC5dF8gH1jK4lM7nQ0pS3tW6vZ9',
      status: 'active',
      notified: false,
    },
  ],
  currentView: 'home',
  createStep: 0,
  isCreating: false,
  isRecovering: false,
  recoveredMessage: '',
  addSafe: (safe) => {
    const id = `safe-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    const newSafe: SafeItem = {
      ...safe,
      id,
      createdAt: Date.now(),
      status: 'active',
      notified: false,
    }
    set((state) => ({ safes: [newSafe, ...state.safes] }))
  },
  removeSafe: (id) => {
    set((state) => ({ safes: state.safes.filter((s) => s.id !== id) }))
  },
  updateSafeActivity: (id) => {
    set((state) => ({
      safes: state.safes.map((s) =>
        s.id === id ? { ...s, lastActive: Date.now() } : s
      ),
    }))
  },
  setCurrentView: (view) => set({ currentView: view }),
  setCreateStep: (step) => set({ createStep: step }),
  setIsCreating: (value) => set({ isCreating: value }),
  setIsRecovering: (value) => set({ isRecovering: value }),
  setRecoveredMessage: (msg) => set({ recoveredMessage: msg }),
  refreshSafeStatuses: () => {
    set((state) => ({
      safes: state.safes.map((s) => ({ ...s, status: calculateStatus(s) })),
    }))
  },
}))
