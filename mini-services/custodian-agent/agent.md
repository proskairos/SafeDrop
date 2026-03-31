# SafeDrop Custodian Agent

## Overview

The Custodian Agent is a **standalone Node.js/TypeScript service** that holds encrypted share2 data off-chain, monitors the SafeDrop smart contract for timer expirations, and automatically reveals share2 on-chain when a will is released.

**Key insight:** share2 is one half of an XOR-split AES-256 key. Without the agent, the beneficiary can never reconstruct the full key — even if they have share1 from the recovery link. The agent is the trustless automated custodian.

---

## Architecture

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   Frontend    │  WS     │  Custodian Agent  │  RPC    │  Smart Contract   │
│  (Next.js)    │◄───────►│  (This Service)   │◄───────►│  (Filecoin FEVM)  │
│               │ SocketIO│                   │  viem   │                  │
└──────┬───────┘         └────────┬──────────┘         └──────────────────┘
       │                          │
       │ IPFS                     │ SQLite
       ▼                          ▼
┌──────────────┐         ┌──────────────────┐
│  Storacha /  │         │  agent.db         │
│  IPFS        │         │  (encrypted)      │
└──────────────┘         └──────────────────┘
```

### Data Flow

1. **Will Created** → Frontend encrypts message with AES-256-GCM, XOR-splits key
2. **share1** → Embedded in recovery link (URL fragment, never sent to any server)
3. **share2** → Sent to agent via WebSocket → Encrypted at rest → Stored in SQLite
4. **Empty `0x`** → Written to contract's `encryptedKey` field (agent holds the real share2)
5. **Timer expires** → Anyone calls `ownerRelease()` → `isReleased = true`
6. **Agent polls** (every 30s) → Detects `isReleased && !revealed`
7. **Agent calls `revealShare(willId, share2Hex)`** → share2 is now on-chain
8. **Beneficiary opens recovery link** → Gets share1 from URL + share2 from contract → XOR → decrypts message

### Fallback (v1)

If the agent is offline when a will is created, the frontend falls back to storing share2 directly in the contract's `encryptedKey` field (no agent involvement needed for recovery).

---

## Security

### Encryption at Rest

All share2 data in SQLite is encrypted with **AES-256-GCM**:

```
┌──────────────────────────────────────────┐
│  DB column: share2Encrypted              │
│                                          │
│  Format (base64):                        │
│  [IV 12 bytes][ciphertext][authTag 16B]  │
│                                          │
│  Master key source (priority):           │
│    1. DB_ENCRYPTION_KEY env var          │
│    2. Derived from AGENT_PRIVATE_KEY     │
│       via HKDF-SHA256 (one secret,       │
│       two independent purposes)          │
│    3. null → DEV MODE (plaintext)        │
└──────────────────────────────────────────┘
```

**Why HKDF derivation works:** Even though `AGENT_PRIVATE_KEY` is used for both signing transactions and deriving the DB encryption key, HKDF produces cryptographically independent keys. Compromising the encryption key doesn't reveal the private key, and vice versa.

### Threat Model

| Attack | Mitigation |
|--------|-----------|
| DB file stolen | Encrypted — useless without DB_ENCRYPTION_KEY |
| Server filesystem read | Same as above |
| SQL injection | Encrypted blobs — attacker can't read share2 |
| Env var + DB both stolen | You're pwned — nothing can prevent this |
| share1 intercepted from link | Useless without share2 from agent/contract |
| share2 on-chain (after reveal) | Expected — only useful with share1 + released will |

---

## Deployment (Render)

### Prerequisites

- Node.js 20+ (Render default)
- A private key with tFIL on Filecoin Calibration

### Steps

1. **Push this folder (`mini-services/custodian-agent/`) to GitHub** — either as a separate repo or a monorepo subdirectory

2. **Create a new Web Service on Render:**
   - Connect your GitHub repo
   - Root directory: `mini-services/custodian-agent`
   - Build command: `npx prisma generate`
   - Start command: `npx tsx index.ts`
   - Instance type: Free (fine for demo) or Starter ($7/mo for reliability)

3. **Set environment variables** (in Render dashboard):
   ```
   PORT=10000                    # Render assigns a port, but this is ignored
   AGENT_PRIVATE_KEY=0x...       # Your calibration wallet private key
   DB_ENCRYPTION_KEY=<generated> # 64 hex chars from: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   CONTRACT_ADDRESS=0x06f14713198eA009fC98246164159e41C7Ec3A0B
   SOCKET_PATH=/socket.io        # Default, correct for Render
   ```

4. **Health check** — Render will use `GET /health` to monitor:
   ```json
   { "status": "ok", "uptime": 1234, "encryption": "enabled", "mode": "auto-reveal" }
   ```

### Important Notes

- **SQLite on Render** — The database file lives in the container's filesystem. On Render Free tier, the container resets on each deploy, **wiping the DB**. For persistence:
  - Use a Render persistent disk ($0.25/GB/month)
  - Or upgrade to PostgreSQL (change `prisma/schema.prisma` datasource)
- **Port** — Render assigns a dynamic port via `$PORT` env var. The agent reads this automatically.

---

## Frontend Integration

The frontend connects to the agent via one environment variable:

```env
# In the Next.js project root .env
NEXT_PUBLIC_AGENT_URL=https://your-agent-service.onrender.com
```

- **Set** → Direct WebSocket connection to deployed agent
- **Unset/empty** → Sandbox mode (routes through Caddy proxy via `XTransformPort=3003`)

The Socket.IO client (`src/lib/agent-client.ts`) handles both modes transparently.

---

## Local Development

```bash
# Terminal 1 — Next.js frontend
cd my-project && bun run dev

# Terminal 2 — Custodian agent
cd mini-services/custodian-agent
cp .env.example .env    # then fill in (or leave empty for dev mode)
npx prisma db push      # create SQLite database
npx tsx index.ts        # start agent
```

### Dev Mode (no keys)

If neither `DB_ENCRYPTION_KEY` nor `AGENT_PRIVATE_KEY` is set:
- share2 stored as plaintext (with warning on startup)
- Agent runs in monitor-only mode (tracks wills but can't reveal)
- Useful for testing the frontend integration without blockchain setup

---

## API Reference

### WebSocket Events (Socket.IO)

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `register-share2` | `{ willId, share2Hex, ownerAddress?, cid? }` | Register share2 for a will |
| `get-status` | — | Request full status of all monitored wills |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `agent-info` | `{ status, agentAddress, canReveal, encryptionEnabled, ... }` | Agent capabilities (sent on connect) |
| `share2-registered` | `{ success, willId, monitoredWillCount, timestamp }` | Confirmation of share2 registration |
| `release-detected` | `{ willId, detectedAt, owner, beneficiary }` | A monitored will's timer has expired |
| `share-revealed` | `{ willId, txHash, revealedAt, totalRevealed }` | Agent successfully revealed share2 on-chain |
| `reveal-failed` | `{ willId, reason }` | Agent failed to reveal (no wallet, reverted tx, etc.) |
| `poll-summary` | `{ monitored, unrevealed, totalRevealed, lastPollTime }` | Summary after each poll cycle (every 30s) |
| `status` | `{ monitoredWillCount, totalRevealed, wills[], ... }` | Full status response |

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (returns JSON with uptime, mode, encryption status) |

---

## File Structure

```
mini-services/custodian-agent/
├── index.ts           # Main server: Socket.IO, polling, auto-reveal
├── crypto.ts          # AES-256-GCM encrypt/decrypt at rest + HKDF key derivation
├── package.json       # Dependencies: socket.io, viem, prisma
├── .env.example       # Template for environment variables
├── agent.md           # This documentation
├── prisma/
│   ├── schema.prisma  # WillShare model (encrypted share2 storage)
│   └── agent.db       # SQLite database (created on first push)
└── node_modules/      # Installed dependencies
```

---

## Future Enhancements

- **LLM/AI agent integration** — Natural language will management
- **Auto-FIL feeding** — Agent tops up wallets running low on gas
- **Multi-chain support** — Monitor wills across multiple EVM chains
- **PostgreSQL** — Replace SQLite for horizontal scaling
- **Rate limiting** — Throttle share2 registration per wallet
- **Webhook notifications** — Alert owner when release is approaching
