import { describe, it, expect } from 'bun:test'
import { AGENT_TOOLS } from '../lib/agent/tools.ts'

describe('Agent Tools', () => {
  it('should define all required tools', () => {
    const toolNames = AGENT_TOOLS.map(t => t.name)
    expect(toolNames).toContain('check_treasury_balance')
    expect(toolNames).toContain('create_task')
    expect(toolNames).toContain('approve_and_pay')
    expect(toolNames).toContain('reject_submission')
    expect(toolNames).toContain('refund_expired_task')
    expect(toolNames).toContain('get_platform_stats')
  })

  it('should have valid input schemas for all tools', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.input_schema).toBeDefined()
      expect(tool.input_schema.type).toBe('object')
      expect(tool.description).toBeTruthy()
      expect(tool.name).toMatch(/^[a-z_]+$/)
    }
  })

  it('should have 26 tools total', () => {
    expect(AGENT_TOOLS.length).toBe(35)
  })

  it('create_task should require essential fields', () => {
    const createTool = AGENT_TOOLS.find(t => t.name === 'create_task')
    expect(createTool).toBeDefined()
    const required = (createTool!.input_schema as { required: string[] }).required
    expect(required).toContain('description')
    expect(required).toContain('category')
    expect(required).toContain('lat')
    expect(required).toContain('lon')
    expect(required).toContain('paymentAmount')
    expect(required).toContain('deadlineHours')
  })
})
