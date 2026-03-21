import { describe, it, expect } from 'bun:test'
import { AGENT_TOOLS } from '../lib/agent/tools.ts'

describe('Full Agent Tool Suite', () => {
  const toolNames = AGENT_TOOLS.map(t => t.name)

  it('should have 26 tools total', () => {
    expect(AGENT_TOOLS.length).toBe(35)
  })

  // Original 12 tools
  it('should have core task management tools', () => {
    expect(toolNames).toContain('check_treasury_balance')
    expect(toolNames).toContain('create_task')
    expect(toolNames).toContain('approve_and_pay')
    expect(toolNames).toContain('reject_submission')
    expect(toolNames).toContain('refund_expired_task')
  })

  // Aave tools (added in round 2)
  it('should have Aave lending tools', () => {
    expect(toolNames).toContain('check_aave_position')
    expect(toolNames).toContain('supply_to_aave')
    expect(toolNames).toContain('withdraw_from_aave')
  })

  // Pricing tools (added in round 2)
  it('should have pricing tools', () => {
    expect(toolNames).toContain('get_current_price')
    expect(toolNames).toContain('calculate_task_price')
  })

  // Bridge tool (added in round 2)
  it('should have bridge tool', () => {
    expect(toolNames).toContain('quote_bridge')
  })

  // NEW: Indexer, swap, fee estimation tools
  it('should have indexer tools', () => {
    expect(toolNames).toContain('check_transfer_history')
    expect(toolNames).toContain('verify_payment_landed')
  })

  it('should have swap quote tool', () => {
    expect(toolNames).toContain('quote_swap')
  })

  it('should have fee estimation tool', () => {
    expect(toolNames).toContain('quote_escrow_fee')
  })

  // All tools should have valid schemas
  it('should have valid schemas for all 26 tools', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.name).toMatch(/^[a-z_]+$/)
      expect(tool.description.length).toBeGreaterThan(10)
      expect(tool.input_schema.type).toBe('object')
    }
  })
})
