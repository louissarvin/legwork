import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337'
import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm'
import { SEPOLIA_CONFIG, SEPOLIA_ERC4337_CONFIG } from '../../config/chains.ts'

// Multi-chain wallet managers (loaded dynamically)
let WalletManagerBtc: any = null
let WalletManagerTon: any = null
let WalletManagerTron: any = null
let VeloraProtocol: any = null
let Usdt0BridgeProtocol: any = null

try { WalletManagerBtc = (await import('@tetherto/wdk-wallet-btc')).default } catch {}
try { WalletManagerTon = (await import('@tetherto/wdk-wallet-ton')).default } catch {}
try { WalletManagerTron = (await import('@tetherto/wdk-wallet-tron')).default } catch {}
try { VeloraProtocol = (await import('@tetherto/wdk-protocol-swap-velora-evm')).default } catch {}
try { Usdt0BridgeProtocol = (await import('@tetherto/wdk-protocol-bridge-usdt0-evm')).default } catch {}

let wdkInstance: WDK | null = null

// Track which chains are registered
export const registeredChains: string[] = []

export function getWdk(): WDK {
  if (wdkInstance) return wdkInstance

  const seed = process.env.WDK_SEED
  if (!seed) throw new Error('WDK_SEED environment variable is required')

  const wdk = new WDK(seed)
    // Primary: Ethereum Sepolia (treasury + escrow)
    .registerWallet('sepolia', WalletManagerEvm, {
      provider: SEPOLIA_CONFIG.rpcUrl,
    })
    // Gasless: ERC-4337 Smart Accounts (worker payouts)
    .registerWallet('sepolia-aa', WalletManagerEvmErc4337, SEPOLIA_ERC4337_CONFIG)
    // Aave V3 lending (yield on idle treasury)
    .registerProtocol('sepolia', 'aave', AaveProtocolEvm)

  registeredChains.push('ethereum-sepolia', 'ethereum-sepolia-erc4337')

  // Multi-chain wallets: same seed, different BIP-44 derivation paths
  // Addresses are deterministic and verifiable even without transacting

  // Ethereum Mainnet (for XAU₮ gold reserve + USDT operations)
  try {
    wdk.registerWallet('ethereum', WalletManagerEvm, {
      provider: 'https://rpc.mevblocker.io/fast',
    })
    registeredChains.push('ethereum-mainnet')
  } catch {}

  // Arbitrum One (L2, low gas, USDT0 bridging destination)
  try {
    wdk.registerWallet('arbitrum', WalletManagerEvm, {
      provider: 'https://arb1.arbitrum.io/rpc',
    })
    registeredChains.push('arbitrum')
  } catch {}

  // Bitcoin (BTC treasury reserve, Lightning-ready)
  if (WalletManagerBtc) {
    try {
      wdk.registerWallet('bitcoin', WalletManagerBtc, { network: 'bitcoin' })
      registeredChains.push('bitcoin')
    } catch {}
  }

  // TON (Telegram-native payments, USDT on TON)
  if (WalletManagerTon) {
    try {
      wdk.registerWallet('ton', WalletManagerTon, { network: 'mainnet' })
      registeredChains.push('ton')
    } catch {}
  }

  // Tron (highest USDT volume chain globally)
  if (WalletManagerTron) {
    try {
      wdk.registerWallet('tron', WalletManagerTron, { network: 'mainnet' })
      registeredChains.push('tron')
    } catch {}
  }

  // Register mainnet DeFi protocols
  if (VeloraProtocol) {
    try { wdk.registerProtocol('ethereum', 'velora', VeloraProtocol) } catch {}
    try { wdk.registerProtocol('arbitrum', 'velora', VeloraProtocol) } catch {}
  }
  if (Usdt0BridgeProtocol) {
    try { wdk.registerProtocol('ethereum', 'usdt0', Usdt0BridgeProtocol) } catch {}
    try { wdk.registerProtocol('arbitrum', 'usdt0', Usdt0BridgeProtocol) } catch {}
  }

  wdkInstance = wdk
  console.log(`[WDK] Initialized with ${registeredChains.length} chains: ${registeredChains.join(', ')}`)
  return wdkInstance
}

export function disposeWdk(): void {
  if (wdkInstance) {
    wdkInstance.dispose()
    wdkInstance = null
  }
}

export function generateWorkerSeed(): string {
  return WDK.getRandomSeedPhrase()
}

// Get wallet address for any registered chain
export async function getChainAddress(chain: string): Promise<string | null> {
  try {
    const wdk = getWdk()
    const account = await wdk.getAccount(chain, 0)
    return account.getAddress()
  } catch {
    return null
  }
}

// Get all multi-chain treasury addresses
export async function getAllTreasuryAddresses(): Promise<Record<string, string>> {
  const addresses: Record<string, string> = {}
  for (const chain of registeredChains) {
    if (chain.includes('erc4337')) continue // Skip AA wallets
    const addr = await getChainAddress(chain).catch(() => null)
    if (addr) addresses[chain] = addr
  }
  return addresses
}
