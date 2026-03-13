/**
 * WDK Message Signing for Worker Authentication
 * Workers sign messages with their wallet to prove identity (no JWT needed)
 */

import { getWdk } from './setup.ts'
import { ethers } from 'ethers'

export async function signMessage(accountIndex: number, message: string): Promise<string> {
  const wdk = getWdk()
  const account = await wdk.getAccount('sepolia', accountIndex)
  return account.sign(message)
}

export async function verifySignature(message: string, signature: string, expectedAddress: string): Promise<boolean> {
  try {
    const recovered = ethers.verifyMessage(message, signature)
    return recovered.toLowerCase() === expectedAddress.toLowerCase()
  } catch {
    return false
  }
}

export function generateAuthChallenge(walletAddress: string): string {
  const nonce = Math.random().toString(36).substring(2, 15)
  const timestamp = Date.now()
  return `Legwork auth: ${walletAddress} nonce=${nonce} ts=${timestamp}`
}
