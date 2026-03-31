import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────

export type StorachaStatus =
  | 'idle'             // Not initialized yet
  | 'initializing'     // Creating client, checking IndexedDB
  | 'disconnected'     // No account in this origin's IndexedDB
  | 'awaiting-email'   // Verification email sent, waiting for click
  | 'needs-plan'       // Email verified but no payment plan
  | 'creating-space'   // Plan found, creating space
  | 'ready'            // Fully connected: account + plan + space
  | 'error'            // Something went wrong

interface StorachaState {
  status: StorachaStatus
  email: string
  spaceDid: string | null
  spaceName: string | null
  accountEmail: string | null
  agentDid: string | null
  error: string | null

  // Actions
  init: () => Promise<void>
  login: (email: string) => Promise<void>
  checkConnection: () => Promise<void>
  cancel: () => void
  reset: () => void
}

// ─── Abort controller for canceling login ─────────────────────

let abortController: AbortController | null = null

// ─── Store ────────────────────────────────────────────────────

const STORAGE_KEY = 'safedrop-storacha-connected'

function persistConnected(email?: string, did?: string | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: email || '', did: did || '' }))
  } catch { /* ignore */ }
}

function clearConnected() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

export const useStorachaStore = create<StorachaState>((set, get) => ({
  status: 'idle',
  email: '',
  spaceDid: null,
  spaceName: null,
  accountEmail: null,
  agentDid: null,
  error: null,

  init: async () => {
    const { status } = get()
    if (status === 'initializing' || status === 'ready' || status === 'awaiting-email' || status === 'creating-space') return

    set({ status: 'initializing', error: null })

    try {
      const mod = await import('@/lib/storacha')
      const state = await mod.checkClientState()
      const client = await mod.getClient()
      const agentDid = client.did()

      if (state.isConnected && state.spaceDid) {
        persistConnected(state.accountEmail, agentDid)
        set({ status: 'ready', spaceDid: state.spaceDid, spaceName: state.spaceName, accountEmail: state.accountEmail, agentDid, error: null })
      } else if (state.hasAccount && state.hasPlan && !state.hasSpace) {
        set({ status: 'creating-space', accountEmail: state.accountEmail, email: state.accountEmail || '', agentDid, error: null })
        try {
          const account = Object.values(client.accounts())[0]
          const space = await mod.ensureSpace(account)
          persistConnected(state.accountEmail, agentDid)
          set({ status: 'ready', spaceDid: space.did(), spaceName: space.name || null, accountEmail: state.accountEmail, agentDid, error: null })
        } catch { set({ status: 'disconnected', error: null }) }
      } else if (state.hasAccount && !state.hasPlan) {
        set({ status: 'needs-plan', accountEmail: state.accountEmail, email: state.accountEmail || '', agentDid, error: null })
      } else {
        clearConnected()
        set({ status: 'disconnected', error: null })
      }
    } catch {
      set({ status: 'disconnected', error: 'Could not initialize Storacha. Make sure you are not in private browsing mode.' })
    }
  },

  login: async (email: string) => {
    abortController?.abort()
    abortController = new AbortController()
    const signal = abortController.signal
    set({ email, status: 'awaiting-email', error: null })

    try {
      const mod = await import('@/lib/storacha')
      const account = await mod.loginEmail(email, { signal })
      if (signal.aborted) return

      const client = await mod.getClient()
      const agentDid = client.did()
      const hasPlan = await mod.checkHasPlan(account)
      if (signal.aborted) return

      if (!hasPlan) {
        set({ status: 'needs-plan', accountEmail: email, agentDid, error: null })
      } else {
        set({ status: 'creating-space', accountEmail: email, agentDid, error: null })
        try {
          const space = await mod.ensureSpace(account)
          persistConnected(email, agentDid)
          set({ status: 'ready', spaceDid: space.did(), spaceName: space.name || null, accountEmail: email, agentDid, error: null })
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to create space'
          set({ status: 'needs-plan', agentDid, error: `Could not create space automatically: ${msg}. Please create one at console.storacha.network.` })
        }
      }
    } catch (err: unknown) {
      if (signal.aborted) { set({ status: 'disconnected', error: null }); return }
      set({ status: 'disconnected', error: err instanceof Error ? err.message : 'Email verification failed.' })
    }
  },

  checkConnection: async () => {
    set({ status: 'initializing', error: null })
    try {
      const mod = await import('@/lib/storacha')
      const state = await mod.checkClientState()
      const client = await mod.getClient()

      if (state.hasPlan) {
        if (!state.hasSpace) {
          try {
            const account = Object.values(client.accounts())[0]
            const space = await mod.ensureSpace(account)
            persistConnected(state.accountEmail, client.did())
            set({ status: 'ready', spaceDid: space.did(), spaceName: space.name || null, accountEmail: state.accountEmail, agentDid: client.did(), error: null })
            return
          } catch { /* fall through */ }
        } else {
          const agentDid = client.did()
          persistConnected(state.accountEmail, agentDid)
          set({ status: 'ready', spaceDid: state.spaceDid, spaceName: state.spaceName, accountEmail: state.accountEmail, agentDid, error: null })
          return
        }
      }
      set({ status: 'needs-plan', error: 'No plan detected yet. Make sure you selected a plan at console.storacha.network.' })
    } catch {
      set({ status: 'needs-plan', error: 'Could not check connection. Please try again.' })
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
    set({ status: 'idle', email: '', spaceDid: null, spaceName: null, accountEmail: null, agentDid: null, error: null })
  },
}))
