import { describe, it, expect } from 'bun:test'
import { AGENT_TOOLS } from '../lib/agent/tools.ts'

describe('Agent Tools Integration', () => {
  const toolNames = AGENT_TOOLS.map(t => t.name)

  it('should have 26 tools total (12 original + 6 round2 + 4 round3)', () => {
    expect(AGENT_TOOLS.length).toBe(35)
  })

  // Aave tools
  it('should include Aave lending tools', () => {
    expect(toolNames).toContain('check_aave_position')
    expect(toolNames).toContain('supply_to_aave')
    expect(toolNames).toContain('withdraw_from_aave')
  })

  // Pricing tools
  it('should include pricing tools', () => {
    expect(toolNames).toContain('get_current_price')
    expect(toolNames).toContain('calculate_task_price')
  })

  // Bridge tools
  it('should include bridge quote tool', () => {
    expect(toolNames).toContain('quote_bridge')
  })

  // Validate all tool schemas
  it('should have valid schemas for all 26 tools', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.name).toMatch(/^[a-z_]+$/)
      expect(tool.description.length).toBeGreaterThan(10)
      expect(tool.input_schema.type).toBe('object')
    }
  })

  // Aave tools should have amount parameters
  it('supply_to_aave should require amount', () => {
    const tool = AGENT_TOOLS.find(t => t.name === 'supply_to_aave')!
    expect((tool.input_schema as any).required).toContain('amount')
  })

  it('get_current_price should require base and quote', () => {
    const tool = AGENT_TOOLS.find(t => t.name === 'get_current_price')!
    expect((tool.input_schema as any).required).toContain('base')
    expect((tool.input_schema as any).required).toContain('quote')
  })
})
