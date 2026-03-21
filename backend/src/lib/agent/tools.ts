import Anthropic from '@anthropic-ai/sdk'

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'check_treasury_balance',
    description: 'Check the USDT balance of the agent treasury wallet on Sepolia',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'check_eth_balance',
    description: 'Check the ETH balance of the treasury for gas fees',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_treasury_address',
    description: 'Get the treasury wallet address',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_open_tasks',
    description: 'List all currently open tasks that workers can accept',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_pending_submissions',
    description: 'List all submissions waiting for verification',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_expired_tasks',
    description: 'List tasks that have passed their deadline without completion',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'create_task',
    description: 'Post a new task for human workers. Locks USDT in escrow.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string', description: 'What the worker needs to do' },
        category: { type: 'string', enum: ['photo', 'delivery', 'check', 'data', 'mystery', 'event'], description: 'Task category' },
        lat: { type: 'number', description: 'Task location latitude' },
        lon: { type: 'number', description: 'Task location longitude' },
        address: { type: 'string', description: 'Human-readable address' },
        paymentAmount: { type: 'string', description: 'Payment in USDT base units (6 decimals). 1 USDT = 1000000' },
        deadlineHours: { type: 'number', description: 'Hours until task expires' },
        radiusMeters: { type: 'number', description: 'Acceptable GPS radius in meters' },
      },
      required: ['description', 'category', 'lat', 'lon', 'paymentAmount', 'deadlineHours'],
    },
  },
  {
    name: 'verify_submission',
    description: 'Run the verification pipeline on a worker submission (GPS + photo AI)',
    input_schema: {
      type: 'object' as const,
      properties: {
        submission_id: { type: 'string', description: 'The submission ID to verify' },
      },
      required: ['submission_id'],
    },
  },
  {
    name: 'approve_and_pay',
    description: 'Approve a verified submission and release gasless USDT payment to worker',
    input_schema: {
      type: 'object' as const,
      properties: {
        submission_id: { type: 'string', description: 'The submission ID to approve' },
      },
      required: ['submission_id'],
    },
  },
  {
    name: 'reject_submission',
    description: 'Reject a submission and return escrow to treasury',
    input_schema: {
      type: 'object' as const,
      properties: {
        submission_id: { type: 'string', description: 'The submission ID to reject' },
        reason: { type: 'string', description: 'Reason for rejection' },
      },
      required: ['submission_id', 'reason'],
    },
  },
  {
    name: 'refund_expired_task',
    description: 'Return escrowed funds from an expired task back to treasury',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'The expired task ID' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'get_platform_stats',
    description: 'Get overall platform statistics (total tasks, workers, revenue)',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'check_aave_position',
    description: 'Check the current Aave V3 lending position (supplied collateral, debt, health factor)',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'supply_to_aave',
    description: 'Supply idle USDT to Aave V3 to earn yield. Only supply Aave test USDT, not escrow USDT.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: { type: 'string', description: 'Amount in USDT base units (6 decimals). 1 USDT = 1000000' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'withdraw_from_aave',
    description: 'Withdraw USDT from Aave V3 lending position',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: { type: 'string', description: 'Amount in USDT base units (6 decimals)' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'get_current_price',
    description: 'Get the current price of a cryptocurrency pair from Bitfinex (e.g., BTC/USD, ETH/USD)',
    input_schema: {
      type: 'object' as const,
      properties: {
        base: { type: 'string', description: 'Base currency symbol (e.g., BTC, ETH, UST for USDT)' },
        quote: { type: 'string', description: 'Quote currency symbol (e.g., USD, EUR)' },
      },
      required: ['base', 'quote'],
    },
  },
  {
    name: 'calculate_task_price',
    description: 'Calculate the optimal price for a task based on market rates, urgency, and supply/demand',
    input_schema: {
      type: 'object' as const,
      properties: {
        base_rate_usd: { type: 'number', description: 'Base rate in USD for the task type' },
        urgency: { type: 'string', enum: ['normal', 'urgent', 'emergency'], description: 'Task urgency level' },
      },
      required: ['base_rate_usd', 'urgency'],
    },
  },
  {
    name: 'quote_bridge',
    description: 'Get a fee quote for bridging USDT0 to another chain via LayerZero (mainnet only, shows architecture)',
    input_schema: {
      type: 'object' as const,
      properties: {
        target_chain: { type: 'string', description: 'Target chain name (e.g., arbitrum, polygon, optimism)' },
        amount: { type: 'string', description: 'Amount in USDT base units (6 decimals)' },
      },
      required: ['target_chain', 'amount'],
    },
  },
  {
    name: 'check_transfer_history',
    description: 'Check USDT transfer history for an address using the WDK Indexer API',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Wallet address to check' },
        limit: { type: 'number', description: 'Number of transfers to return (default 10)' },
      },
      required: ['address'],
    },
  },
  {
    name: 'verify_payment_landed',
    description: 'Verify that a payment actually arrived in a worker wallet via WDK Indexer',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Worker wallet address' },
        expected_amount: { type: 'string', description: 'Expected USDT amount in base units' },
      },
      required: ['address', 'expected_amount'],
    },
  },
  {
    name: 'quote_swap',
    description: 'Get a swap quote for exchanging tokens (mainnet architecture demo)',
    input_schema: {
      type: 'object' as const,
      properties: {
        token_in: { type: 'string', description: 'Token to sell (USDT, USDC, WETH, DAI)' },
        token_out: { type: 'string', description: 'Token to buy (USDT, USDC, WETH, DAI)' },
        amount_in: { type: 'string', description: 'Amount to sell in base units' },
      },
      required: ['token_in', 'token_out', 'amount_in'],
    },
  },
  {
    name: 'quote_escrow_fee',
    description: 'Estimate the gas fee for locking funds in escrow before creating a task',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_index: { type: 'number', description: 'Task escrow account index' },
        amount: { type: 'string', description: 'Amount in USDT base units' },
      },
      required: ['task_index', 'amount'],
    },
  },
  {
    name: 'create_attestation',
    description: 'Create an on-chain EAS attestation for a completed task (proof of work on Sepolia)',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'Task ID' },
        worker_address: { type: 'string', description: 'Worker wallet address' },
        amount: { type: 'string', description: 'Payment amount in USDT base units' },
        verification_score: { type: 'number', description: 'Verification score 0-100' },
        photo_ipfs_hash: { type: 'string', description: 'IPFS CID of proof photo' },
        payout_tx_hash: { type: 'string', description: 'Transaction hash of the payout' },
      },
      required: ['task_id', 'worker_address', 'amount', 'verification_score', 'payout_tx_hash'],
    },
  },
  {
    name: 'check_worker_balance',
    description: 'Check ETH and USDT balance of any wallet address (read-only, no seed needed)',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Wallet address to check' },
      },
      required: ['address'],
    },
  },
  {
    name: 'monitor_escrow_balances',
    description: 'Batch check USDT balances of all active escrow wallets',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_transaction_log',
    description: 'Get recent on-chain transactions logged by the platform',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Number of transactions to return (default 20)' },
      },
      required: [],
    },
  },
  // Scenario B: Client-funded task creation
  {
    name: 'list_client_requests',
    description: 'List pending client requests that need tasks created. Clients deposit USDT and describe what they need done. You create tasks from their budget.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'fulfill_client_request',
    description: 'Create tasks from a funded client request. Takes the request ID and creates individual tasks, locking escrow from the treasury (which holds client deposits). Each task created is linked to the client request.',
    input_schema: {
      type: 'object' as const,
      properties: {
        request_id: { type: 'string', description: 'The client request ID to fulfill' },
        price_per_task: { type: 'string', description: 'USDT base units per task (agent decides based on market)' },
        deadline_hours: { type: 'string', description: 'Hours until each task expires (e.g. "24")' },
        radius_meters: { type: 'string', description: 'GPS radius in meters for location tasks (e.g. "100")' },
      },
      required: ['request_id', 'price_per_task', 'deadline_hours'],
    },
  },
  // Scenario C: t402 API revenue tracking
  {
    name: 'check_api_revenue',
    description: 'Check revenue earned from t402 API calls (verification, reputation, analytics endpoints). Revenue comes from other AI agents paying to use our services.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  // Multi-chain + XAU₮ treasury
  {
    name: 'list_treasury_wallets',
    description: 'List all multi-chain treasury wallets. The agent holds wallets on Ethereum, Arbitrum, Bitcoin, TON, and Tron from a single seed. Shows addresses for each chain.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'check_xaut_balance',
    description: 'Check XAU₮ (Tether Gold) balance on Ethereum mainnet. XAU₮ is held as a gold-backed reserve asset alongside USDT working capital.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_xaut_price',
    description: 'Get current XAU₮ (Tether Gold) price in USD from Bitfinex. Used for treasury valuation and rebalancing decisions.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  // Worker search + direct booking
  {
    name: 'search_workers',
    description: 'Search available workers by skill, availability, and reputation. Use this to find the best worker for a specific task before assigning them directly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        skill: { type: 'string', description: 'Skill to filter by (photo, delivery, check, data, mystery, event)' },
        available_only: { type: 'string', description: 'Set to "true" to only show available workers' },
      },
      required: [],
    },
  },
  {
    name: 'assign_worker_to_task',
    description: 'Directly assign a specific worker to a task (direct booking). The worker must have matching skills and be available. Use search_workers first to find the best match.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'The task ID to assign' },
        worker_id: { type: 'string', description: 'The worker ID to assign' },
      },
      required: ['task_id', 'worker_id'],
    },
  },
  {
    name: 'retry_stuck_payouts',
    description: 'Find approved submissions that have no payout TX hash (stuck payouts) and retry the escrow release. Call this to fix payouts that failed due to insufficient gas.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]
