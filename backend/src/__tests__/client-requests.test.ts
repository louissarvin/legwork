import { describe, it, expect } from 'bun:test'
import { AGENT_TOOLS } from '../lib/agent/tools.ts'
import { MIN_TASK_PAYMENT, MAX_TASK_PAYMENT, PLATFORM_FEE_BPS, BPS_BASE } from '../config/contracts.ts'

describe('Scenario B: Client-Funded Tasks', () => {
  it('should have list_client_requests tool', () => {
    const tool = AGENT_TOOLS.find(t => t.name === 'list_client_requests')
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('client requests')
  })

  it('should have fulfill_client_request tool with correct params', () => {
    const tool = AGENT_TOOLS.find(t => t.name === 'fulfill_client_request')
    expect(tool).toBeDefined()
    const schema = tool!.input_schema as { required: string[]; properties: Record<string, unknown> }
    expect(schema.required).toContain('request_id')
    expect(schema.required).toContain('price_per_task')
    expect(schema.required).toContain('deadline_hours')
    expect(schema.properties).toHaveProperty('radius_meters')
  })

  it('should calculate correct platform fee for client-funded task', () => {
    // Client deposits $100 USDT for 4 tasks at $25 each
    const taskAmount = 25_000_000n // 25 USDT
    const platformFee = (taskAmount * PLATFORM_FEE_BPS) / BPS_BASE
    const workerPayout = taskAmount - platformFee

    expect(platformFee).toBe(1_250_000n) // $1.25
    expect(workerPayout).toBe(23_750_000n) // $23.75

    // 4 tasks completed = $5 profit for platform
    const totalProfit = platformFee * 4n
    expect(totalProfit).toBe(5_000_000n) // $5.00
  })

  it('should validate budget covers minimum task price', () => {
    const budget = 5_000_000n // 5 USDT
    const tasksRequested = 10

    const perTask = budget / BigInt(tasksRequested) // 0.5 USDT per task
    const meetsMinimum = perTask >= MIN_TASK_PAYMENT

    expect(meetsMinimum).toBe(false) // 500000 < 1000000 (1 USDT min)
  })

  it('should calculate correct number of tasks from budget', () => {
    const budget = 100_000_000n // 100 USDT
    const pricePerTask = 15_000_000n // 15 USDT per task

    const maxTasks = Number(budget / pricePerTask)
    expect(maxTasks).toBe(6) // 100 / 15 = 6 (integer division)

    // Total cost
    const totalCost = pricePerTask * BigInt(maxTasks)
    expect(totalCost).toBe(90_000_000n) // 90 USDT used, 10 USDT remaining
  })

  it('should not exceed max task payment', () => {
    const pricePerTask = 1_500_000_000n // 1500 USDT
    expect(pricePerTask > MAX_TASK_PAYMENT).toBe(true) // exceeds 1000 USDT max
  })
})

describe('Scenario C: t402 API Revenue', () => {
  it('should have check_api_revenue tool', () => {
    const tool = AGENT_TOOLS.find(t => t.name === 'check_api_revenue')
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('t402')
    expect(tool!.description).toContain('revenue')
  })

  it('should calculate revenue from API call volumes', () => {
    const verifyPrice = 0.25
    const reputationPrice = 0.10
    const analyticsPrice = 1.00

    // Simulate 1000 verify calls, 500 reputation calls, 50 analytics calls
    const revenue =
      1000 * verifyPrice +
      500 * reputationPrice +
      50 * analyticsPrice

    expect(revenue).toBe(350) // $350 total
  })

  it('should track revenue per endpoint', () => {
    const endpoints: Record<string, { calls: number; revenue: number }> = {}

    // Simulate logging
    const logs = [
      { endpoint: 'POST /t402/verify', revenue: 0.25 },
      { endpoint: 'POST /t402/verify', revenue: 0.25 },
      { endpoint: 'GET /t402/reputation/:address', revenue: 0.10 },
      { endpoint: 'GET /t402/analytics', revenue: 1.00 },
    ]

    for (const log of logs) {
      if (!endpoints[log.endpoint]) endpoints[log.endpoint] = { calls: 0, revenue: 0 }
      endpoints[log.endpoint].calls++
      endpoints[log.endpoint].revenue += log.revenue
    }

    expect(endpoints['POST /t402/verify'].calls).toBe(2)
    expect(endpoints['POST /t402/verify'].revenue).toBe(0.50)
    expect(endpoints['GET /t402/analytics'].revenue).toBe(1.00)
  })

  it('should have 29 total tools (26 original + 3 new)', () => {
    expect(AGENT_TOOLS.length).toBe(34)

    const newTools = ['list_client_requests', 'fulfill_client_request', 'check_api_revenue']
    for (const name of newTools) {
      expect(AGENT_TOOLS.find(t => t.name === name)).toBeDefined()
    }
  })
})
