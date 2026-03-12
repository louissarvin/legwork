import { BitfinexPricingClient } from '@tetherto/wdk-pricing-bitfinex-http'

let pricingInstance: InstanceType<typeof BitfinexPricingClient> | null = null

function getPricingClient(): InstanceType<typeof BitfinexPricingClient> | null {
  try {
    if (!pricingInstance) {
      pricingInstance = new BitfinexPricingClient()
    }
    return pricingInstance
  } catch (error) {
    console.warn('[Pricing] Failed to initialize BitfinexPricingClient:', error)
    return null
  }
}

export async function getCurrentPrice(base: string, quote: string): Promise<number | null> {
  const client = getPricingClient()
  if (!client) return null
  try {
    return await client.getCurrentPrice(base, quote)
  } catch (error) {
    console.error('[Pricing] Error fetching price:', error)
    return null
  }
}

export async function getUsdtPrice(): Promise<number> {
  const price = await getCurrentPrice('UST', 'USD')
  return price || 1.0
}

export async function calculateTaskPrice(params: {
  baseRateUsd: number
  urgency: 'normal' | 'urgent' | 'emergency'
  pendingTasks: number
  availableWorkers: number
}): Promise<{ priceUsdt: number; priceBaseUnits: string; surgeMultiplier: number }> {
  const urgencyMultiplier = { normal: 1.0, urgent: 1.5, emergency: 3.0 }

  // Supply/demand surge (capped at 5x)
  const demandRatio = params.pendingTasks / Math.max(params.availableWorkers, 1)
  const surgeMultiplier = Math.max(1.0, Math.min(demandRatio, 5.0))

  const finalUsd = params.baseRateUsd * urgencyMultiplier[params.urgency] * surgeMultiplier

  // Convert USD to USDT (usually 1:1 but check)
  const usdtRate = await getUsdtPrice()
  const priceUsdt = finalUsd / usdtRate

  // Convert to base units (6 decimals)
  const priceBaseUnits = Math.floor(priceUsdt * 1e6).toString()

  return { priceUsdt, priceBaseUnits, surgeMultiplier }
}
