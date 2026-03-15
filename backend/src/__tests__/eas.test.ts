import { describe, it, expect } from 'bun:test'
import { EAS_CONFIG, getSchemaUid } from '../lib/attestation/eas.ts'

describe('EAS Attestation', () => {
  it('should have correct Sepolia contract addresses', () => {
    expect(EAS_CONFIG.address).toBe('0xC2679fBD37d54388Ce493F1DB75320D236e1815e')
    expect(EAS_CONFIG.schemaRegistry).toBe('0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0')
    expect(EAS_CONFIG.network).toBe('sepolia')
  })

  it('should have schema string with all required fields', () => {
    expect(EAS_CONFIG.schema).toContain('taskId')
    expect(EAS_CONFIG.schema).toContain('worker')
    expect(EAS_CONFIG.schema).toContain('verified')
    expect(EAS_CONFIG.schema).toContain('amount')
    expect(EAS_CONFIG.schema).toContain('verificationScore')
    expect(EAS_CONFIG.schema).toContain('photoIpfsHash')
    expect(EAS_CONFIG.schema).toContain('payoutTxHash')
  })

  it('should return schema UID from env or null', () => {
    const uid = getSchemaUid()
    // Will be null if EAS_SCHEMA_UID not set
    expect(uid === null || typeof uid === 'string').toBe(true)
  })

  it('should have explorer URL', () => {
    expect(EAS_CONFIG.explorer).toBe('https://sepolia.easscan.org')
  })
})
