import { describe, it, expect } from 'bun:test'

describe('WDK Read-Only Monitor', () => {
  it('should export monitoring functions', async () => {
    const mod = await import('../lib/wdk/monitor.ts')
    expect(typeof mod.getAddressBalance).toBe('function')
    expect(typeof mod.monitorEscrowBalances).toBe('function')
    expect(typeof mod.checkWorkerBalance).toBe('function')
  })
})
