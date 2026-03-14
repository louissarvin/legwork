import { describe, it, expect } from 'bun:test'

// Test pricing logic directly without external API calls
describe('Task Pricing Logic', () => {
  // Pure math tests (no API dependency)
  function calculatePrice(baseRateUsd: number, urgency: 'normal' | 'urgent' | 'emergency', pendingTasks: number, availableWorkers: number) {
    const urgencyMultiplier = { normal: 1.0, urgent: 1.5, emergency: 3.0 }
    const demandRatio = pendingTasks / Math.max(availableWorkers, 1)
    const surgeMultiplier = Math.max(1.0, Math.min(demandRatio, 5.0))
    const priceUsdt = baseRateUsd * urgencyMultiplier[urgency] * surgeMultiplier
    const priceBaseUnits = Math.floor(priceUsdt * 1e6).toString()
    return { priceUsdt, priceBaseUnits, surgeMultiplier }
  }

  it('should calculate normal pricing without surge', () => {
    const result = calculatePrice(10, 'normal', 5, 10)
    expect(result.surgeMultiplier).toBe(1.0)
    expect(result.priceUsdt).toBe(10)
    expect(parseInt(result.priceBaseUnits)).toBe(10_000000)
  })

  it('should apply urgency multiplier', () => {
    const normal = calculatePrice(10, 'normal', 1, 10)
    const urgent = calculatePrice(10, 'urgent', 1, 10)
    const emergency = calculatePrice(10, 'emergency', 1, 10)

    expect(urgent.priceUsdt).toBe(normal.priceUsdt * 1.5)
    expect(emergency.priceUsdt).toBe(normal.priceUsdt * 3.0)
  })

  it('should apply surge multiplier', () => {
    const noSurge = calculatePrice(10, 'normal', 5, 10)
    const surge = calculatePrice(10, 'normal', 30, 10)

    expect(noSurge.surgeMultiplier).toBe(1.0)
    expect(surge.surgeMultiplier).toBe(3.0)
  })

  it('should cap surge at 5x', () => {
    const result = calculatePrice(10, 'normal', 100, 1)
    expect(result.surgeMultiplier).toBe(5.0)
    expect(result.priceUsdt).toBe(50) // 10 * 1.0 * 5.0
  })

  it('should handle zero workers (prevent division by zero)', () => {
    const result = calculatePrice(10, 'normal', 5, 0)
    expect(result.surgeMultiplier).toBe(5.0) // 5/1 = 5, capped at 5
  })

  it('should calculate correct base units (6 decimals)', () => {
    const result = calculatePrice(25.50, 'normal', 1, 10)
    expect(parseInt(result.priceBaseUnits)).toBe(25_500000)
  })
})
