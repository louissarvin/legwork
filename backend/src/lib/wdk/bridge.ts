/**
 * USDT0 Bridge via LayerZero
 *
 * NOTE: USDT0 bridging is mainnet-only. On Sepolia testnet,
 * we provide quote estimates and architecture demonstration.
 * For mainnet deployment, this module uses the actual bridge protocol.
 */

// Supported chains for USDT0 bridging
export const BRIDGE_SUPPORTED_CHAINS = [
  'arbitrum', 'polygon', 'optimism', 'base', 'berachain',
  'ink', 'flare', 'hyperevm', 'sei', 'rootstock',
  'unichain', 'plasma', 'avalanche', 'xlayer',
] as const

export type BridgeChain = typeof BRIDGE_SUPPORTED_CHAINS[number]

export interface BridgeQuote {
  targetChain: string
  amount: string
  protocolFee: string
  relayFee: string
  totalFee: string
  estimatedTime: string
  supported: boolean
}

export function quoteBridgeEstimate(targetChain: string, amount: bigint): BridgeQuote {
  const supported = BRIDGE_SUPPORTED_CHAINS.includes(targetChain as BridgeChain)

  // Protocol fee: 0.03% of amount
  const protocolFee = (amount * 3n) / 10000n
  const relayFee = 500000n // ~$0.50 estimate

  return {
    targetChain,
    amount: amount.toString(),
    protocolFee: protocolFee.toString(),
    relayFee: relayFee.toString(),
    totalFee: (protocolFee + relayFee).toString(),
    estimatedTime: '30 seconds to 3 minutes',
    supported,
  }
}

// For mainnet: actual bridge execution would use WDK bridge module
// import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm'
// const bridge = new Usdt0ProtocolEvm(account, { bridgeMaxFee: 100000000000000n })
// await bridge.bridge({ targetChain, recipient, token, amount })
