import { describe, it, expect } from 'bun:test'
import WDK from '@tetherto/wdk'

describe('WDK Setup', () => {
  it('should generate valid seed phrase with 12 words', () => {
    const seed = WDK.getRandomSeedPhrase()
    const words = seed.split(' ')
    expect(words.length).toBe(12)
    // Each word should be non-empty
    for (const word of words) {
      expect(word.length).toBeGreaterThan(0)
    }
  })

  it('should generate unique seed phrases', () => {
    const seed1 = WDK.getRandomSeedPhrase()
    const seed2 = WDK.getRandomSeedPhrase()
    expect(seed1).not.toBe(seed2)
  })

  it('should create WDK instance from seed', () => {
    const seed = WDK.getRandomSeedPhrase()
    const wdk = new WDK(seed)
    expect(wdk).toBeDefined()
    wdk.dispose()
  })
})
