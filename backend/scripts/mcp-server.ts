#!/usr/bin/env node
/**
 * Legwork WDK MCP Server
 *
 * Exposes all WDK wallet operations as MCP tools for external AI agents.
 * Uses @tetherto/wdk-mcp-toolkit with stdio transport.
 *
 * Run:   bun scripts/mcp-server.ts
 * Claude Code: claude mcp add legwork -- bun scripts/mcp-server.ts
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  WdkMcpServer,
  WALLET_TOOLS,
  PRICING_TOOLS,
  LENDING_TOOLS,
  INDEXER_TOOLS,
} from '@tetherto/wdk-mcp-toolkit'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm'

async function main() {
  const seed = process.env.WDK_SEED
  if (!seed) {
    console.error('WDK_SEED environment variable is required')
    process.exit(1)
  }

  const server = new WdkMcpServer('legwork-wdk', '1.0.0')
    .useWdk({ seed })
    // Sepolia EVM wallet (treasury + escrow accounts)
    .registerWallet('ethereum', WalletManagerEvm, {
      provider: 'https://ethereum-sepolia-rpc.publicnode.com',
    })
    // Aave V3 lending protocol
    .registerProtocol('ethereum', 'aave', AaveProtocolEvm)
    // Bitfinex pricing feeds
    .usePricing()

  // Register WDK test USDT on Sepolia
  server.registerToken('ethereum', 'USDT', {
    address: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
    decimals: 6,
  })

  // Aave test USDT on Sepolia
  server.registerToken('ethereum', 'aUSDT', {
    address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
    decimals: 6,
  })

  // Indexer (optional, requires API key)
  if (process.env.WDK_INDEXER_API_KEY) {
    server.useIndexer({ apiKey: process.env.WDK_INDEXER_API_KEY })
  }

  // Register all tool categories
  const tools = [
    ...WALLET_TOOLS,     // getAddress, getBalance, getTokenBalance, transfer, sign
    ...PRICING_TOOLS,    // getCurrentPrice, getHistoricalPrice
    ...LENDING_TOOLS,    // supply, withdraw, borrow, repay + quotes
  ]

  if (process.env.WDK_INDEXER_API_KEY) {
    tools.push(...INDEXER_TOOLS)
  }

  server.registerTools(tools)

  // Start stdio transport (for Claude Code, Cursor, VS Code Copilot)
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('[MCP] Legwork WDK MCP Server running on stdio')
  console.error('[MCP] Chains:', server.getChains())
  console.error('[MCP] Lending:', server.getLendingChains())
  console.error('[MCP] Tools registered:', tools.length)
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error)
  process.exit(1)
})
