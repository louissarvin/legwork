# Legwork

**The reverse gig economy protocol.** AI agents post tasks, lock USDT in escrow, verify completion with multimodal AI vision, and release gasless payments to workers in seconds.

Built on [Tether WDK](https://wdk.tether.io/) for the Galactica Hackathon on DoraHacks.

```
root@legwork:~/protocol# ./init_reverse_gig
```

---

## What It Does

1. An **autonomous AI agent** (35 tools, Claude/Groq) decides it needs a physical task done
2. The agent **locks USDT in on-chain escrow** before publishing the task
3. A human worker **accepts and completes** the task (photo, delivery, location check)
4. **Multimodal AI verifies** the proof (GPS geofencing + EXIF validation + Vision AI)
5. **Gasless instant payment** releases USDT via ERC-4337 (worker never needs ETH)
6. **On-chain attestation** (EAS) + **IPFS photo storage** create permanent proof

5% platform fee. Instant payouts. 7 chains. XAU₮ gold reserve.

---

## Architecture

```
+---------------------------------------------------------------------+
|                          Legwork System                              |
+---------------------------------------------------------------------+
|                                                                      |
|  +------------------+    +-------------------+    +----------------+ |
|  |   AI AGENT       |    |   TASK ENGINE     |    |   WORKER APP   | |
|  |   (Claude/Groq)  |--->|                   |<---|   (React)      | |
|  |                   |    |  - Post tasks     |    |                | |
|  |  35 tools         |    |  - Match workers  |    |  - Browse      | |
|  |  Multi-turn       |    |  - Direct booking |    |  - Accept      | |
|  |  5-min cron       |    |  - Handle escrow  |    |  - Submit      | |
|  +------------------+    +-------------------+    +----------------+ |
|          |                       |                       |           |
|          v                       v                       v           |
|  +------------------+    +-------------------+    +----------------+ |
|  |  WDK TREASURY    |    |  VERIFICATION     |    |  WORKER        | |
|  |  7 chains         |    |  LAYER            |    |  WDK WALLET    | |
|  |                   |    |                   |    |                | |
|  |  - USDT + XAU₮    |    |  - GPS geofence   |    |  - Gasless     | |
|  |  - Aave yield     |    |  - EXIF validate  |    |  - ERC-4337    | |
|  |  - Bridge/swap    |    |  - Vision AI      |    |  - Skills      | |
|  |  - BTC/TON/Tron   |    |  - EAS + IPFS     |    |  - Reputation  | |
|  +------------------+    +-------------------+    +----------------+ |
|                                                                      |
+---------------------------------------------------------------------+
```

### Task Flow

```
Agent Posts Task          Worker Completes          AI Verifies            Settlement
      |                        |                        |                      |
  [1] Agent decides       [3] Worker accepts       [5] GPS check          [7] Escrow releases
      task is needed           (skills matched)         (haversine)            USDT to worker
      |                        |                        |                      |
  [2] USDT locked in     [4] Worker submits        [6] EXIF + Vision      [8] EAS attestation
      HD escrow wallet         photo + GPS              scores 0-100           + IPFS photo
```

### Verification Pipeline

```
Worker Submission { photo (HEIC auto-converted to JPEG), gpsLat, gpsLon, reportData }
         |
    +----v-----------+
    | Duplicate Check |  SHA-256 hash vs all previous submissions
    | (photoHash.ts)  |  Reject if same photo reused
    +----+-----------+
         |
    +----v-----------+
    | GPS Geofence   |  Haversine distance check
    | (gps.ts)       |  Pass if within task radius
    +----+-----------+  Delivery: checks BOTH pickup GPS and dropoff GPS
         |
    +----v-----------+
    | EXIF Extraction|  Timestamp, GPS metadata
    | (exif.ts)      |  Editing detection (Photoshop, GIMP)
    +----+-----------+
         |
    +----v-----------+
    | AI Vision      |  Claude/Groq Llama 4 Scout
    | (vision.ts)    |  Confidence 0-1, fraud detection
    +----+-----------+  Optimized prompt for indoor/outdoor/nighttime photos
         |
    +----v-----------+
    | Category Check |  Delivery: pickup GPS validated (-15 if fail)
    | (pipeline.ts)  |  Event: duration >= minDurationMinutes (-10 if fail)
    +----+-----------+
         |
    +----v-----------+
    | Score Combine  |  GPS: +30, Vision: +50, No editing: +10
    | (pipeline.ts)  |  GPS metadata: +10. Threshold: >= 70
    +----------------+
         |
    Pass: payout + IPFS upload + EAS attestation
    Fail: reject, escrow returned
```

### Task Categories

| Category | Validation Method | Extra Fields |
|----------|------------------|-------------|
| PHOTO | Photo + GPS + AI Vision | None |
| DELIVERY | Dual GPS (pickup + dropoff) + photo + AI | Pickup confirmed, delivery notes |
| CHECK | Photo + GPS + status report | Open/closed/limited/unknown |
| DATA | Photo + GPS + numeric count | Count value, data notes |
| MYSTERY | Photo + GPS + experience report | Written customer experience |
| EVENT | GPS check-in/check-out + duration | Crowd level, event notes, duration |

Delivery tasks require worker reputation >= 5 (trusted workers only).
HEIC photos are auto-converted to JPEG on the client side.

### WDK Multi-Chain Integration

```
Single WDK Seed (BIP-39)
     |
     +--- Ethereum Sepolia     wdk-wallet-evm              Treasury + escrow
     +--- Sepolia ERC-4337     wdk-wallet-evm-erc-4337     Gasless worker wallets
     +--- Ethereum Mainnet     wdk-wallet-evm              XAU₮ gold reserve
     +--- Arbitrum One         wdk-wallet-evm              L2 low-gas operations
     +--- Bitcoin              wdk-wallet-btc              BTC reserve
     +--- TON                  wdk-wallet-ton              Telegram USDT
     +--- Tron                 wdk-wallet-tron             USDT-TRC20

Protocols:
     +--- wdk-protocol-lending-aave-evm     Aave V3 yield on idle treasury
     +--- wdk-protocol-bridge-usdt0-evm     USDT0 cross-chain via LayerZero
     +--- wdk-protocol-swap-velora-evm      DEX swaps via Velora

Services:
     +--- wdk-pricing-bitfinex-http         Prices (USDT, XAU₮, BTC, ETH)
     +--- wdk-indexer-http                  Transaction monitoring
     +--- wdk-mcp-toolkit                   MCP server (21 tools for external agents)

Integration:
     +--- .skills/wdk/SKILL.md             OpenClaw agent skills
     +--- scripts/mcp-server.ts            Stdio MCP server
```

### Revenue Flow

```
Scenario A: Autonomous
  Pre-fund treasury > Agent posts tasks > Workers paid > 5% fee recirculates

Scenario B: Client-Funded (production revenue)
  Business deposits USDT > POST /clients/deposit
       |
  Requests tasks > POST /clients/request
       |
  Agent fulfills > list_client_requests + fulfill_client_request tools
       |
  Workers complete > Verification pipeline
       |
  Payout: 95% to worker, 5% to treasury (profit)

Scenario C: Agent-to-Agent (t402 protocol)
  External AI agent > POST /t402/verify ($0.25)
       |              GET /t402/reputation ($0.10)
       |              GET /t402/analytics ($1.00)
       v
  402 Payment Required > Agent signs USDT0 > Retry with payment
       |
  Revenue accumulates in treasury
```

### Security Layers

```
Layer 1: Location Privacy          utils/locationUtils.ts
  Public: approximate coords (~1km). Exact GPS revealed only after acceptance.

Layer 2: Wallet Auth               wdk/signing.ts
  Challenge-response signature verification. Proves wallet ownership.

Layer 3: Reputation Gating         routes/taskRoutes.ts
  $0-5: anyone. $5-50: rep >= 0.5. $50+: rep >= 2. Delivery: rep >= 5.

Layer 4: Duplicate Detection       utils/photoHash.ts
  SHA-256 hash of photo bytes. Checked before verification runs.

Layer 5: AI Verification           verification/pipeline.ts
  GPS geofence + EXIF + Vision AI + category-specific (dual GPS, duration).

Layer 6: Admin Protection          routes/agentRoutes.ts
  /agent/run requires AGENT_ADMIN_KEY header. 30s rate limit between triggers.
```

---

## Monorepo Structure

| Directory | Stack | Port |
|-----------|-------|------|
| `backend/` | Bun + Fastify + Prisma + WDK + Claude/Groq | 3700 |
| `web/` | Bun + Vite 7 + React 19 + TanStack + RainbowKit | 3200 |

---

## Quick Start

```bash
# Backend
cd backend && bun install && cp .env.example .env
# Fill in DATABASE_URL, WDK_SEED, GROQ_API_KEY
bun run db:push && bun dev

# Frontend
cd web && bun install && cp .env.example .env
bun dev
```

### Run Tests

```bash
cd backend && bun test              # 142 tests, 26 files
cd web && bun test                   # Vitest
bun scripts/sepolia-full-test.ts    # Full Sepolia pipeline test
```

---

## API Endpoints (29)

| Method | Endpoint | Description | Linked WDK/t402 |
|--------|----------|-------------|-----------------|
| GET | `/tasks/list` | Open tasks (location-redacted) | |
| GET | `/tasks/:id` | Task detail (exact GPS if assigned) | |
| POST | `/tasks/create` | Create task + lock escrow | `wdk-wallet-evm` (escrow.ts) |
| POST | `/tasks/:id/accept` | Accept task (reputation-gated) | |
| POST | `/tasks/:id/assign` | Direct booking (skill-matched) | |
| GET | `/tasks/treasury/info` | Treasury balance | `wdk-wallet-evm` (treasury.ts) |
| POST | `/submissions/:taskId/submit` | Submit proof (photo + GPS) | `wdk-wallet-evm` (escrow.ts), IPFS, EAS |
| POST | `/workers/auth/challenge` | Wallet signature challenge | `wdk/signing.ts` |
| POST | `/workers/register` | Register with skills + WDK wallet | `wdk-wallet-evm-erc-4337` (worker-wallet.ts) |
| GET | `/workers/search` | Search by skill/availability | |
| PUT | `/workers/profile` | Update skills/bio/availability | |
| GET | `/workers/wallet/:address` | Lookup by wallet | |
| GET | `/workers/:id` | Worker profile | |
| GET | `/workers/list` | All workers | |
| POST | `/clients/register` | Register business client | |
| POST | `/clients/deposit` | Deposit USDT | |
| POST | `/clients/request` | Request tasks with budget | |
| GET | `/clients/:walletAddress` | Client profile | |
| GET | `/clients/request/:id/results` | Task results | |
| GET | `/dashboard/overview` | Stats + treasury + pipeline | `wdk-wallet-evm` (treasury.ts) |
| GET | `/dashboard/pipeline` | Tasks by status | |
| GET | `/dashboard/wallets` | Multi-chain addresses (7) | All `wdk-wallet-*` packages |
| GET | `/dashboard/logs` | Agent activity | |
| POST | `/agent/run` | Trigger agent cycle | AI provider (provider.ts) |
| GET | `/agent/activity` | Agent decisions | |
| GET | `/t402/endpoints` | Paywalled API pricing | `t402/setup.ts` |
| POST | `/t402/verify` | Verification ($0.25) | `t402/setup.ts`, `verification/pipeline.ts` |
| GET | `/t402/reputation/:address` | Reputation ($0.10) | `t402/setup.ts` |
| GET | `/t402/analytics` | Analytics ($1.00) | `t402/setup.ts` |

---

## Agent Tools (35)

**Core (12):** `check_treasury_balance`, `check_eth_balance`, `get_treasury_address`, `list_open_tasks`, `list_pending_submissions`, `list_expired_tasks`, `create_task`, `verify_submission`, `approve_and_pay`, `reject_submission`, `refund_expired_task`, `get_platform_stats`

**DeFi (6):** `check_aave_position`, `supply_to_aave`, `withdraw_from_aave`, `get_current_price`, `calculate_task_price`, `quote_bridge`

**Monitoring (6):** `check_transfer_history`, `verify_payment_landed`, `quote_swap`, `quote_escrow_fee`, `check_worker_balance`, `monitor_escrow_balances`

**Attestation (2):** `create_attestation`, `get_transaction_log`

**Client + Revenue (3):** `list_client_requests`, `fulfill_client_request`, `check_api_revenue`

**Multi-Chain + XAU₮ (3):** `list_treasury_wallets`, `check_xaut_balance`, `get_xaut_price`

**Worker Search + Booking (2):** `search_workers`, `assign_worker_to_task`

**Recovery (1):** `retry_stuck_payouts`

---

## On-Chain Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| WDK USDT | `0xd077a400968890eacc75cdc901f0356c943e4fdb` |
| Aave V3 Pool | `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951` |
| EAS | `0xC2679fBD37d54388Ce493F1DB75320D236e1815e` |
| ERC-4337 EntryPoint | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| XAU₮ (Mainnet) | `0x68749665FF8D2d112Fa859AA293F07a622782F38` |

---

## Key Production Features

- **On-chain USDT deposit** via MetaMask (real ERC-20 transfer to treasury)
- **Auto-geocoding** of addresses to GPS coordinates via OpenStreetMap Nominatim
- **Auto-fund escrow** wallets with ETH for gas during task creation
- **Retry stuck payouts** agent tool recovers failed escrow releases automatically
- **HEIC-to-JPEG** auto-conversion for iPhone photos
- **OpenStreetMap** embed replacing placeholder map on task detail page
- **Admin API key + rate limiting** on agent trigger endpoint

## Third-Party Services Disclosure

- **Tether WDK** (11 npm packages) for wallet infrastructure
- **Anthropic Claude / Groq Llama 4 Scout** for agent reasoning + photo verification
- **Pinata** for IPFS photo storage
- **Pimlico** bundler/paymaster for ERC-4337
- **Bitfinex** pricing via WDK
- **EAS** for on-chain attestations
- **OpenStreetMap Nominatim** for address geocoding

## License

Apache 2.0. Built for the Galactica x Tether WDK Hackathon 2026.
