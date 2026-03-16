import { describe, it, expect } from 'bun:test'
import { T402_ENDPOINTS, T402_NETWORK, T402_FACILITATOR, getPaymentRequiredResponse } from '../lib/t402/setup.ts'

describe('t402 Protocol', () => {
  it('should define paywalled endpoints', () => {
    expect(Object.keys(T402_ENDPOINTS).length).toBeGreaterThanOrEqual(3)
    expect(T402_ENDPOINTS['POST /t402/verify']).toBeDefined()
    expect(T402_ENDPOINTS['GET /t402/reputation/:address']).toBeDefined()
    expect(T402_ENDPOINTS['GET /t402/analytics']).toBeDefined()
  })

  it('should return 402 response for valid endpoint', () => {
    const response = getPaymentRequiredResponse('POST /t402/verify', '0xTREASURY')
    expect(response).not.toBeNull()
    expect(response!.status).toBe(402)
    expect(response!.body.paymentRequired.price).toBe('$0.25')
    expect(response!.body.paymentRequired.payTo).toBe('0xTREASURY')
    expect(response!.body.protocol).toBe('t402')
    expect(response!.body.facilitator).toBe(T402_FACILITATOR)
  })

  it('should return null for unknown endpoint', () => {
    const response = getPaymentRequiredResponse('GET /unknown', '0x0')
    expect(response).toBeNull()
  })

  it('should have descriptions for all endpoints', () => {
    for (const [, config] of Object.entries(T402_ENDPOINTS)) {
      expect(config.description.length).toBeGreaterThan(10)
      expect(config.price).toMatch(/^\$/)
      expect(config.network).toMatch(/^eip155:/)
    }
  })

  it('should use Ethereum Sepolia network', () => {
    expect(T402_NETWORK).toBe('eip155:11155111')
  })
})
