/**
 * WDK Indexer API - Transaction monitoring on Sepolia
 * Uses @tetherto/wdk-indexer-http when available, falls back to direct HTTP calls
 * Tracks USDT balances and transfer history across all wallets
 */

const INDEXER_BASE_URL = 'https://wdk-api.tether.io/api/v1'

// Try to load WDK Indexer package, fall back to direct HTTP
let WdkIndexerClient: any = null
try {
  const mod = await import('@tetherto/wdk-indexer-http')
  WdkIndexerClient = mod.WdkIndexerClient || mod.default || Object.values(mod)[0]
  console.log('[Indexer] Using @tetherto/wdk-indexer-http')
} catch {
  console.log('[Indexer] Package not available, using direct HTTP to wdk-api.tether.io')
}

function getApiKey(): string | null {
  return process.env.WDK_INDEXER_API_KEY || process.env.PUBLIC_INDEXER_API_KEY || null
}

// WDK package client (if available)
let indexerInstance: any = null

function getWdkIndexer(): any | null {
  if (!WdkIndexerClient) return null
  if (indexerInstance) return indexerInstance
  const apiKey = getApiKey()
  if (!apiKey) return null
  try {
    indexerInstance = new WdkIndexerClient({ apiKey })
    return indexerInstance
  } catch {
    return null
  }
}

// Direct HTTP fallback
async function indexerFetch(path: string): Promise<any | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null
  try {
    const res = await fetch(`${INDEXER_BASE_URL}${path}`, {
      headers: { 'x-api-key': apiKey },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getIndexerBalance(address: string): Promise<string | null> {
  // Try WDK package first
  const indexer = getWdkIndexer()
  if (indexer) {
    try {
      const result = await indexer.getTokenBalance({ blockchain: 'ethereum-sepolia', token: 'usdt', address })
      return result?.balance?.toString() || '0'
    } catch {}
  }
  // Fallback: direct HTTP
  const result = await indexerFetch(`/sepolia/usdt/${address}/token-balances`)
  return result?.balance?.toString() || null
}

export async function getTransferHistory(address: string, limit: number = 20): Promise<any[] | null> {
  const indexer = getWdkIndexer()
  if (indexer) {
    try {
      const result = await indexer.getTokenTransfers({ blockchain: 'ethereum-sepolia', token: 'usdt', address, limit })
      return result?.transfers || []
    } catch {}
  }
  const result = await indexerFetch(`/sepolia/usdt/${address}/token-transfers?limit=${limit}`)
  return result?.transfers || null
}

export async function verifyPaymentLanded(address: string, expectedAmount: string): Promise<boolean> {
  const transfers = await getTransferHistory(address, 5)
  if (!transfers) return false
  return transfers.some((t: any) => t.to?.toLowerCase() === address.toLowerCase() && t.amount === expectedAmount)
}

export async function batchCheckBalances(addresses: Array<{ blockchain: string; token: string; address: string }>): Promise<any[] | null> {
  const indexer = getWdkIndexer()
  if (indexer) {
    try {
      return await indexer.getBatchTokenBalances(addresses)
    } catch {}
  }
  const apiKey = getApiKey()
  if (!apiKey) return null
  try {
    const res = await fetch(`${INDEXER_BASE_URL}/batch/token-balances`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(addresses),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
