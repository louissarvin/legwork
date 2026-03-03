import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto'

const PASSKEY = process.env.SECRET_PASSKEY
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const SALT_LENGTH = 16
const ITERATIONS = 100_000
const DIGEST = 'sha256'
const AUTH_TAG_LENGTH = 16

export interface EncryptedSeed {
  encryptedData: string // hex-encoded: iv + authTag + ciphertext
  salt: string          // hex-encoded salt
}

function deriveKey(passkey: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passkey, salt, ITERATIONS, KEY_LENGTH, DIGEST)
}

export function encryptSeedPhrase(seedPhrase: string): EncryptedSeed {
  const salt = randomBytes(SALT_LENGTH)
  const key = deriveKey(PASSKEY, salt)
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(seedPhrase, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Pack: iv + authTag + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted])

  return {
    encryptedData: packed.toString('hex'),
    salt: salt.toString('hex'),
  }
}

export function decryptSeedPhrase(encrypted: EncryptedSeed): string {
  const salt = Buffer.from(encrypted.salt, 'hex')
  const packed = Buffer.from(encrypted.encryptedData, 'hex')

  const key = deriveKey(PASSKEY, salt)
  const iv = packed.subarray(0, IV_LENGTH)
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  return decrypted.toString('utf8')
}
