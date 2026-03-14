import { describe, it, expect } from 'bun:test'
import { quoteSwapEstimate, MAINNET_TOKENS } from '../lib/wdk/swap.ts'

describe('Velora Swap Module', () => {
  it('should quote USDT to USDC swap (1:1)', () => {
    const quote = quoteSwapEstimate('USDT', 'USDC', 100_000000n)
    expect(quote.supported).toBe(true)
    expect(BigInt(quote.estimatedAmountOut)).toBe(100_000000n)
  })

  it('should quote USDT to WETH swap', () => {
    const quote = quoteSwapEstimate('USDT', 'WETH', 2500_000000n)
    expect(quote.supported).toBe(true)
    expect(BigInt(quote.estimatedAmountOut)).toBeGreaterThan(0n)
  })

  it('should handle unsupported pair', () => {
    const quote = quoteSwapEstimate('USDT', 'UNKNOWN', 100_000000n)
    expect(quote.supported).toBe(false)
  })

  it('should have mainnet token addresses', () => {
    expect(MAINNET_TOKENS.USDT).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7')
    expect(MAINNET_TOKENS.WETH).toBe('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
  })
})
