/**
 * WDK Read-Only Account Monitoring
 * Monitor any address's balance without needing its private key
 * Uses ethers.js for read-only queries (no WDK seed needed)
 */

import { ethers } from 'ethers'
import { SEPOLIA_CONFIG } from '../../config/chains.ts'
import { USDT_SEPOLIA } from '../../config/contracts.ts'

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)']

let providerInstance: ethers.JsonRpcProvider | null = null

function getProvider(): ethers.JsonRpcProvider {
  if (!providerInstance) {
    providerInstance = new ethers.JsonRpcProvider(SEPOLIA_CONFIG.rpcUrl)
  }
  return providerInstance
}

export async function getAddressBalance(address: string): Promise<{ eth: string; usdt: string }> {
  const provider = getProvider()
  const usdtContract = new ethers.Contract(USDT_SEPOLIA, ERC20_ABI, provider)

  const [ethBalance, usdtBalance] = await Promise.all([
    provider.getBalance(address),
    usdtContract.balanceOf(address),
  ])

  return {
    eth: ethBalance.toString(),
    usdt: usdtBalance.toString(),
  }
}

/**
 * Batch monitor escrow balances using Promise.all for parallel RPC calls
 * More efficient than sequential per-address queries
 */
export async function monitorEscrowBalances(
  escrowAddresses: string[]
): Promise<Array<{ address: string; usdt: string }>> {
  if (escrowAddresses.length === 0) return []

  const provider = getProvider()
  const usdtContract = new ethers.Contract(USDT_SEPOLIA, ERC20_ABI, provider)

  // Batch all balance queries in parallel
  const balancePromises = escrowAddresses.map(address =>
    usdtContract.balanceOf(address)
      .then((balance: bigint) => ({ address, usdt: balance.toString() }))
      .catch(() => ({ address, usdt: '0' }))
  )

  return Promise.all(balancePromises)
}

export async function checkWorkerBalance(
  workerAddress: string
): Promise<{ eth: string; usdt: string; hasGas: boolean }> {
  const balance = await getAddressBalance(workerAddress)
  return {
    ...balance,
    hasGas: BigInt(balance.eth) > 0n,
  }
}

/**
 * Check multiple token balances for a single address
 * Useful for monitoring treasury across USDT variants
 */
export async function getMultiTokenBalance(
  address: string,
  tokenAddresses: string[]
): Promise<Record<string, string>> {
  const provider = getProvider()
  const result: Record<string, string> = {}

  const promises = tokenAddresses.map(async token => {
    const contract = new ethers.Contract(token, ERC20_ABI, provider)
    try {
      const balance = await contract.balanceOf(address)
      result[token] = balance.toString()
    } catch {
      result[token] = '0'
    }
  })

  await Promise.all(promises)
  return result
}
