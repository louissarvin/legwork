import { describe, it, expect } from 'bun:test'
import { generateAuthChallenge, verifySignature } from '../lib/wdk/signing.ts'

describe('Wallet Signing', () => {
  it('should generate unique auth challenges', () => {
    const c1 = generateAuthChallenge('0xABC')
    const c2 = generateAuthChallenge('0xABC')
    expect(c1).not.toBe(c2) // Different nonces
    expect(c1).toContain('Legwork auth')
    expect(c1).toContain('0xABC')
  })

  it('should reject invalid signatures', async () => {
    const valid = await verifySignature('test message', '0xinvalid', '0x0000000000000000000000000000000000000000')
    expect(valid).toBe(false)
  })
})
