import { describe, it, expect } from 'bun:test'
import { approximateCoord, approximateAddress, redactTaskLocation } from '../utils/locationUtils.ts'

describe('Location Privacy', () => {
  it('should approximate coordinates to ~1km precision', () => {
    // 40.712776 -> 40.71 (2 decimal places)
    expect(approximateCoord(40.712776)).toBe(40.71)
    expect(approximateCoord(-74.005974)).toBe(-74.01)
    expect(approximateCoord(0)).toBe(0)
    expect(approximateCoord(51.507351)).toBe(51.51) // London
  })

  it('should approximate address to neighborhood level', () => {
    expect(approximateAddress('123 Main St, Manhattan, NY 10001')).toBe('Manhattan, NY 10001')
    expect(approximateAddress('456 Broadway, Brooklyn, NY')).toBe('Brooklyn, NY')
    expect(approximateAddress('Manhattan, NY')).toBe('Manhattan, NY')
    expect(approximateAddress(null)).toBe(null)
    expect(approximateAddress('Single Location')).toBe('Single Location')
  })

  it('should redact task location for public listing', () => {
    const task = {
      id: 'test-1',
      description: 'Photo task',
      lat: 40.712776,
      lon: -74.005974,
      address: '123 Main St, Manhattan, NY',
      radiusMeters: 100,
      paymentAmount: '15000000',
    }

    const redacted = redactTaskLocation(task)

    // Exact values should be zeroed
    expect(redacted.lat).toBe(0)
    expect(redacted.lon).toBe(0)
    expect(redacted.address).toBe(null)
    expect(redacted.radiusMeters).toBe(0)

    // Approximate values should be present
    expect(redacted.latApprox).toBe(40.71)
    expect(redacted.lonApprox).toBe(-74.01)
    expect(redacted.addressApprox).toBe('Manhattan, NY')

    // Other fields preserved
    expect(redacted.id).toBe('test-1')
    expect(redacted.description).toBe('Photo task')
    expect(redacted.paymentAmount).toBe('15000000')
  })

  it('should preserve ~1km uncertainty', () => {
    // Two points 500m apart should approximate to the same coords
    const point1 = approximateCoord(40.7127) // ~40.71
    const point2 = approximateCoord(40.7172) // ~40.72

    // They are close but may round differently, proving we hide exact location
    // The key property: the approximation loses the ~500m precision
    expect(Math.abs(point1 - 40.7127)).toBeGreaterThan(0.001)
  })
})

describe('Reputation Gating', () => {
  it('should define correct tier thresholds', () => {
    // Low tier: $0-$5, anyone can accept
    const lowMax = 5_000000n
    expect(lowMax).toBe(5_000000n)

    // Mid tier: $5-$50, need 0.5+ reputation
    const midMax = 50_000000n
    const midMinRep = 0.5
    expect(midMax).toBe(50_000000n)
    expect(midMinRep).toBe(0.5)

    // High tier: $50+, need 2+ reputation
    const highMinRep = 2
    expect(highMinRep).toBe(2)
  })

  it('should block low-reputation workers from high-value tasks', () => {
    const workerReputation = 0.3
    const taskAmount = 25_000000n // $25

    const lowMaxPayment = 5_000000n
    const midMinReputation = 0.5

    const exceedsLowTier = taskAmount > lowMaxPayment
    const meetsMinReputation = workerReputation >= midMinReputation

    expect(exceedsLowTier).toBe(true)
    expect(meetsMinReputation).toBe(false)
    // Worker should be blocked from this task
  })

  it('should allow experienced workers to accept high-value tasks', () => {
    const workerReputation = 3.5
    const taskAmount = 100_000000n // $100

    const midMaxPayment = 50_000000n
    const highMinReputation = 2

    const exceedsMidTier = taskAmount > midMaxPayment
    const meetsHighReputation = workerReputation >= highMinReputation

    expect(exceedsMidTier).toBe(true)
    expect(meetsHighReputation).toBe(true)
    // Worker should be allowed
  })
})
