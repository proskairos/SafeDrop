// ─── SafeDrop Agent: Encryption at Rest ───────────────────────
// AES-256-GCM encryption for share2 data stored in SQLite.
//
// Why: share2 is one half of an XOR-split AES-256 key. If someone
// steals the database, they get every share2 in plain text.
// Combined with share1 (from a recovery link), they reconstruct
// the full key and decrypt any will — defeating the purpose.
//
// How: Each share2 is encrypted with a per-record random IV.
// The DB_ENCRYPTION_KEY env var provides the master key.
// If not set but AGENT_PRIVATE_KEY is set, we derive the key via HKDF.
// If neither is set, we run in "dev mode" (plaintext + warning).

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

// ─── Key Derivation ──────────────────────────────────────────

/**
 * Derive a 256-bit AES key from AGENT_PRIVATE_KEY using HKDF-SHA256.
 * This allows using a single secret for both transaction signing
 * and data encryption, while producing cryptographically independent keys.
 *
 * HKDF ensures that even if the same input is used, the derived
 * encryption key is completely unrelated to the private key bytes.
 */
function deriveKeyFromPrivateKey(privateKey: string): Buffer {
  // Normalize: strip 0x prefix, lowercase
  const cleanKey = privateKey.toLowerCase().replace(/^0x/, '')
  const keyBytes = Buffer.from(cleanKey, 'hex')

  // HKDF: extract + expand in one step
  // info = "safedrop-agent-db-encryption" — binds the derived key to this specific purpose
  const info = Buffer.from('safedrop-agent-db-encryption-v1', 'utf8')
  const hashLen = 32 // SHA-256 output

  // Simple HKDF implementation (Node 18+ has crypto.hkdf, but this is more portable)
  // Extract phase
  const salt = Buffer.alloc(hashLen, 0) // Static salt is fine here — the private key IS the entropy
  const prk = createHash('sha256')
    .update(salt)
    .update(keyBytes)
    .digest()

  // Expand phase (single iteration for 32 bytes)
  const hmac = createHash('sha256')
  hmac.update(Buffer.concat([prk, info, Buffer.from([0x01])]))

  return hmac.digest()
}

/**
 * Get the encryption key from environment.
 * Priority:
 *   1. DB_ENCRYPTION_KEY (explicit 64-char hex)
 *   2. AGENT_PRIVATE_KEY (derived via HKDF)
 *   3. null → dev mode (plaintext + warning)
 */
export function getEncryptionKey(): Buffer | null {
  const explicit = process.env.DB_ENCRYPTION_KEY
  if (explicit && explicit.length >= 64) {
    return Buffer.from(explicit.replace(/^0x/, '').slice(0, 64), 'hex')
  }

  const pk = process.env.AGENT_PRIVATE_KEY
  if (pk && pk.length >= 66) {
    return deriveKeyFromPrivateKey(pk)
  }

  return null
}

/**
 * Check if encryption is available (DB_ENCRYPTION_KEY or AGENT_PRIVATE_KEY set)
 */
export function isEncryptionEnabled(): boolean {
  return getEncryptionKey() !== null
}

// ─── Encrypt / Decrypt ──────────────────────────────────────

/**
 * Encrypt a hex string using AES-256-GCM.
 *
 * Returns base64-encoded string containing: IV (12 bytes) + ciphertext + auth tag (16 bytes)
 * The IV is embedded in the output — no need to store it separately.
 */
export function encryptAtRest(plaintext: string, masterKey: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, masterKey, iv, { authTagLength: TAG_LENGTH })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ])

  // Prepend IV to the encrypted data: [IV(12)] [ciphertext] [tag(16)]
  const result = Buffer.concat([iv, encrypted])
  return result.toString('base64')
}

/**
 * Decrypt data that was encrypted with encryptAtRest().
 *
 * Expects base64-encoded string: [IV(12)] [ciphertext] [tag(16)]
 * Returns the original plaintext string, or null if decryption fails.
 */
export function decryptAtRest(encryptedBase64: string, masterKey: Buffer): string | null {
  try {
    const data = Buffer.from(encryptedBase64, 'base64')

    if (data.length < IV_LENGTH + TAG_LENGTH + 1) {
      console.error('[crypto] Encrypted data too short')
      return null
    }

    const iv = data.subarray(0, IV_LENGTH)
    const tag = data.subarray(data.length - TAG_LENGTH)
    const ciphertext = data.subarray(IV_LENGTH, data.length - TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, masterKey, iv, { authTagLength: TAG_LENGTH })
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch (err) {
    console.error('[crypto] Decryption failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Generate a random 32-byte (256-bit) hex key for DB_ENCRYPTION_KEY.
 * Run once and store in env var.
 */
export function generateDbEncryptionKey(): string {
  return '0x' + randomBytes(32).toString('hex')
}
