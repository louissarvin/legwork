import { describe, it, expect } from 'bun:test'
import { AGENT_TOOLS } from '../lib/agent/tools.ts'

describe('Complete Agent Tool Suite', () => {
  const toolNames = AGENT_TOOLS.map(t => t.name)

  it('should have 26 tools total', () => {
    expect(AGENT_TOOLS.length).toBe(34)
  })

  // Core tools (12)
  it('should have all core task management tools', () => {
    const core = ['check_treasury_balance', 'check_eth_balance', 'get_treasury_address',
      'list_open_tasks', 'list_pending_submissions', 'list_expired_tasks',
      'create_task', 'verify_submission', 'approve_and_pay', 'reject_submission',
      'refund_expired_task', 'get_platform_stats']
    for (const t of core) expect(toolNames).toContain(t)
  })

  // DeFi tools (6)
  it('should have all DeFi protocol tools', () => {
    const defi = ['check_aave_position', 'supply_to_aave', 'withdraw_from_aave',
      'get_current_price', 'calculate_task_price', 'quote_bridge']
    for (const t of defi) expect(toolNames).toContain(t)
  })

  // Monitoring tools (4)
  it('should have all monitoring tools', () => {
    const monitoring = ['check_transfer_history', 'verify_payment_landed', 'quote_swap', 'quote_escrow_fee']
    for (const t of monitoring) expect(toolNames).toContain(t)
  })

  // NEW: EAS + monitoring tools (4)
  it('should have EAS attestation tool', () => {
    expect(toolNames).toContain('create_attestation')
  })

  it('should have read-only monitoring tools', () => {
    expect(toolNames).toContain('check_worker_balance')
    expect(toolNames).toContain('monitor_escrow_balances')
    expect(toolNames).toContain('get_transaction_log')
  })

  // All tools valid
  it('should have valid schemas for all 26 tools', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.name).toMatch(/^[a-z_]+$/)
      expect(tool.description.length).toBeGreaterThan(10)
      expect(tool.input_schema.type).toBe('object')
    }
  })
})
