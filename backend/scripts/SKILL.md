---
name: legwork-wdk
description: Legwork WDK wallet management skills for autonomous task hiring and payment
version: 1.0.0
---

# Legwork WDK Skills

This agent manages a reverse gig economy platform using Tether WDK on Ethereum Sepolia.

## Capabilities

### Wallet Management
- Create and manage wallets on Ethereum Sepolia via `@tetherto/wdk-wallet-evm`
- Create gasless Smart Account wallets for workers via `@tetherto/wdk-wallet-evm-erc-4337`
- Encrypted seed storage via `@tetherto/wdk-secret-manager`

### Escrow System
- HD-derived escrow addresses (account 0 = treasury, account N = task escrow)
- Lock USDT in per-task escrow before task goes live
- Release escrow with 5% platform fee split on verification
- Refund escrow on expired tasks

### DeFi Operations
- Supply idle USDT to Aave V3 for yield via `@tetherto/wdk-protocol-lending-aave-evm`
- Real-time price feeds from Bitfinex via `@tetherto/wdk-pricing-bitfinex-http`
- Cross-chain USDT0 bridging quotes via `@tetherto/wdk-protocol-bridge-usdt0-evm`

### Verification Pipeline
- GPS geofencing (Haversine distance check)
- EXIF metadata extraction and validation
- Multimodal AI photo verification (Claude Vision)

### Security Rules
- Always check treasury balance before creating tasks
- Never transfer more than 500 USDT in a single payout
- Always estimate fees before executing transactions
- Encrypt worker seed phrases before storage
- Dispose WDK instances after use to clear keys from memory
