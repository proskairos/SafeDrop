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
  safes: [],
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
