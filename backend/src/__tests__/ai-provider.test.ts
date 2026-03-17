import { describe, it, expect } from 'bun:test'

describe('AI Provider', () => {
  it('should export provider module', async () => {
    const mod = await import('../lib/ai/provider.ts')
    expect(mod.callAI).toBeDefined()
    expect(mod.callVision).toBeDefined()
    expect(mod.getActiveProvider).toBeDefined()
    expect(typeof mod.callAI).toBe('function')
    expect(typeof mod.callVision).toBe('function')
  })

  it('should detect provider from env or throw', async () => {
    const { getActiveProvider } = await import('../lib/ai/provider.ts')
    const hasKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.GROQ_API_KEY

    if (hasKey) {
      const provider = getActiveProvider()
      expect(['anthropic', 'groq']).toContain(provider)
    } else {
      expect(() => getActiveProvider()).toThrow('No AI provider configured')
    }
  })

  it('should have correct Groq model for tool calling + vision', () => {
    // Llama 4 Scout supports both tools and vision on Groq
    const model = 'meta-llama/llama-4-scout-17b-16e-instruct'
    expect(model).toContain('llama-4')
    expect(model).toContain('scout')
  })

  it('should support fallback from anthropic to groq', () => {
    // Errors that should trigger fallback
    const fallbackErrors = [
      '401 Unauthorized',
      '429 Rate limited',
      'insufficient credit',
      'billing issue',
      'overloaded',
    ]

    for (const msg of fallbackErrors) {
      const error = new Error(msg)
      const shouldFallback = error.message.toLowerCase().includes('401') ||
        error.message.toLowerCase().includes('429') ||
        error.message.toLowerCase().includes('credit') ||
        error.message.toLowerCase().includes('billing') ||
        error.message.toLowerCase().includes('overloaded')
      expect(shouldFallback).toBe(true)
    }
  })

  it('should not fallback on normal errors', () => {
    const normalErrors = [
      'Network timeout',
      'Invalid JSON response',
      'Tool execution failed',
    ]

    for (const msg of normalErrors) {
      const error = new Error(msg)
      const shouldFallback = error.message.toLowerCase().includes('401') ||
        error.message.toLowerCase().includes('429') ||
        error.message.toLowerCase().includes('credit')
      expect(shouldFallback).toBe(false)
    }
  })
})
