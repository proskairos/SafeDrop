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

  init: () => Promise<void>
  login: (email: string) => Promise<void>
  checkConnection: () => Promise<void>
  cancel: () => void
  reset: () => void
}

// ─── Initial state ─────────────────────────────────────

const initialState = {
  status: 'idle' as StorachaStatus,
  email: '',
  spaceDid: null,
  spaceName: null,
  accountEmail: null,
  agentDid: null,
  error: null,
}

// ─── Abort controller ──────────────────────────────────

let abortController: AbortController | null = null

// ─── Storage helpers (SSR safe) ───────────────────────

const STORAGE_KEY = 'safedrop-storacha-connected'

function persistConnected(email?: string, did?: string | null) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ email: email || '', did: did || '' })
    )
  } catch {}
}

function clearConnected() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────

// ✅ Plan check
async function hasPlan(client: any): Promise<boolean> {
  try {
    const account = Object.values(client.accounts())[0] as any
    if (!account) return false

    await client.capability.plan.get(account.did())
    return true
  } catch {
    return false
  }
}

// ✅ Safe space access (fixes your error)
function getSpaceDid(space: any): string | null {
  if (!space) return null
  return typeof space.did === 'function' ? space.did() : space.did || null
}

function getSpaceName(space: any): string | null {
  if (!space) return null
  return typeof space.name === 'function'
    ? space.name()
    : space.name || null
}

// ─── Store ────────────────────────────────────────────

export const useStorachaStore = create<StorachaState>((set, get) => ({
  ...initialState,

  // ─── INIT ──────────────────────────────────────────

  init: async () => {
    if (typeof window === 'undefined') return

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

      if (!state.hasAccount) {
        clearConnected()
        set({ status: 'disconnected', error: null })
        return
      }

      // ✅ Plan check
      const planExists = await hasPlan(client)

      if (!planExists) {
        set({
          status: 'needs-plan',
          accountEmail: state.accountEmail,
          email: state.accountEmail || '',
          agentDid,
          error: null,
        })
        return
      }

      // ✅ Space check
      const space = client.currentSpace()

      if (!space) {
        set({
          status: 'creating-space',
          accountEmail: state.accountEmail,
          agentDid,
          error: null,
        })
        return
      }

      persistConnected(state.accountEmail, agentDid)

      set({
        status: 'ready',
        spaceDid: getSpaceDid(space),
        spaceName: getSpaceName(space),
        accountEmail: state.accountEmail,
        agentDid,
        error: null,
      })
    } catch (err) {
      console.error('Storacha init error:', err)
      set({
        status: 'disconnected',
        error:
          err instanceof Error
            ? err.message
            : 'Could not initialize Storacha.',
      })
    }
  },

  // ─── LOGIN ─────────────────────────────────────────

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

  // ─── CHECK CONNECTION ──────────────────────────────

  checkConnection: async () => {
    set({ status: 'initializing', error: null })

    try {
      const mod = await import('@/lib/storacha')
      const state = await mod.checkClientState()
      const client = await mod.getClient()

      const account = Object.values(client.accounts())[0] as any

      if (!account) {
        set({ status: 'disconnected' })
        return
      }

      const agentDid = client.did()

      // ✅ Plan check
      const planExists = await hasPlan(client)

      if (!planExists) {
        set({
          status: 'needs-plan',
          error: 'No plan detected yet.',
        })
        return
      }

      // ✅ Space check
      const space = client.currentSpace()

      if (!space) {
        set({
          status: 'creating-space',
          error: 'Plan exists but no space selected.',
        })
        return
      }

      persistConnected(state.accountEmail, agentDid)

      set({
        status: 'ready',
        spaceDid: getSpaceDid(space),
        spaceName: getSpaceName(space),
        accountEmail: state.accountEmail,
        agentDid,
        error: null,
      })
    } catch (err) {
      console.error('Storacha check error:', err)
      set({
        status: 'needs-plan',
        error: 'Could not check connection.',
      })
    }
  },

  // ─── CANCEL ────────────────────────────────────────

  cancel: () => {
    abortController?.abort()
    abortController = null
    clearConnected()
    set({ status: 'disconnected', error: null })
  },

  // ─── RESET ─────────────────────────────────────────

  reset: () => {
    abortController?.abort()
    abortController = null
    clearConnected()
    set({ ...initialState })
  },
}))