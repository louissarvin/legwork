import WDK from '@tetherto/wdk'
import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337'
import { SEPOLIA_ERC4337_CONFIG } from '../../config/chains.ts'
import { encryptSeedPhrase, type EncryptedSeed } from './secrets.ts'

export async function createWorkerWallet(): Promise<{
  seedPhrase: string
  address: string
  encryptedSeed: EncryptedSeed
}> {
  const seedPhrase = WDK.getRandomSeedPhrase()
  const address = await getWorkerAddress(seedPhrase)
  const encryptedSeed = encryptSeedPhrase(seedPhrase)

  return { seedPhrase, address, encryptedSeed }
}

export async function getWorkerAddress(seedPhrase: string): Promise<string> {
  const wdk = new WDK(seedPhrase)
    .registerWallet('sepolia-aa', WalletManagerEvmErc4337, SEPOLIA_ERC4337_CONFIG)

  try {
    const account = await wdk.getAccount('sepolia-aa', 0)
    return account.getAddress()
  } finally {
    wdk.dispose()
  }
}
