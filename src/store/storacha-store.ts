import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────

export type StorachaStatus =
  | 'idle'
  | 'initializing'
  | 'disconnected'
  | 'awaiting-email'
  | 'needs-plan'
  | 'creating-space'
  | 'ready'
  | 'error'

interface StorachaState {
  status: StorachaStatus
  email: string
  spaceDid: string | null
  spaceName: string | null
  accountEmail: string | null
  agentDid: string | null
  error: string | null

  // ✅ Actions must be inside interface
  init: () => Promise<void>
  login: (email: string) => Promise<void>
  checkConnection: () => Promise<void>
  cancel: () => void
  reset: () => void
}

// ─── Initial state ─────────────────────────────────────

const initialState = {
  status: 'idle',
  email: '',
  spaceDid: null,
  spaceName: null,
  accountEmail: null,
  agentDid: null,
  error: null,
}

// ─── Abort controller ──────────────────────────────────

let abortController: AbortController | null = null

const STORAGE_KEY = 'safedrop-storacha-connected'

function persistConnected(email?: string, did?: string | null) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ email: email || '', did: did || '' })
    )
  } catch {}
}

function clearConnected() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

// ─── Store ────────────────────────────────────────────

export const useStorachaStore = create<StorachaState>((set, get) => ({
  ...initialState,

  init: async () => {
    const { status } = get()
    if (
      status === 'initializing' ||
      status === 'ready' ||
      status === 'awaiting-email' ||
      status === 'creating-space'
    ) return

    set({ status: 'initializing', error: null })

    try {
      const mod = await import('@/lib/storacha')
      const state = await mod.checkClientState()
      const client = await mod.getClient()
      const agentDid = client.did()

      if (state.isConnected && state.spaceDid) {
        persistConnected(state.accountEmail, agentDid)
        set({
          status: 'ready',
          spaceDid: state.spaceDid,
          spaceName: state.spaceName,
          accountEmail: state.accountEmail,
          agentDid,
          error: null,
        })
      } else if (state.hasAccount && !state.hasSpace) {
        set({
          status: 'needs-plan',
          accountEmail: state.accountEmail,
          email: state.accountEmail || '',
          agentDid,
          error: null,
        })
      } else {
        clearConnected()
        set({ status: 'disconnected', error: null })
      }
    } catch {
      set({
        status: 'disconnected',
        error: 'Could not initialize Storacha.',
      })
    }
  },

  login: async (email: string) => {
    abortController?.abort()
    abortController = new AbortController()
    const signal = abortController.signal

    set({ email, status: 'awaiting-email', error: null })

    try {
      const mod = await import('@/lib/storacha')
      await mod.loginEmail(email, { signal })
      if (signal.aborted) return

      const client = await mod.getClient()
      const agentDid = client.did()

      set({
        status: 'needs-plan',
        accountEmail: email,
        agentDid,
        error: null,
      })
    } catch (err: unknown) {
      if (signal.aborted) {
        set({ status: 'disconnected', error: null })
        return
      }
      set({
        status: 'disconnected',
        error:
          err instanceof Error
            ? err.message
            : 'Email verification failed.',
      })
    }
  },

  checkConnection: async () => {
    set({ status: 'initializing', error: null })

    try {
      const mod = await import('@/lib/storacha')
      const state = await mod.checkClientState()
      const client = await mod.getClient()

      if (state.hasSpace) {
        const agentDid = client.did()
        persistConnected(state.accountEmail, agentDid)

        set({
          status: 'ready',
          spaceDid: state.spaceDid,
          spaceName: state.spaceName,
          accountEmail: state.accountEmail,
          agentDid,
          error: null,
        })
        return
      }

      set({
        status: 'needs-plan',
        error: 'No plan detected yet.',
      })
    } catch {
      set({
        status: 'needs-plan',
        error: 'Could not check connection.',
      })
    }
  },

  cancel: () => {
    abortController?.abort()
    abortController = null
    clearConnected()
    set({ status: 'disconnected', error: null })
  },

  reset: () => {
    abortController?.abort()
    abortController = null
    clearConnected()
    set({ ...initialState })
  },
}))