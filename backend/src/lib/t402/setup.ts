/**
 * t402 Protocol Integration
 *
 * t402 is Tether's HTTP payment protocol using USDT0 via EIP-3009.
 * Uses @t402/fastify middleware for native Fastify support.
 *
 * Network strategy:
 * - Testnet: Ethereum Sepolia (matches our WDK wallet chain)
 * - Mainnet: Ethereum / Arbitrum with USDT0
 *
 * The t402 facilitator (facilitator.t402.io) handles verification and
 * settlement. On Sepolia, we demonstrate the 402 challenge-response
 * architecture. On mainnet, USDT0 payments settle via EIP-3009
 * transferWithAuthorization (gasless for the payer).
 *
 * @see https://docs.t402.io
 */

export interface T402EndpointConfig {
  price: string
  network: string
  payTo: string
  description: string
  scheme: string
}

// Ethereum Sepolia (same chain as our WDK wallets)
export const T402_NETWORK = 'eip155:11155111' // Ethereum Sepolia
export const T402_MAINNET_NETWORK = 'eip155:1' // Ethereum Mainnet (production)
export const T402_FACILITATOR = 'https://facilitator.t402.io'

export const T402_ENDPOINTS: Record<string, Omit<T402EndpointConfig, 'payTo'>> = {
  'POST /t402/verify': {
    price: '$0.25',
    network: T402_NETWORK,
    description: 'AI-powered task completion verification (GPS + photo + EXIF)',
    scheme: 'exact',
  },
  'GET /t402/reputation/:address': {
    price: '$0.10',
    network: T402_NETWORK,
    description: 'Query on-chain verified worker reputation score',
    scheme: 'exact',
  },
  'GET /t402/analytics': {
    price: '$1.00',
    network: T402_NETWORK,
    description: 'Platform analytics and task completion data',
    scheme: 'exact',
  },
}

/**
 * t402 Payment Flow:
 *
 * 1. Client sends HTTP request to paywalled endpoint
 * 2. Server responds with 402 + PAYMENT-REQUIRED header
 * 3. Client signs EIP-3009 transferWithAuthorization (gasless)
 * 4. Client retries with PAYMENT-SIGNATURE header
 * 5. Facilitator verifies signature and settles on-chain
 * 6. Server returns the resource
 *
 * Integration with WDK:
 * - Server uses WDK wallet address as payTo (treasury receives payments)
 * - Client uses @t402/wdk T402WDK signer for automatic payment
 * - @t402/fastify middleware handles the 402 challenge-response flow
 */

export function getPaymentRequiredResponse(endpoint: string, payToAddress: string) {
  const config = T402_ENDPOINTS[endpoint]
  if (!config) return null

  return {
    status: 402 as const,
    headers: {
      'X-Payment-Required': JSON.stringify({
        ...config,
        payTo: payToAddress,
      }),
    },
    body: {
      message: 'Payment required to access this endpoint',
      protocol: 't402',
      facilitator: T402_FACILITATOR,
      paymentRequired: {
        ...config,
        payTo: payToAddress,
      },
      wdkIntegration: {
        clientPackage: '@t402/wdk',
        serverPackage: '@t402/fastify',
        signerMethod: 'T402WDK.getSigner(chain)',
      },
    },
  }
}
