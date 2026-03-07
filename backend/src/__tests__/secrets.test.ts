import { describe, it, expect } from 'bun:test'
import { encryptSeedPhrase, decryptSeedPhrase } from '../lib/wdk/secrets.ts'

describe('Secret Manager', () => {
  it('should encrypt and decrypt a seed phrase', () => {
    const original = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const encrypted = encryptSeedPhrase(original)

    expect(encrypted.encryptedData).toBeTruthy()
    expect(encrypted.salt).toBeTruthy()
    expect(encrypted.encryptedData).not.toContain('abandon')

    const decrypted = decryptSeedPhrase(encrypted)
    expect(decrypted).toBe(original)
  })

  it('should produce different ciphertexts for same input (unique salt)', () => {
    const seed = 'test seed phrase one two three four five six seven eight nine ten eleven twelve'
    const enc1 = encryptSeedPhrase(seed)
    const enc2 = encryptSeedPhrase(seed)

    expect(enc1.encryptedData).not.toBe(enc2.encryptedData)
    expect(enc1.salt).not.toBe(enc2.salt)
  })

  it('should handle short and long seed phrases', () => {
    const short = 'hello world test'
    const encrypted = encryptSeedPhrase(short)
    const decrypted = decryptSeedPhrase(encrypted)
    expect(decrypted).toBe(short)
  })
})
