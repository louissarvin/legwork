import { describe, it, expect } from 'bun:test'

describe('WDK Orchestrator Pattern', () => {
  it('should register Aave protocol on the singleton WDK instance', async () => {
    // Verify setup.ts imports and registers AaveProtocolEvm
    const setupSource = await Bun.file('src/lib/wdk/setup.ts').text()
    expect(setupSource).toContain("import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm'")
    expect(setupSource).toContain(".registerProtocol('sepolia', 'aave', AaveProtocolEvm)")
  })

  it('should use singleton pattern in lending.ts (no standalone WDK instances)', async () => {
    const lendingSource = await Bun.file('src/lib/wdk/lending.ts').text()
    // Should NOT create new WDK instances
    expect(lendingSource).not.toContain('new WDK(seed)')
    expect(lendingSource).not.toContain('getAaveWdk()')
    // Should use singleton
    expect(lendingSource).toContain("import { getWdk } from './setup.ts'")
    expect(lendingSource).toContain('getWdk()')
    // Should use registered protocol
    expect(lendingSource).toContain("getLendingProtocol('aave')")
  })

  it('should not have any standalone WDK instances in lending.ts', async () => {
    const lendingSource = await Bun.file('src/lib/wdk/lending.ts').text()
    // Count occurrences of 'new WDK' - should be zero
    const matches = lendingSource.match(/new WDK\(/g)
    expect(matches).toBeNull()
  })

  it('should register all three wallets/protocols in setup.ts', async () => {
    const setupSource = await Bun.file('src/lib/wdk/setup.ts').text()
    expect(setupSource).toContain("registerWallet('sepolia', WalletManagerEvm")
    expect(setupSource).toContain("registerWallet('sepolia-aa', WalletManagerEvmErc4337")
    expect(setupSource).toContain("registerProtocol('sepolia', 'aave', AaveProtocolEvm)")
  })
})

describe('Batch Token Balances', () => {
  it('should export getTreasuryTokenBalances', async () => {
    const mod = await import('../lib/wdk/treasury.ts')
    expect(typeof mod.getTreasuryTokenBalances).toBe('function')
  })

  it('should use batch getTokenBalances in treasury.ts', async () => {
    const source = await Bun.file('src/lib/wdk/treasury.ts').text()
    expect(source).toContain('getTokenBalances([')
    expect(source).toContain('USDT_SEPOLIA')
    expect(source).toContain('AAVE_SEPOLIA.usdt')
  })

  it('should use parallel balance queries in monitor.ts', async () => {
    const source = await Bun.file('src/lib/wdk/monitor.ts').text()
    expect(source).toContain('Promise.all(balancePromises)')
  })

  it('should use batch balances in get_platform_stats executor', async () => {
    const source = await Bun.file('src/lib/agent/executor.ts').text()
    expect(source).toContain('getTreasuryTokenBalances()')
    expect(source).toContain('aaveUsdt')
  })
})

describe('Dispose Pattern Audit', () => {
  it('should have disposeWdk() in setup.ts', async () => {
    const source = await Bun.file('src/lib/wdk/setup.ts').text()
    expect(source).toContain('wdkInstance.dispose()')
    expect(source).toContain('wdkInstance = null')
  })

  it('should NOT create disposable WDK instances in lending.ts', async () => {
    const source = await Bun.file('src/lib/wdk/lending.ts').text()
    // No dispose() calls needed since we use the singleton
    expect(source).not.toContain('.dispose()')
  })

  it('should still dispose in worker-wallet.ts (uses different seeds)', async () => {
    const source = await Bun.file('src/lib/wdk/worker-wallet.ts').text()
    expect(source).toContain('wdk.dispose()')
    expect(source).toContain('finally')
  })

  it('should have cleanup on SIGINT/SIGTERM in index.ts', async () => {
    const source = await Bun.file('index.ts').text()
    expect(source).toContain('SIGINT')
    expect(source).toContain('SIGTERM')
    expect(source).toContain('disposeWdk()')
  })
})
