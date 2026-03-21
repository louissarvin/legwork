import { getWdk } from './setup.ts'
import { USDT_SEPOLIA, PLATFORM_FEE_BPS, BPS_BASE } from '../../config/contracts.ts'

// Each task gets a unique escrow account by incrementing index
// Account 0 = treasury, Account 1+ = escrow per task
export async function getEscrowAccount(taskIndex: number) {
  const wdk = getWdk()
  // Offset by 1 so account 0 is always treasury
  return wdk.getAccount('sepolia', taskIndex + 1)
}

export async function getEscrowAddress(taskIndex: number): Promise<string> {
  const account = await getEscrowAccount(taskIndex)
  return account.getAddress()
}

export async function getEscrowBalance(taskIndex: number): Promise<bigint> {
  const account = await getEscrowAccount(taskIndex)
  const balance = await account.getTokenBalance(USDT_SEPOLIA)
  return BigInt(balance.toString())
}

export async function lockEscrow(taskIndex: number, amount: bigint): Promise<string> {
  const wdk = getWdk()
  const treasury = await wdk.getAccount('sepolia', 0)
  const escrow = await getEscrowAccount(taskIndex)
  const escrowAddress = await escrow.getAddress()

  // Auto-fund escrow wallet with ETH for gas (needed to release payout later)
  try {
    const escrowEthBalance = await escrow.getBalance()
    if (BigInt(escrowEthBalance.toString()) < 3000000000000000n) { // < 0.003 ETH
      await treasury.sendTransaction({
        to: escrowAddress,
        value: 5000000000000000n, // 0.005 ETH for gas
      })
    }
  } catch (e) {
    console.warn('[Escrow] Failed to fund escrow with ETH:', e)
  }

  const result = await treasury.transfer({
    token: USDT_SEPOLIA,
    recipient: escrowAddress,
    amount: amount,
  })

  return result.hash
}

export async function releaseEscrow(
  taskIndex: number,
  workerAddress: string,
  totalAmount: bigint
): Promise<{ workerTxHash: string; feeTxHash: string; workerPayout: bigint; platformFee: bigint }> {
  const escrow = await getEscrowAccount(taskIndex)

  // Calculate fee split
  const platformFee = (totalAmount * PLATFORM_FEE_BPS) / BPS_BASE
  const workerPayout = totalAmount - platformFee

  // Pay worker
  const workerResult = await escrow.transfer({
    token: USDT_SEPOLIA,
    recipient: workerAddress,
    amount: workerPayout,
  })

  // Send fee to treasury (account 0)
  const wdk = getWdk()
  const treasury = await wdk.getAccount('sepolia', 0)
  const treasuryAddress = await treasury.getAddress()

  const feeResult = await escrow.transfer({
    token: USDT_SEPOLIA,
    recipient: treasuryAddress,
    amount: platformFee,
  })

  return {
    workerTxHash: workerResult.hash,
    feeTxHash: feeResult.hash,
    workerPayout,
    platformFee,
  }
}

export async function refundEscrow(taskIndex: number): Promise<string> {
  const escrow = await getEscrowAccount(taskIndex)
  const balance = await getEscrowBalance(taskIndex)

  if (balance <= 0n) throw new Error('No funds in escrow to refund')

  const wdk = getWdk()
  const treasury = await wdk.getAccount('sepolia', 0)
  const treasuryAddress = await treasury.getAddress()

  const result = await escrow.transfer({
    token: USDT_SEPOLIA,
    recipient: treasuryAddress,
    amount: balance,
  })

  return result.hash
}

export async function quoteEscrowLock(taskIndex: number, amount: bigint): Promise<{ fee: string; escrowAddress: string }> {
  const wdk = getWdk()
  const treasury = await wdk.getAccount('sepolia', 0)
  const escrow = await getEscrowAccount(taskIndex)
  const escrowAddress = await escrow.getAddress()

  const quote = await treasury.quoteTransfer({
    token: USDT_SEPOLIA,
    recipient: escrowAddress,
    amount: amount,
  })

  return {
    fee: quote.fee?.toString() || '0',
    escrowAddress,
  }
}
