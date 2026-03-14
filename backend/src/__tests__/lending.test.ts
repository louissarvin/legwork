import { describe, it, expect } from 'bun:test'

describe('Aave Lending Config', () => {
  it('should have correct Aave Sepolia addresses', async () => {
    const { AAVE_USDT_SEPOLIA, AAVE_POOL_SEPOLIA } = await import('../config/contracts.ts')
    expect(AAVE_USDT_SEPOLIA).toBe('0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0')
    expect(AAVE_POOL_SEPOLIA).toBe('0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951')
  })

  it('should distinguish WDK USDT from Aave USDT on Sepolia', async () => {
    const { USDT_SEPOLIA, AAVE_USDT_SEPOLIA } = await import('../config/contracts.ts')
    expect(USDT_SEPOLIA).not.toBe(AAVE_USDT_SEPOLIA)
  })

  it('should have Aave addresses in AAVE_SEPOLIA object', async () => {
    const { AAVE_SEPOLIA } = await import('../config/contracts.ts')
    expect(AAVE_SEPOLIA.pool).toBe('0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951')
    expect(AAVE_SEPOLIA.usdt).toBe('0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0')
    expect(AAVE_SEPOLIA.faucet).toBe('0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D')
  })

  it('should have supply threshold set to 100 USDT', async () => {
    const { AAVE_SUPPLY_THRESHOLD } = await import('../config/contracts.ts')
    expect(AAVE_SUPPLY_THRESHOLD).toBe(100_000000n)
  })
})
