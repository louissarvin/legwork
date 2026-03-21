# Legwork Backend

Fastify API server, autonomous AI agent (35 tools), WDK multi-chain wallets (7 chains, 11 modules), and multimodal verification pipeline.

## Quick Start

```bash
bun install && cp .env.example .env && bun run db:push && bun dev
```

## Scripts

```bash
bun dev                                    # Dev server (port 3700)
bun start                                  # Production
bun test                                   # 142 tests, 26 files
bun test src/__tests__/<file>              # Single file
bun scripts/sepolia-full-test.ts           # Full Sepolia pipeline
bun scripts/mcp-server.ts                 # WDK MCP server (21 tools)
bun run db:push                            # Push Prisma schema
```

---

## Source Layout

```
src/
+-- config/
|   +-- main-config.ts       Centralized env vars
|   +-- chains.ts            Sepolia RPC + ERC-4337 bundler/paymaster
|   +-- contracts.ts         USDT, XAU₮, Aave addresses, fee constants, multi-chain USDT
|
+-- routes/
|   +-- taskRoutes.ts        list (redacted), accept (reputation-gated, delivery>=5), assign, create (delivery+event fields)
|   +-- submissionRoutes.ts  submit: photo hash > GPS > EXIF > Vision > category check > payout > IPFS > EAS
|   +--                      Accepts reportData JSON (delivery dual GPS, event duration, check status, data count, mystery report)
|   +-- workerRoutes.ts      auth challenge, register (skills + WDK wallet), search, profile update
|   +-- clientRoutes.ts      deposit, request (category-specific fields: delivery dropoff, event duration), results
|   +-- dashboardRoutes.ts   overview, pipeline, multi-chain wallets, logs
|   +-- agentRoutes.ts       /run (admin key + 30s rate limit), activity, reasoning
|   +-- agentRoutes.ts       trigger cycle, activity, reasoning
|   +-- t402Routes.ts        paywalled endpoints with real verification (Scenario C)
|
+-- lib/
|   +-- ai/provider.ts       Anthropic primary, Groq fallback (auto on 401/429)
|   +-- agent/
|   |   +-- core.ts           35 tools, multi-turn agent loop, 5-min cron
|   |   +-- tools.ts          Tool JSON schemas
|   |   +-- executor.ts       Tool implementations -> WDK/DB
|   +-- wdk/
|   |   +-- setup.ts          7 chains from 1 seed (EVM, BTC, TON, Tron) + protocols
|   |   +-- escrow.ts         HD per-task wallets (account 0=treasury, N+1=escrow)
|   |   +-- treasury.ts       USDT + Aave USDT + ETH balance queries
|   |   +-- worker-wallet.ts  ERC-4337 gasless wallet creation
|   |   +-- lending.ts        Aave V3 supply/withdraw/position
|   |   +-- bridge.ts         USDT0 LayerZero quotes
|   |   +-- swap.ts           Velora DEX quotes
|   |   +-- pricing.ts        Bitfinex (USDT, XAU₮, BTC) + surge pricing
|   |   +-- signing.ts        Wallet auth (challenge-response)
|   |   +-- indexer.ts         WDK Indexer API
|   |   +-- secrets.ts        AES-256-GCM seed encryption
|   |   +-- monitor.ts        Read-only balance monitoring
|   |   +-- tx-logger.ts      Audit logging
|   +-- verification/
|   |   +-- pipeline.ts       5-stage: duplicate > GPS > EXIF > Vision > category check
|   |   +--                   Delivery: validates pickup + dropoff GPS
|   |   +--                   Event: validates duration >= minDurationMinutes
|   |   +-- gps.ts            Haversine geofencing (used for both single + dual GPS)
|   |   +-- exif.ts           EXIF extraction + edit detection
|   |   +-- vision.ts         AI photo analysis (optimized prompt for indoor/night)
|   +-- attestation/eas.ts   EAS on-chain attestations
|   +-- storage/ipfs.ts      Pinata IPFS upload
|   +-- t402/setup.ts        t402 payment protocol config
|   +-- prisma.ts            Database client
|
+-- utils/
|   +-- locationUtils.ts     Approximate coordinates for privacy
|   +-- photoHash.ts         SHA-256 duplicate detection
|   +-- errorHandler.ts      Centralized error responses
|
+-- workers/
|   +-- agentWorker.ts       5-min cron
|   +-- errorLogCleanup.ts   Cap at 10k

scripts/
+-- mcp-server.ts            WDK MCP server (21 tools, stdio)
+-- sepolia-full-test.ts     Full pipeline test -> DEMO_LOG.md
+-- SKILL.md                 WDK Agent Skills (OpenClaw)
```

---

## WDK Integration

### Chains (7 from single seed)

| Chain | Package | Key | Purpose | File |
|-------|---------|-----|---------|------|
| Ethereum Sepolia | `wdk-wallet-evm` | `sepolia` | Treasury + escrow | setup.ts, escrow.ts |
| Sepolia ERC-4337 | `wdk-wallet-evm-erc-4337` | `sepolia-aa` | Gasless workers | setup.ts, worker-wallet.ts |
| Ethereum Mainnet | `wdk-wallet-evm` | `ethereum` | XAU₮ gold | setup.ts |
| Arbitrum | `wdk-wallet-evm` | `arbitrum` | L2 operations | setup.ts |
| Bitcoin | `wdk-wallet-btc` | `bitcoin` | BTC reserve | setup.ts |
| TON | `wdk-wallet-ton` | `ton` | Telegram USDT | setup.ts |
| Tron | `wdk-wallet-tron` | `tron` | USDT-TRC20 | setup.ts |

### Modules (11 packages)

| Module | Package | File(s) |
|--------|---------|---------|
| Core | `@tetherto/wdk` | setup.ts, escrow.ts, treasury.ts, signing.ts |
| EVM Wallet | `@tetherto/wdk-wallet-evm` | setup.ts, escrow.ts |
| ERC-4337 | `@tetherto/wdk-wallet-evm-erc-4337` | setup.ts, worker-wallet.ts |
| Bitcoin | `@tetherto/wdk-wallet-btc` | setup.ts |
| TON | `@tetherto/wdk-wallet-ton` | setup.ts |
| Tron | `@tetherto/wdk-wallet-tron` | setup.ts |
| Aave V3 | `@tetherto/wdk-protocol-lending-aave-evm` | setup.ts, lending.ts |
| Bridge | `@tetherto/wdk-protocol-bridge-usdt0-evm` | setup.ts, bridge.ts |
| Swap | `@tetherto/wdk-protocol-swap-velora-evm` | setup.ts, swap.ts |
| Pricing | `@tetherto/wdk-pricing-bitfinex-http` | pricing.ts |
| Indexer | `@tetherto/wdk-indexer-http` | indexer.ts |
| MCP Toolkit | `@tetherto/wdk-mcp-toolkit` | scripts/mcp-server.ts |

### t402 Protocol Integration

| File | Purpose |
|------|---------|
| `lib/t402/setup.ts` | Endpoint config, pricing ($0.25/$0.10/$1.00), 402 response builder |
| `routes/t402Routes.ts` | 3 paywalled endpoints, revenue logging, real verification pipeline on /verify |
| `agent/executor.ts` | `check_api_revenue` tool scans AgentLog for t402 revenue |
| `agent/core.ts` | System prompt includes t402 revenue awareness |

---

## Tests (142 tests, 26 files)

```bash
bun test
```

| Category | Files | What |
|----------|-------|------|
| Agent tools | agent-tools, agent-full, agent-complete, agent-integration | 34 tool schemas + params |
| Worker skills | worker-skills | Skills parsing, search, direct booking, categories |
| Client + revenue | client-requests | Deposit math, budget validation, t402 revenue |
| Verification | verification, location-privacy | GPS haversine, coordinate approximation |
| Security | photo-duplicate, signing, secrets | SHA-256 hash, auth challenge, AES encryption |
| WDK | wdk-setup, wdk-orchestrator, lending, bridge, swap, pricing, indexer | Module init, fee math, quotes |
| Services | eas, ipfs, t402, mcp-server, monitor, tx-logger | Attestation, upload, payment gate |
| AI | ai-provider | Provider detection, fallback logic |
| Contracts | contracts | Fee BPS, USDT decimals, task limits |

---

## Database (8 models)

| Model | Key Fields |
|-------|-----------|
| Task | description, category, lat/lon, paymentAmount, escrowAddress, status, clientRequestId, pickupLat/Lon/Address (delivery), minDurationMinutes (event) |
| Worker | name, skills, bio, availability, locationLat/Lon, walletAddress, reputationScore |
| Submission | photoHash, gpsLat/Lon, reportData (JSON: category-specific), verificationScore, status, payoutTxHash, attestationUid |
| Client | walletAddress, balance, totalDeposited, totalSpent |
| ClientRequest | description, category, budget, tasksRequested, tasksCreated |
| AgentLog | action (think/execute/decide), details (JSON), txHash |
| Treasury | chain, balance, aaveSupplied |
| ErrorLog | errorCode, message, statusCode |

## Key Constants

```
USDT Decimals:    6          Platform Fee:     5% (500 BPS)
Min Task:         1 USDT     Max Task:         1,000 USDT
Max Payout:       500 USDT   Aave Threshold:   100 USDT
Agent Cycle:      5 min      Max Iterations:   10
Verify Pass:      >= 70      Rep Tiers:        $5/$50 thresholds
```
