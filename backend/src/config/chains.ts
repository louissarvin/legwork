// Ethereum Sepolia testnet configuration
export const SEPOLIA_CONFIG = {
  chainId: 11155111,
  name: 'sepolia',
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  explorerUrl: 'https://sepolia.etherscan.io',
}

export const SEPOLIA_ERC4337_CONFIG = {
  chainId: 11155111,
  provider: 'https://ethereum-sepolia-rpc.publicnode.com',
  bundlerUrl: 'https://public.pimlico.io/v2/11155111/rpc',
  paymasterUrl: 'https://public.pimlico.io/v2/11155111/rpc',
  entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  safeModulesVersion: '0.3.0' as const,
  paymasterToken: {
    address: '0xd077a400968890eacc75cdc901f0356c943e4fdb', // WDK test USDT on Sepolia
  },
  transferMaxFee: 100000,
}
