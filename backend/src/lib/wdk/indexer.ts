/**
 * WDK Indexer API - Transaction monitoring on Sepolia
 * Tracks USDT balances and transfer history across all wallets
 */

import { WdkIndexerClient } from '@tetherto/wdk-indexer-http'

let indexerInstance: InstanceType<typeof WdkIndexerClient> | null = null

function getIndexer(): InstanceType<typeof WdkIndexerClient> | null {
  if (indexerInstance) return indexerInstance
  const apiKey = process.env.WDK_INDEXER_API_KEY
  if (!apiKey) {
    return null
  }
  try {
    indexerInstance = new WdkIndexerClient({ apiKey })
    return indexerInstance
  } catch (error) {
    console.warn('[Indexer] Failed to initialize:', error)
    return null
  }
}

export async function getIndexerBalance(address: string): Promise<string | null> {
  const indexer = getIndexer()
  if (!indexer) return null
  try {
    const result = await indexer.getTokenBalance({ blockchain: 'ethereum-sepolia', token: 'usdt', address })
    return result?.balance?.toString() || '0'
  } catch (error) {
    console.error('[Indexer] Balance query failed:', error)
    return null
  }
}

export async function getTransferHistory(address: string, limit: number = 20): Promise<any[] | null> {
  const indexer = getIndexer()
  if (!indexer) return null
  try {
    const result = await indexer.getTokenTransfers({ blockchain: 'ethereum-sepolia', token: 'usdt', address, limit })
    return result?.transfers || []
  } catch (error) {
    console.error('[Indexer] Transfer history failed:', error)
    return null
  }
}

export async function verifyPaymentLanded(address: string, expectedAmount: string): Promise<boolean> {
  const transfers = await getTransferHistory(address, 5)
  if (!transfers) return false
  return transfers.some((t: any) => t.to?.toLowerCase() === address.toLowerCase() && t.amount === expectedAmount)
}

export async function batchCheckBalances(addresses: Array<{ blockchain: string; token: string; address: string }>): Promise<any[] | null> {
  const indexer = getIndexer()
  if (!indexer) return null
  try {
    return await indexer.getBatchTokenBalances(addresses)
  } catch (error) {
    console.error('[Indexer] Batch balance failed:', error)
    return null
  }
}
