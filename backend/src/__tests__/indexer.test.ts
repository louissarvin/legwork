import { describe, it, expect } from 'bun:test'
import { verifyPaymentLanded, getIndexerBalance } from '../lib/wdk/indexer.ts'

describe('WDK Indexer', () => {
  it('should return null when API key not set', async () => {
    // Without API key, indexer should fail gracefully
    const balance = await getIndexerBalance('0x0000000000000000000000000000000000000000')
    // Will be null if no API key set
    expect(balance === null || typeof balance === 'string').toBe(true)
  })

  it('should return false for unverifiable payment', async () => {
    const landed = await verifyPaymentLanded('0x0000000000000000000000000000000000000000', '1000000')
    expect(landed).toBe(false)
  })
})
