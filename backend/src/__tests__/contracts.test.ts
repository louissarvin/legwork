import { describe, it, expect } from 'bun:test'
import { PLATFORM_FEE_BPS, BPS_BASE, USDT_DECIMALS } from '../config/contracts.ts'

describe('Fee Calculation', () => {
  it('should calculate 5% platform fee correctly', () => {
    const taskAmount = 100_000000n // 100 USDT
    const fee = (taskAmount * PLATFORM_FEE_BPS) / BPS_BASE
    const workerPayout = taskAmount - fee

    expect(fee).toBe(5_000000n) // 5 USDT
    expect(workerPayout).toBe(95_000000n) // 95 USDT
  })

  it('should handle small amounts', () => {
    const taskAmount = 1_000000n // 1 USDT
    const fee = (taskAmount * PLATFORM_FEE_BPS) / BPS_BASE
    const workerPayout = taskAmount - fee

    expect(fee).toBe(50000n) // 0.05 USDT
    expect(workerPayout).toBe(950000n) // 0.95 USDT
  })

  it('should handle large amounts', () => {
    const taskAmount = 1000_000000n // 1000 USDT
    const fee = (taskAmount * PLATFORM_FEE_BPS) / BPS_BASE
    expect(fee).toBe(50_000000n) // 50 USDT
  })

  it('should verify USDT has 6 decimals', () => {
    expect(USDT_DECIMALS).toBe(6)
    // 1 USDT = 1_000000 base units
    expect(1_000000n).toBe(BigInt(10 ** USDT_DECIMALS))
  })
})
