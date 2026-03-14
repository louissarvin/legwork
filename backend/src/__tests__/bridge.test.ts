import { describe, it, expect } from 'bun:test'
import { quoteBridgeEstimate, BRIDGE_SUPPORTED_CHAINS } from '../lib/wdk/bridge.ts'

describe('Bridge Module', () => {
  it('should list supported chains', () => {
    expect(BRIDGE_SUPPORTED_CHAINS.length).toBeGreaterThan(10)
    expect(BRIDGE_SUPPORTED_CHAINS).toContain('arbitrum')
    expect(BRIDGE_SUPPORTED_CHAINS).toContain('polygon')
    expect(BRIDGE_SUPPORTED_CHAINS).toContain('optimism')
  })

  it('should calculate bridge quote for supported chain', () => {
    const quote = quoteBridgeEstimate('arbitrum', 100_000000n) // 100 USDT
    expect(quote.supported).toBe(true)
    expect(quote.targetChain).toBe('arbitrum')
    expect(BigInt(quote.protocolFee)).toBe(30000n) // 0.03% of 100 USDT
    expect(BigInt(quote.totalFee)).toBeGreaterThan(0n)
  })

  it('should mark unsupported chain', () => {
    const quote = quoteBridgeEstimate('solana', 100_000000n)
    expect(quote.supported).toBe(false)
  })

  it('should calculate correct 0.03% protocol fee', () => {
    const quote = quoteBridgeEstimate('polygon', 1000_000000n) // 1000 USDT
    expect(BigInt(quote.protocolFee)).toBe(300000n) // 0.3 USDT
  })
})
