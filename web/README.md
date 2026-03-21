# Legwork Frontend

Terminal-aesthetic React app for the Legwork reverse gig economy platform. Workers browse tasks, set skills, submit proof, and get paid. Clients fund task requests. Operators monitor the AI agent via a command center.

## Quick Start

```bash
bun install && cp .env.example .env && bun dev    # port 3200
```

---

## Pages (9 routes)

| Route | Page | Key Features |
|-------|------|-------------|
| `/` | Landing | Hero, live stats, protocol steps, task feed |
| `/browse` | Task board | Category filters, search, location-redacted cards |
| `/browse/$taskId` | Task detail | Photo upload, GPS capture, verification pipeline, Etherscan links |
| `/worker` | Worker portal | Register (WDK wallet), skill selector, my tasks, earnings |
| `/client` | Client portal | Deposit USDT, request tasks, track progress |
| `/dashboard` | Command center | Agent trigger, reasoning panel, multi-chain wallets, XAU₮, treasury, t402 revenue, pipeline |
| `/workers` | Worker registry | List with reputation scores |
| `/workers/$workerId` | Worker profile | Submission breakdown, task history, tx hashes |

---

## Architecture

```
src/
+-- routes/                    File-based (TanStack Router)
|   +-- __root.tsx             Navbar, StatusBar, WalletProvider, favicon
|   +-- index.tsx              Landing (stats from API, task feed, empty state)
|   +-- browse/index.tsx       Task board (search, category filter, location privacy)
|   +-- browse/$taskId.tsx     Task detail (photo upload, GPS, wallet-based worker ID)
|   +-- worker.tsx             Worker portal (register, skills panel, my tasks)
|   +-- client.tsx             Client portal (deposit, request, track)
|   +-- dashboard.tsx          Command center (agent cycle trigger, reasoning,
|   |                            multi-chain wallets, XAU₮, Aave, t402 revenue, pipeline)
|   +-- workers/index.tsx      Worker registry
|   +-- workers/$workerId.tsx  Worker profile (real submission data, Etherscan links)
|
+-- components/
|   +-- Navbar.tsx             Legwork SVG logo, /slash_path nav, wallet connect
|   +-- StatusBar.tsx          Bottom bar: uptime, escrow total, version
|   +-- Footer.tsx             Legwork logo, version badge
|   +-- elements/
|       +-- Badge.tsx          Status badges
|       +-- BracketButton.tsx  [ BRACKET_SYNTAX ] CTAs
|       +-- Card.tsx           Dark card with glow
|       +-- StatCard.tsx       Neon stat display
|       +-- ExplorerLink.tsx   Clickable Etherscan/EASscan links
|
+-- providers/
|   +-- WalletProvider.tsx     RainbowKit + wagmi (Sepolia)
|
+-- lib/
|   +-- api.ts                 Typed client: 29 endpoints, Worker (skills/availability), Client, Task, etc.
|   +-- wallet.ts              wagmi config
|
+-- utils/
|   +-- usdt.ts                formatUsdt, shortenAddress, timeLeft, timeAgo
|   +-- style.ts               cnm() (clsx + tailwind-merge)
```

---

## Key Frontend Features

- **HEIC-to-JPEG auto-conversion** via heic2any (iPhone photos work natively)
- **6 category-specific submission forms** (delivery: dual GPS, event: check-in/duration, data: count, mystery: report, check: status)
- **Admin-protected agent trigger** (sends x-admin-key header from env)
- **Category-specific client request hints** with validation descriptions and contextual placeholders
- **Delivery tasks show "TRUSTED_ONLY: Reputation >= 5 required"** warning on browse cards

## Worker Journey

```
Connect wallet (/worker)
    |
Register -> WDK creates ERC-4337 gasless wallet
    |
Set skills (photo, delivery, check, data, mystery, event)
    |
Browse tasks (/browse) -> approximate location shown
    |
Click task -> /browse/$taskId
    |
Submit proof: upload photo (HEIC auto-converted) + GPS auto-captured
    |
Category-specific fields shown:
  DELIVERY: [ CONFIRM_PICKUP_GPS ] + delivery notes
  CHECK: open/closed/limited status
  DATA: count + notes
  MYSTERY: experience report
  EVENT: [ CHECK_IN_AT_EVENT ] + crowd level + duration tracking
    |
Pipeline: UPLOAD > VERIFY_GPS > AI_ANALYSIS > CATEGORY_CHECK > SCORING
    |
Score >= 70: payout (Etherscan link) + IPFS + EAS
Score < 70: rejected, escrow safe
    |
View earnings on /worker -> ACTIVE_MISSIONS + COMPLETED_MISSIONS
```

## Client Journey

```
Connect wallet (/client)
    |
Deposit USDT (quick amounts: $10, $50, $100, $500)
    |
Request tasks: description, category, budget, count
    |
Agent fulfills in next cycle -> creates individual tasks with escrow
    |
Track progress: request cards with completion bars
```

## Dashboard Features

```
Command Center (/dashboard)
    |
+-- Stats: treasury, open tasks, completed, workers, API revenue, escrow
+-- [ RUN_AGENT_CYCLE ] button (triggers agent live)
+-- Agent activity log (color-coded, Etherscan links)
+-- Agent reasoning panel (latest thinking)
+-- Multi-chain wallets (7 chains, all addresses)
+-- Treasury: USDT available, in escrow, Aave yield, XAU₮ gold reserve
+-- t402 API revenue breakdown per endpoint
+-- Task pipeline kanban (OPEN > ACCEPTED > SUBMITTED > VERIFIED > PAID)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (React 19, SSR) |
| Build | Vite 7 + Nitro |
| Routing | TanStack Router (file-based) |
| State | TanStack Query v5 |
| Wallet | RainbowKit + wagmi + viem (Sepolia) |
| Styling | Tailwind CSS 4 + HeroUI |
| Animations | motion (Framer Motion) |
