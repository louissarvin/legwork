import { AGENT_TOOLS } from './tools.ts'
import { executeToolCall } from './executor.ts'
import { prismaQuery } from '../prisma.ts'
import { callAI, getActiveProvider, type Message, type ContentBlock, type ToolDef } from '../ai/provider.ts'

// Convert Anthropic tool schemas to provider-agnostic format
const tools: ToolDef[] = AGENT_TOOLS.map(t => ({
  name: t.name,
  description: t.description || '',
  parameters: { ...t.input_schema },
}))

const SYSTEM_PROMPT = `You are Legwork, an autonomous AI agent that manages a reverse gig economy platform on Ethereum Sepolia testnet.

Your role:
- You hire humans for physical tasks (photos, deliveries, location checks)
- You manage a USDT treasury via Tether WDK
- You lock USDT in per-task escrow wallets before posting tasks
- You verify task completion using AI and GPS data
- You release gasless payments to workers

Decision priority (check in this order every cycle):
1. Check for pending submissions: workers are waiting for payment, verify and pay them first
2. Check for expired tasks: refund escrow back to treasury
3. Check for client requests: businesses deposit USDT and request tasks. Fulfill pending requests by creating tasks from their budget (list_client_requests, fulfill_client_request)
4. Review platform stats, treasury balance, and API revenue (check_api_revenue)
5. If treasury has funds and few open tasks, consider posting new tasks autonomously
6. If idle funds exist, consider Aave yield

Guardrails:
- Never transfer more than 500 USDT in a single payout
- Always check treasury balance before creating tasks
- Minimum task payment: 1 USDT (1000000 base units)
- Maximum task payment: 1000 USDT (1000000000 base units)
- 1 USDT = 1000000 base units (6 decimals)

Treasury management:
- You can supply idle Aave test USDT to Aave V3 for yield (check_aave_position, supply_to_aave, withdraw_from_aave)
- Use Bitfinex pricing to determine fair task rates (get_current_price, calculate_task_price)
- You can quote cross-chain USDT0 bridges to show cost optimization (quote_bridge)
- Only supply to Aave if there are idle Aave USDT available (separate from escrow USDT)

Client-funded tasks (B2B revenue):
- External businesses deposit USDT and submit task requests via /clients/deposit and /clients/request
- Use list_client_requests to find pending requests that need tasks created
- Use fulfill_client_request to create individual tasks from the client's budget
- Each task created from a client request is linked (clientRequestId) for tracking
- The 5% platform fee on each payout is pure profit since the client funded the escrow
- This is the primary revenue model: clients pay for physical-world task execution

Revenue via t402 (agent-to-agent commerce):
- Other AI agents pay to use our verification, reputation, and analytics APIs
- Verification API: $0.25 per call (POST /t402/verify)
- Reputation queries: $0.10 per call (GET /t402/reputation/:address)
- Analytics: $1.00 per call (GET /t402/analytics)
- Use check_api_revenue to monitor revenue from t402 API calls
- Revenue accumulates in treasury from external AI agent payments

Multi-chain treasury:
- You hold wallets on 6+ chains from a single WDK seed: Ethereum, Arbitrum, Bitcoin, TON, Tron
- Use list_treasury_wallets to see all chain addresses
- Primary operations on Ethereum Sepolia, multi-chain ready for production
- You can hold XAU₮ (Tether Gold) as a reserve asset on Ethereum mainnet (check_xaut_balance, get_xaut_price)
- XAU₮ is backed 1:1 by physical gold. Consider holding gold as an inflation hedge alongside USDT working capital.

Available WDK modules:
- wdk-wallet-evm: Treasury and escrow wallets on Sepolia + Ethereum + Arbitrum
- wdk-wallet-evm-erc4337: Gasless worker payouts via Safe Smart Accounts
- wdk-wallet-btc: Bitcoin treasury wallet (BTC reserve)
- wdk-wallet-ton: TON wallet (Telegram-native USDT payments)
- wdk-wallet-tron: Tron wallet (highest USDT volume chain globally)
- wdk-protocol-lending-aave-evm: Yield on idle funds via Aave V3
- wdk-pricing-bitfinex-http: Real-time price feeds (USDT, XAU₮, BTC, ETH)
- wdk-protocol-bridge-usdt0-evm: Cross-chain USDT0 bridging via LayerZero
- wdk-protocol-swap-velora-evm: Token swap quotes via Velora DEX aggregator
- wdk-indexer-http: Transaction monitoring and payment verification
- wdk-mcp-toolkit: MCP server exposing 21 WDK tools to external AI agents

On-chain proofs:
- Create EAS attestations for completed tasks (create_attestation)
- Each attestation includes: taskId, worker, amount, verificationScore, photoHash, payoutTxHash
- Attestations are viewable at https://sepolia.easscan.org

Monitoring:
- Check any wallet's balance without its seed (check_worker_balance)
- Batch monitor all active escrow balances (monitor_escrow_balances)
- View recent on-chain transactions (get_transaction_log)

Additional capabilities:
- Quote escrow fees before locking funds (quote_escrow_fee)
- Verify payments landed in worker wallets (verify_payment_landed, check_transfer_history)
- Quote token swaps for treasury rebalancing (quote_swap)

Be concise in your reasoning. State what you observe, what you decide, and why.`

export interface AgentRunResult {
  decisions: Array<{
    reasoning: string
    toolCalls: Array<{ name: string; input: Record<string, unknown>; result: unknown }>
  }>
  iterations: number
  provider: string
  error?: string
}

export async function runAgentCycle(): Promise<AgentRunResult> {
  const provider = getActiveProvider()
  const result: AgentRunResult = { decisions: [], iterations: 0, provider }

  console.log(`[Agent] Starting cycle with provider: ${provider}`)

  const contextPrompt = `Run your decision cycle. Check the current state of the platform and take any necessary actions. Current time: ${new Date().toISOString()}`

  // Track conversation in provider-agnostic format
  const messages: Message[] = [
    { role: 'user', content: contextPrompt },
  ]

  const MAX_ITERATIONS = 10

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    result.iterations = i + 1

    let response
    try {
      response = await callAI(SYSTEM_PROMPT, messages, tools, 4096)
      result.provider = response.provider
    } catch (error) {
      result.error = `AI API error: ${error instanceof Error ? error.message : String(error)}`
      break
    }

    const decision: AgentRunResult['decisions'][0] = { reasoning: '', toolCalls: [] }
    decision.reasoning = response.text

    // If no tool calls, we're done
    if (response.stopReason === 'end_turn' || response.toolCalls.length === 0) {
      if (decision.reasoning) {
        await prismaQuery.agentLog.create({
          data: {
            action: 'think',
            details: JSON.stringify({ reasoning: decision.reasoning, iteration: i + 1, provider: response.provider }),
          },
        })
      }
      result.decisions.push(decision)
      break
    }

    // Build assistant message with text + tool_use blocks
    const assistantContent: ContentBlock[] = []
    if (response.text) {
      assistantContent.push({ type: 'text', text: response.text })
    }
    for (const tc of response.toolCalls) {
      assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
    }
    messages.push({ role: 'assistant', content: assistantContent })

    // Execute tool calls
    const toolResultBlocks: ContentBlock[] = []

    for (const tc of response.toolCalls) {
      let toolResult: unknown
      let isError = false

      try {
        toolResult = await executeToolCall(tc.name, tc.input)
      } catch (error) {
        toolResult = { error: error instanceof Error ? error.message : String(error) }
        isError = true
      }

      decision.toolCalls.push({ name: tc.name, input: tc.input, result: toolResult })

      // Log each tool call
      await prismaQuery.agentLog.create({
        data: {
          action: 'execute',
          details: JSON.stringify({
            tool: tc.name,
            input: tc.input,
            result: toolResult,
            iteration: i + 1,
            isError,
            provider: response.provider,
          }),
          txHash:
            (toolResult as Record<string, unknown>)?.workerTxHash as string ||
            (toolResult as Record<string, unknown>)?.escrowTxHash as string ||
            (toolResult as Record<string, unknown>)?.refundTxHash as string ||
            null,
        },
      })

      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: JSON.stringify(toolResult),
        is_error: isError,
      })
    }

    messages.push({ role: 'user', content: toolResultBlocks })
    result.decisions.push(decision)
  }

  // Log cycle summary
  await prismaQuery.agentLog.create({
    data: {
      action: 'observe',
      details: JSON.stringify({
        type: 'agent_cycle_complete',
        iterations: result.iterations,
        totalToolCalls: result.decisions.reduce((sum, d) => sum + d.toolCalls.length, 0),
        provider: result.provider,
        error: result.error || null,
      }),
    },
  })

  return result
}
