#!/usr/bin/env bun
/**
 * Legwork Treasury Setup Script
 *
 * Derives the treasury address from WDK_SEED, checks balances,
 * and provides funding instructions.
 *
 * Usage: bun scripts/setup-treasury.ts
 */

import '../dotenv.ts'
import WDK from '@tetherto/wdk'
import { ethers } from 'ethers'

const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
const USDT_SEPOLIA = '0xd077a400968890eacc75cdc901f0356c943e4fdb'
const AAVE_USDT_SEPOLIA = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0'
const AAVE_FAUCET = '0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D'

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)']
const FAUCET_ABI = ['function mint(address token, address to, uint256 amount) external']

async function main() {
  const seed = process.env.WDK_SEED
  if (!seed) {
    console.error('ERROR: WDK_SEED not set in .env')
    process.exit(1)
  }

  console.log('=== Legwork Treasury Setup ===\n')

  // Derive treasury address from seed (account 0)
  const wdk = new WDK(seed)
  const WalletManagerEvm = (await import('@tetherto/wdk-wallet-evm')).default
  wdk.registerWallet('sepolia', WalletManagerEvm, { provider: SEPOLIA_RPC })

  const account = await wdk.getAccount('sepolia', 0)
  const treasuryAddress = await account.getAddress()

  console.log(`Treasury Address: ${treasuryAddress}`)
  console.log(`Etherscan: https://sepolia.etherscan.io/address/${treasuryAddress}\n`)

  // Check balances (sequential to avoid batch RPC limits)
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC)

  console.log('Checking balances...\n')

  let ethBalance = 0n
  let usdtBalance = 0n
  let aaveUsdtBalance = 0n

  try {
    ethBalance = await provider.getBalance(treasuryAddress)
  } catch (e) {
    console.log('  ETH balance check failed (RPC issue)')
  }

  try {
    const usdtContract = new ethers.Contract(USDT_SEPOLIA, ERC20_ABI, provider)
    usdtBalance = await usdtContract.balanceOf(treasuryAddress)
  } catch (e) {
    console.log('  USDT balance check failed')
  }

  try {
    const aaveContract = new ethers.Contract(AAVE_USDT_SEPOLIA, ERC20_ABI, provider)
    aaveUsdtBalance = await aaveContract.balanceOf(treasuryAddress)
  } catch (e) {
    console.log('  Aave USDT balance check failed')
  }

  console.log('--- Current Balances ---')
  console.log(`  ETH:        ${ethers.formatEther(ethBalance)} ETH`)
  console.log(`  WDK USDT:   ${Number(usdtBalance) / 1e6} USDT`)
  console.log(`  Aave USDT:  ${ethers.formatUnits(aaveUsdtBalance, 18)} USDT`)
  console.log('')

  // Check what's needed
  const needsEth = ethBalance === 0n
  const needsUsdt = usdtBalance === 0n
  const needsAaveUsdt = aaveUsdtBalance === 0n

  if (!needsEth && !needsUsdt && !needsAaveUsdt) {
    console.log('Treasury is funded! Start the server: bun dev\n')
    wdk.dispose()
    return
  }

  console.log('--- Funding Instructions ---\n')
  console.log(`Copy this address: ${treasuryAddress}\n`)

  if (needsEth) {
    console.log('STEP 1: Get Sepolia ETH (for gas)')
    console.log('  Google Cloud: https://cloud.google.com/application/web3/faucet/ethereum/sepolia')
    console.log('  Alchemy:      https://www.alchemy.com/faucets/ethereum-sepolia')
    console.log('  PoW Faucet:   https://sepolia-faucet.pk910.de/')
    console.log('')
  }

  if (needsUsdt) {
    console.log('STEP 2: Get WDK test USDT (for escrow payments)')
    console.log('  Pimlico:  https://dashboard.pimlico.io/test-erc20-faucet')
    console.log('  Candide:  https://dashboard.candide.dev/faucet')
    console.log('')
  }

  if (needsAaveUsdt) {
    if (!needsEth) {
      console.log('STEP 3: Minting Aave test USDT automatically...')
      try {
        const keyPair = (account as any).keyPair
        if (keyPair?.privateKey) {
          const signer = new ethers.Wallet(ethers.hexlify(keyPair.privateKey), provider)
          const faucet = new ethers.Contract(AAVE_FAUCET, FAUCET_ABI, signer)
          const mintAmount = ethers.parseUnits('10000', 18)
          const tx = await faucet.mint(AAVE_USDT_SEPOLIA, treasuryAddress, mintAmount)
          console.log(`  Tx: https://sepolia.etherscan.io/tx/${tx.hash}`)
          await tx.wait()
          console.log('  Done! Minted 10,000 Aave test USDT')
        }
      } catch (error) {
        console.log(`  Auto-mint failed: ${error instanceof Error ? error.message : error}`)
        console.log('  Use UI instead: https://staging.aave.com/faucet/')
      }
    } else {
      console.log('STEP 3: Get Aave test USDT')
      console.log('  Fund ETH first, then re-run this script to auto-mint')
      console.log('  Or use: https://staging.aave.com/faucet/')
    }
    console.log('')
  }

  // Derive escrow addresses for reference
  const escrow1 = await wdk.getAccount('sepolia', 1)
  console.log('--- Reference ---')
  console.log(`  Treasury (account 0):  ${treasuryAddress}`)
  console.log(`  Escrow #1 (account 1): ${await escrow1.getAddress()}`)
  console.log('')

  wdk.dispose()
}

main().catch(console.error)
