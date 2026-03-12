/**
 * Aave V3 Lending Integration via WDK Protocol Registration
 *
 * Uses the WDK orchestrator pattern: Aave is registered as a protocol
 * on the singleton WDK instance via registerProtocol('sepolia', 'aave', AaveProtocolEvm).
 * This avoids creating separate WDK instances for each Aave operation.
 *
 * NOTE: Aave's test USDT on Sepolia (0xaA8E...) is different from
 * WDK's test USDT (0xd077...). Use AAVE_SEPOLIA.usdt for all Aave operations.
 */

import { getWdk } from './setup.ts'
import { AAVE_SEPOLIA } from '../../config/contracts.ts'

export interface AavePosition {
  totalCollateralBase: string
  totalDebtBase: string
  availableBorrowsBase: string
  healthFactor: string
}

// Get the Aave protocol from the registered singleton account
async function getAaveProtocol() {
  const wdk = getWdk()
  const account = await wdk.getAccount('sepolia', 0)
  return account.getLendingProtocol('aave')
}

export async function supplyToAave(amount: bigint): Promise<{ hash: string; fee: string }> {
  const aave = await getAaveProtocol()
  const result = await aave.supply({ token: AAVE_SEPOLIA.usdt, amount })
  return { hash: result.hash, fee: result.fee?.toString() || '0' }
}

export async function withdrawFromAave(amount: bigint): Promise<{ hash: string; fee: string }> {
  const aave = await getAaveProtocol()
  const result = await aave.withdraw({ token: AAVE_SEPOLIA.usdt, amount })
  return { hash: result.hash, fee: result.fee?.toString() || '0' }
}

export async function getAavePosition(): Promise<AavePosition> {
  const aave = await getAaveProtocol()
  const data = await aave.getAccountData()
  return {
    totalCollateralBase: data.totalCollateralBase?.toString() || '0',
    totalDebtBase: data.totalDebtBase?.toString() || '0',
    availableBorrowsBase: data.availableBorrowsBase?.toString() || '0',
    healthFactor: data.healthFactor?.toString() || '0',
  }
}

export async function quoteSupply(amount: bigint): Promise<{ fee: string }> {
  const aave = await getAaveProtocol()
  const quote = await aave.quoteSupply({ token: AAVE_SEPOLIA.usdt, amount })
  return { fee: quote.fee?.toString() || '0' }
}

export async function getAaveUsdtBalance(): Promise<bigint> {
  const wdk = getWdk()
  const account = await wdk.getAccount('sepolia', 0)
  const balance = await account.getTokenBalance(AAVE_SEPOLIA.usdt)
  return BigInt(balance.toString())
}
