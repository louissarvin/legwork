/**
 * Ethereum Attestation Service (EAS) Integration
 * Creates on-chain proofs for completed tasks on Sepolia
 *
 * EAS Contract (Sepolia): 0xC2679fBD37d54388Ce493F1DB75320D236e1815e
 * SchemaRegistry (Sepolia): 0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0
 * Explorer: https://sepolia.easscan.org
 */

import { EAS, SchemaEncoder, SchemaRegistry } from '@ethereum-attestation-service/eas-sdk'
import { ethers } from 'ethers'
import { getWdk } from '../wdk/setup.ts'
import { SEPOLIA_CONFIG } from '../../config/chains.ts'

// EAS Sepolia v0.26 addresses
const EAS_ADDRESS = '0xC2679fBD37d54388Ce493F1DB75320D236e1815e'
const SCHEMA_REGISTRY_ADDRESS = '0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0'

// Our attestation schema
const SCHEMA_STRING = 'string taskId, address worker, bool verified, uint256 amount, uint8 verificationScore, string photoIpfsHash, string payoutTxHash'

// Cache the schema UID after first registration
let cachedSchemaUid: string | null = process.env.EAS_SCHEMA_UID || null

async function getEasSigner(): Promise<ethers.Wallet> {
  const wdk = getWdk()
  const account = await wdk.getAccount('sepolia', 0)

  // Get private key from WDK account
  // WDK accounts expose keyPair with privateKey
  const keyPair = (account as any).keyPair
  if (!keyPair?.privateKey) {
    throw new Error('Cannot extract private key from WDK account for EAS signing')
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_CONFIG.rpcUrl)
  return new ethers.Wallet(ethers.hexlify(keyPair.privateKey), provider)
}

export async function registerSchema(): Promise<string> {
  if (cachedSchemaUid) return cachedSchemaUid

  const signer = await getEasSigner()
  const registry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS)
  registry.connect(signer)

  const tx = await registry.register({
    schema: SCHEMA_STRING,
    resolverAddress: '0x0000000000000000000000000000000000000000',
    revocable: true,
  })

  const uid = await tx.wait()
  cachedSchemaUid = uid
  console.log(`[EAS] Schema registered: ${uid}`)
  console.log(`[EAS] View at: https://sepolia.easscan.org/schema/view/${uid}`)
  return uid
}

export async function createTaskAttestation(params: {
  taskId: string
  workerAddress: string
  verified: boolean
  amount: bigint
  verificationScore: number
  photoIpfsHash: string
  payoutTxHash: string
}): Promise<{ uid: string; txHash: string; explorerUrl: string }> {
  const schemaUid = cachedSchemaUid || process.env.EAS_SCHEMA_UID
  if (!schemaUid) {
    throw new Error('EAS schema not registered. Call registerSchema() first or set EAS_SCHEMA_UID env var.')
  }

  const signer = await getEasSigner()
  const eas = new EAS(EAS_ADDRESS)
  eas.connect(signer)

  const encoder = new SchemaEncoder(SCHEMA_STRING)
  const encodedData = encoder.encodeData([
    { name: 'taskId', value: params.taskId, type: 'string' },
    { name: 'worker', value: params.workerAddress, type: 'address' },
    { name: 'verified', value: params.verified, type: 'bool' },
    { name: 'amount', value: params.amount, type: 'uint256' },
    { name: 'verificationScore', value: params.verificationScore, type: 'uint8' },
    { name: 'photoIpfsHash', value: params.photoIpfsHash || '', type: 'string' },
    { name: 'payoutTxHash', value: params.payoutTxHash || '', type: 'string' },
  ])

  const tx = await eas.attest({
    schema: schemaUid,
    data: {
      recipient: params.workerAddress,
      expirationTime: 0n,
      revocable: true,
      data: encodedData,
    },
  })

  const uid = await tx.wait()

  return {
    uid,
    txHash: tx.tx.hash,
    explorerUrl: `https://sepolia.easscan.org/attestation/view/${uid}`,
  }
}

export function getSchemaUid(): string | null {
  return cachedSchemaUid || process.env.EAS_SCHEMA_UID || null
}

export const EAS_CONFIG = {
  address: EAS_ADDRESS,
  schemaRegistry: SCHEMA_REGISTRY_ADDRESS,
  schema: SCHEMA_STRING,
  explorer: 'https://sepolia.easscan.org',
  network: 'sepolia',
}
