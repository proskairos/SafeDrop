// ─── Storacha IPFS Client Wrapper ──────────────────────────────
// Lazy-loaded to avoid SSR issues — @storacha/client uses IndexedDB
// and browser-only APIs. All functions are async and safe to call
// only from client-side code (event handlers, useEffect, etc.).
//
// IMPORTANT: IndexedDB is per-origin. The Storacha console at
// console.storacha.network has its OWN IndexedDB. Our site has a
// separate one. Sessions do NOT carry over between origins.
// The user must do email verification on OUR site specifically.

import type { CID } from 'multiformats'

// ─── Internal client singleton ────────────────────────────────

type StorachaClient = {
  login: (email: string, opts?: { signal?: AbortSignal; appName?: string }) => Promise<StorachaAccount>
  accounts: () => Record<string, StorachaAccount>
  currentSpace: () => StorachaSpace | undefined
  setCurrentSpace: (did: string) => Promise<void>
  spaces: () => StorachaSpace[]
  uploadFile: (file: Blob, opts?: { retries?: number; signal?: AbortSignal; onShardStored?: (meta: { cid: CID }) => void }) => Promise<CID>
  did: () => string
}

type StorachaAccount = {
  plan: {
    wait: (opts?: { interval?: number; timeout?: number; signal?: AbortSignal }) => Promise<unknown>
    get: (opts?: { nonce?: string }) => Promise<{ ok?: boolean } | unknown>
  }
  did: () => string
  toEmail: () => string
}

// NOTE: Space.name is a GETTER (not a method) in @storacha/client
type StorachaSpace = {
  did: () => string
  name: string  // getter: `get name(): string` in SDK
  registered: () => boolean
}

let _client: StorachaClient | null = null
let _clientPromise: Promise<StorachaClient> | null = null

// ─── Client Initialization ────────────────────────────────────

/**
 * Get or create the Storacha client singleton.
 * Uses dynamic import to avoid SSR crashes.
 */
export async function getClient(): Promise<StorachaClient> {
  if (_client) return _client
  if (_clientPromise) return _clientPromise

  _clientPromise = (async () => {
    const Client = await import('@storacha/client')
    const client = await Client.create()
    _client = client as unknown as StorachaClient
    return _client
  })()

  return _clientPromise
}

// ─── Email Login (only verification — plan/space at console) ─

/**
 * Send verification email and wait for user to click the link.
 * After this resolves, user still needs to:
 *   1. Go to console.storacha.network
 *   2. Select a plan
 *   3. Create a space
 *   4. Then call checkClientState() to detect the space.
 */
export async function loginEmail(
  email: string,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const client = await getClient()
  await client.login(email, {
    signal: opts?.signal,
    appName: 'SafeDrop',
  })
}

// ─── Upload ───────────────────────────────────────────────────

/**
 * Upload encrypted binary data to Storacha/IPFS.
 * @param data - Encrypted blob as Uint8Array
 * @param opts - Optional signal for abort, and progress callback
 * @returns CID string (e.g. "bafybeig...")
 */
export async function uploadEncryptedBlob(
  data: Uint8Array,
  opts?: {
    signal?: AbortSignal
    onShardStored?: (meta: { cid: string }) => void
  },
): Promise<string> {
  const client = await getClient()

  // Always use "safedrop" space
  const spaces = client.spaces()
  const safedropSpace = spaces.find(s => s.name === 'safedrop')

  if (safedropSpace) {
    // safedrop space exists, set it as current
    await client.setCurrentSpace(safedropSpace.did())
  } else {
    // No safedrop space, create one
    const accounts = client.accounts()
    const accountEntries = Object.values(accounts)
    if (accountEntries.length === 0) {
      throw new Error('No account found. Please login to Storacha first.')
    }
    const account = accountEntries[0]
    await client.createSpace('safedrop', { account })
    // Set the new space as current
    const newSpaces = client.spaces()
    const newSafedropSpace = newSpaces.find(s => s.name === 'safedrop')
    if (newSafedropSpace) {
      await client.setCurrentSpace(newSafedropSpace.did())
    }
  }

  const file = new Blob([data], { type: 'application/octet-stream' })
  const cid = await client.uploadFile(file, {
    signal: opts?.signal,
    ...(opts?.onShardStored && {
      onShardStored: (meta: { cid: CID }) => {
        opts.onShardStored!({ cid: meta.cid.toString() })
      },
    }),
  })

  return cid.toString()
}

// ─── Download (from IPFS gateway — no Storacha client needed) ─

/**
 * Fetch encrypted data from IPFS gateway.
 * Anyone with a CID can do this — no authentication required.
 */
export async function fetchFromIpfs(cid: string): Promise<Uint8Array> {
  const url = `https://${cid}.ipfs.storacha.link`
  const response = await fetch(url)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Content not found (CID: ${cid}). The encrypted data may have been removed or CID is invalid.`,
      )
    }
    throw new Error(
      `Failed to fetch from IPFS gateway: ${response.status} ${response.statusText}. CID: ${cid}`,
    )
  }

  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}

// ─── State Check (for auto-init + recheck after console setup) ─

export interface ClientState {
  isConnected: boolean
  hasAccount: boolean
  hasSpace: boolean
  spaceDid: string | null
  spaceName: string | null
  accountEmail: string | null
}

/**
 * Check if the Storacha client is already authenticated (has account + space).
 * Safe to call on mount to auto-restore state from IndexedDB.
 * Also called after user finishes setup at console.storacha.network.
 */
export async function checkClientState(): Promise<ClientState> {
  try {
    const client = await getClient()
    const accounts = client.accounts()
    const accountEntries = Object.values(accounts)
    const hasAccount = accountEntries.length > 0

    if (!hasAccount) {
      return { isConnected: false, hasAccount: false, hasSpace: false, spaceDid: null, spaceName: null, accountEmail: null }
    }

    const space = client.currentSpace()
    const hasSpace = !!space
    const account = accountEntries[0]
    const email = account.toEmail?.() ?? null

    return {
      isConnected: hasSpace,
      hasAccount: true,
      hasSpace,
      spaceDid: hasSpace ? space!.did() : null,
      // space.name is a getter, not a method
      spaceName: hasSpace ? (space!.name || null) : null,
      accountEmail: email,
    }
  } catch {
    return { isConnected: false, hasAccount: false, hasSpace: false, spaceDid: null, spaceName: null, accountEmail: null }
  }
}
