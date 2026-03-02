import { getWdk } from './setup.ts'
import { USDT_SEPOLIA, AAVE_SEPOLIA } from '../../config/contracts.ts'

// Account 0 = treasury
export async function getTreasuryAccount() {
  const wdk = getWdk()
  return wdk.getAccount('sepolia', 0)
}

export async function getTreasuryAddress(): Promise<string> {
  const account = await getTreasuryAccount()
  return account.getAddress()
}

export async function getTreasuryBalance(): Promise<bigint> {
  const account = await getTreasuryAccount()
  const balance = await account.getTokenBalance(USDT_SEPOLIA)
  return BigInt(balance.toString())
}

export async function getEthBalance(): Promise<bigint> {
  const account = await getTreasuryAccount()
  const balance = await account.getBalance()
  return BigInt(balance.toString())
}

/**
 * Batch check multiple token balances in one call
 * Returns USDT (escrow) + Aave USDT balances for the treasury
 */
export async function getTreasuryTokenBalances(): Promise<{
  usdt: string
  aaveUsdt: string
  eth: string
}> {
  const account = await getTreasuryAccount()

  // Use batch getTokenBalances for efficiency (single RPC call for tokens)
  const [tokenBalances, ethBalance] = await Promise.all([
    account.getTokenBalances([USDT_SEPOLIA, AAVE_SEPOLIA.usdt]),
    account.getBalance(),
  ])

  return {
    usdt: (tokenBalances[USDT_SEPOLIA] || 0n).toString(),
    aaveUsdt: (tokenBalances[AAVE_SEPOLIA.usdt] || 0n).toString(),
    eth: ethBalance.toString(),
  }
}
