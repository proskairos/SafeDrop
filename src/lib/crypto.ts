// ─── Real AES-256-GCM Encryption Library ──────────────────────────
// Uses the Web Crypto API (available in all modern browsers + Node 20+)
// No external dependencies. Runs entirely client-side.

/**
 * Blob format for encrypted wills stored on IPFS:
 *
 *   ┌──────────────┬──────────────────────────────────────┐
 *   │  IV (12 B)   │  Ciphertext (variable length)        │
 *   └──────────────┴──────────────────────────────────────┘
 *
 * The IV is extracted from the blob for decryption.
 * The key is NEVER stored on-chain — only shared via the recovery link (#key fragment).
 */

// ─── Key Generation ──────────────────────────────────────────

/**
 * Generate a new AES-256-GCM key
 * Returns an extractable CryptoKey object (required for exportKeyToString / recovery link sharing)
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable — required for exportKeyToString (recovery link sharing)
    ['encrypt', 'decrypt'],
  )
}

/**
 * Export a CryptoKey as a raw key + base64 string (for recovery link sharing)
 * This is the ONLY way to serialize the key — use sparingly
 */
export async function exportKeyToString(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return arrayBufferToBase64(raw)
}

/**
 * Import a base64-encoded raw key string back into a CryptoKey
 */
export async function importKeyFromString(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(base64Key)
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true, // extractable for consistency
    ['decrypt'],
  )
}

/**
 * Export key as hex string (for on-chain IV storage compatibility)
 */
export async function exportKeyToHex(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return arrayBufferToHex(raw)
}

// ─── Encryption ──────────────────────────────────────────────

export interface EncryptResult {
  /** Combined blob: [IV (12 bytes)] + [ciphertext]
   *  This is what gets uploaded to IPFS */
  blob: Uint8Array

  /** Initialization Vector (12 bytes) — public, non-secret
   *  Stored on-chain in the encryptedKey field */
  iv: Uint8Array

  /** Raw ciphertext (without IV) */
  ciphertext: Uint8Array

  /** Base64-encoded key — for the recovery link #key= fragment */
  keyBase64: string
}

/**
 * Encrypt a plaintext message with AES-256-GCM
 *
 * @param plaintext - The message string to encrypt
 * @param key - AES-256-GCM CryptoKey (from generateEncryptionKey)
 * @returns EncryptResult with blob (for IPFS), iv (for chain), keyBase64 (for link)
 */
export async function encryptMessage(
  plaintext: string,
  key: CryptoKey,
  aad?: string,
): Promise<EncryptResult> {
  // Encode message as UTF-8 bytes
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  // Generate random IV (12 bytes recommended for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encrypt — include AAD to bind ciphertext to a context (e.g. CID)
  // This prevents ciphertext swapping / replay attacks
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128, additionalData: aad ? encoder.encode(aad) : undefined },
    key,
    data,
  )

  // Export the key as base64 for the recovery link
  const keyBase64 = await exportKeyToString(key)

  // Combine IV + ciphertext into single blob for IPFS storage
  const ciphertext = new Uint8Array(encrypted)
  const blob = new Uint8Array(iv.length + ciphertext.length)
  blob.set(iv, 0) // IV at the start
  blob.set(ciphertext, iv.length) // Ciphertext after

  return { blob, iv, ciphertext, keyBase64 }
}

/**
 * Encrypt a file (Blob) with AES-256-GCM
 *
 * @param file - File or Blob to encrypt
 * @param key - AES-256-GCM CryptoKey
 * @returns EncryptResult with blob (for IPFS), iv (for chain), keyBase64 (for link)
 */
export async function encryptFile(
  file: Blob,
  key: CryptoKey,
  aad?: string,
): Promise<EncryptResult> {
  // Read file as ArrayBuffer
  const data = await file.arrayBuffer()

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encrypt — include AAD for tamper protection
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128, additionalData: aad ? new TextEncoder().encode(aad) : undefined },
    key,
    data,
  )

  // Export key as base64
  const keyBase64 = await exportKeyToString(key)

  // Combine IV + ciphertext
  const ciphertext = new Uint8Array(encrypted)
  const blob = new Uint8Array(iv.length + ciphertext.length)
  blob.set(iv, 0)
  blob.set(ciphertext, iv.length)

  return { blob, iv, ciphertext, keyBase64 }
}

// ─── Decryption ──────────────────────────────────────────────

export interface DecryptResult {
  /** Decrypted plaintext as UTF-8 string */
  plaintext: string

  /** Raw decrypted bytes (useful for file recovery) */
  raw: Uint8Array
}

/**
 * Decrypt a message from IPFS blob + key
 *
 * @param blob - The raw bytes fetched from IPFS ([IV (12 B)] + [ciphertext])
 * @param keyBase64 - Base64-encoded AES-256-GCM key (from recovery link #key=)
 * @returns Decrypted plaintext
 */
export async function decryptMessage(
  blob: Uint8Array,
  keyBase64: string,
  aad?: string,
): Promise<DecryptResult> {
  // Import the key
  const key = await importKeyFromString(keyBase64)

  // Extract IV from the first 12 bytes
  const iv = blob.slice(0, 12)
  const ciphertext = blob.slice(12)

  try {
    // Decrypt — must supply same AAD used during encryption
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128, additionalData: aad ? new TextEncoder().encode(aad) : undefined },
      key,
      ciphertext,
    )

    const raw = new Uint8Array(decrypted)
    const plaintext = new TextDecoder().decode(raw)

    return { plaintext, raw }
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'OperationError' || err.name === 'InvalidAccessError')) {
      throw new Error('Decryption failed: invalid key or corrupted data. The recovery link may be incorrect or the encrypted content was tampered with.')
    }
    throw new Error(`Decryption failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

/**
 * Decrypt from separate IV + ciphertext (e.g. when IV comes from contract)
 */
export async function decryptMessageWithIV(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  keyBase64: string,
  aad?: string,
): Promise<DecryptResult> {
  const key = await importKeyFromString(keyBase64)

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128, additionalData: aad ? new TextEncoder().encode(aad) : undefined },
      key,
      ciphertext,
    )

    const raw = new Uint8Array(decrypted)
    const plaintext = new TextDecoder().decode(raw)

    return { plaintext, raw }
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'OperationError' || err.name === 'InvalidAccessError')) {
      throw new Error('Decryption failed: invalid key or corrupted data. The recovery link may be incorrect or the encrypted content was tampered with.')
    }
    throw new Error(`Decryption failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

// ─── Key Splitting (XOR Shamir) ──────────────────────────────
//
// SECURITY DESIGN: The 256-bit AES key is split into two 32-byte shares
// using XOR. Neither share alone reveals anything about the key.
//
//   share1 → embedded in recovery link (URL fragment, never sent to servers)
//   share2 → stored on-chain in contract's encryptedKey field
//
// Recovery only works when BOTH shares are combined:
//   key = share1 XOR share2
//
// The app enforces: only combine shares when contract says isReleased == true.
//
// Why this works:
//   - share1 alone (link) → random bytes, useless
//   - share2 alone (chain) → random bytes, useless
//   - Both + !isReleased  → UI refuses to combine
//   - Both + isReleased   → intended: will should be decryptable
//
// Honest limitation: A blockchain expert with the link COULD manually
// read share2 from contract state and XOR. But the owner controls when
// the link is shared, so the intended workflow is secure.

/**
 * Split an AES-256 key (base64) into two XOR shares.
 * Both shares are returned as base64 strings.
 *
 * share1 = random 32 bytes
 * share2 = key XOR share1
 *
 * Neither share leaks any information about the key (XOR with random
 * is a one-time pad — information-theoretically secure).
 */
export function splitKey(keyBase64: string): { share1: string; share2: string } {
  const keyBytes = new Uint8Array(base64ToArrayBuffer(keyBase64))
  const share1 = crypto.getRandomValues(new Uint8Array(keyBytes.length))
  const share2 = new Uint8Array(keyBytes.length)
  for (let i = 0; i < keyBytes.length; i++) {
    share2[i] = keyBytes[i] ^ share1[i]
  }
  return {
    share1: arrayBufferToBase64(share1.buffer),
    share2: arrayBufferToBase64(share2.buffer),
  }
}

/**
 * Combine two XOR shares to reconstruct the original AES key.
 *
 * @param share1Base64 - Share 1 (from recovery link)
 * @param share2Hex - Share 2 as hex bytes (from contract encryptedKey field)
 * @returns Reconstructed key as base64 (for Web Crypto decryptMessage)
 */
export function combineShares(share1Base64: string, share2Hex: string): string {
  const share1 = new Uint8Array(base64ToArrayBuffer(share1Base64))
  const clean = share2Hex.startsWith('0x') ? share2Hex.slice(2) : share2Hex
  const share2 = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    share2[i / 2] = parseInt(clean.substring(i, i + 2), 16)
  }
  const key = new Uint8Array(share1.length)
  for (let i = 0; i < key.length; i++) {
    key[i] = share1[i] ^ share2[i]
  }
  return arrayBufferToBase64(key.buffer)
}

// ─── Recovery URL Builder ────────────────────────────────────

/**
 * Build the recovery URL for sharing with beneficiary.
 *
 * Format: ?view=recover&willId=123#s1=<base64(share1)>
 *
 * The share1 is in the URL fragment (#) — browsers NEVER send fragments
 * to servers. Even if intercepted, share1 alone is random bytes (useless).
 *
 * @param baseUrl - e.g. "https://safedrop.app"
 * @param willId - On-chain will ID (from WillCreated event)
 * @param share1Base64 - Share 1 of the XOR-split key
 * @returns Full recovery URL
 */
export function buildRecoveryUrl(baseUrl: string, willId: number, share1Base64: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('view', 'recover')
  url.searchParams.set('willId', String(willId))
  url.hash = `s1=${encodeURIComponent(share1Base64)}`
  return url.toString()
}

/**
 * Parse a recovery URL to extract willId and share1.
 *
 * @param url - Full URL
 * @returns { willId, share1 } or null if invalid
 */
export function parseRecoveryUrl(url: string): { willId: number; share1: string } | null {
  try {
    const parsed = new URL(url)
    const willId = parsed.searchParams.get('willId')
    if (!willId || isNaN(Number(willId))) return null
    const fragment = parsed.hash.replace('#', '')
    const match = fragment.match(/^s1=(.+)$/)
    if (!match) return null
    return {
      willId: Number(willId),
      share1: decodeURIComponent(match[1]),
    }
  } catch {
    return null
  }
}

/**
 * Convert a hex string (with or without 0x prefix) to a base64 string.
 */
export function hexToBase64(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16)
  }
  return arrayBufferToBase64(bytes.buffer)
}

/**
 * Convert a base64 string to hex (with 0x prefix).
 */
export function base64ToHex(base64: string): string {
  const bytes = base64ToArrayBuffer(base64)
  const arr = new Uint8Array(bytes)
  return '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Utility: IPFS Gateway URL ───────────────────────────────

export function getIpfsGatewayUrl(cid: string): string {
  return `https://${cid}.ipfs.storacha.link`
}

// ─── Internal Helpers ────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
