import { describe, it, expect } from 'bun:test'

describe('MCP Server Config', () => {
  it('should have @modelcontextprotocol/sdk installed', async () => {
    const pkg = await import('@modelcontextprotocol/sdk/server/index.js')
    expect(pkg).toBeDefined()
  })

  it('should have @t402/wdk installed', async () => {
    const pkg = await import('@t402/wdk')
    expect(pkg).toBeDefined()
  })

  it('should have @tetherto/wdk-protocol-bridge-usdt0-evm installed', async () => {
    const pkg = await import('@tetherto/wdk-protocol-bridge-usdt0-evm')
    expect(pkg).toBeDefined()
  })
})
