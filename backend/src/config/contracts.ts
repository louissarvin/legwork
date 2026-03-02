// Token addresses on Sepolia
export const USDT_SEPOLIA = '0xd077a400968890eacc75cdc901f0356c943e4fdb'

// Aave V3 Sepolia
export const AAVE_SEPOLIA = {
  pool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
  usdt: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // Aave's test USDT
  faucet: '0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D',
}

// Platform constants
export const PLATFORM_FEE_BPS = 500n // 5%
export const BPS_BASE = 10000n
export const USDT_DECIMALS = 6

// Aave V3 Sepolia (use Aave's own test tokens, NOT WDK's test USDT)
export const AAVE_USDT_SEPOLIA = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0'
export const AAVE_POOL_SEPOLIA = '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951'
export const AAVE_FAUCET_SEPOLIA = '0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D'

// Idle treasury threshold for Aave supply
export const AAVE_SUPPLY_THRESHOLD = 100_000000n // 100 USDT minimum to supply

// EAS (Ethereum Attestation Service) Sepolia
export const EAS_ADDRESS = '0xC2679fBD37d54388Ce493F1DB75320D236e1815e'
export const EAS_SCHEMA_REGISTRY = '0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0'
export const EAS_EXPLORER = 'https://sepolia.easscan.org'

// Task limits
export const MAX_SINGLE_PAYOUT = 500_000000n // 500 USDT
export const MAX_DAILY_PAYOUT = 10000_000000n // 10,000 USDT
export const MIN_TASK_PAYMENT = 1_000000n // 1 USDT
export const MAX_TASK_PAYMENT = 1000_000000n // 1,000 USDT

// XAU₮ (Tether Gold) - Ethereum Mainnet ERC-20
export const XAUT_MAINNET = '0x68749665FF8D2d112Fa859AA293F07a622782F38'
export const XAUT_DECIMALS = 6

// Multi-chain USDT addresses (mainnet references)
export const USDT_CHAINS = {
  ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  tron: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  sepolia: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
}
