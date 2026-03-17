import { describe, it, expect } from 'bun:test'
import { hashPhoto } from '../utils/photoHash.ts'

describe('Photo Duplicate Detection', () => {
  it('should produce consistent SHA-256 hash for same photo', () => {
    const photo = Buffer.from('test-photo-content-12345').toString('base64')
    const hash1 = hashPhoto(photo)
    const hash2 = hashPhoto(photo)

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA-256 hex = 64 chars
  })

  it('should produce different hashes for different photos', () => {
    const photo1 = Buffer.from('photo-content-A').toString('base64')
    const photo2 = Buffer.from('photo-content-B').toString('base64')

    const hash1 = hashPhoto(photo1)
    const hash2 = hashPhoto(photo2)

    expect(hash1).not.toBe(hash2)
  })

  it('should hash from decoded bytes, not base64 string', () => {
    // Same raw bytes but different base64 wrapping should produce same hash
    const raw = 'identical-photo-bytes'
    const b64 = Buffer.from(raw).toString('base64')

    const hash = hashPhoto(b64)
    expect(hash).toHaveLength(64)

    // Verify it's actually hashing the decoded bytes
    const { createHash } = require('crypto')
    const expected = createHash('sha256').update(Buffer.from(raw)).digest('hex')
    expect(hash).toBe(expected)
  })

  it('should handle empty photo gracefully', () => {
    const hash = hashPhoto('')
    expect(hash).toHaveLength(64) // SHA-256 of empty buffer
  })

  it('should handle large photos', () => {
    // Simulate a 1MB photo
    const largeContent = 'x'.repeat(1_000_000)
    const photo = Buffer.from(largeContent).toString('base64')
    const hash = hashPhoto(photo)

    expect(hash).toHaveLength(64)
  })

  it('should detect same photo submitted by different workers', () => {
    // Two workers submit the exact same photo file
    const sharedPhoto = Buffer.from('shared-storefront-photo-jpeg-data').toString('base64')

    const workerA_hash = hashPhoto(sharedPhoto)
    const workerB_hash = hashPhoto(sharedPhoto)

    // Both hashes are identical -> system would catch this as duplicate
    expect(workerA_hash).toBe(workerB_hash)
  })

  it('should allow genuinely different photos of same location', () => {
    // Two different photos of the same storefront (different angles, timestamps)
    const photoAngle1 = Buffer.from('storefront-photo-angle-1-timestamp-1001').toString('base64')
    const photoAngle2 = Buffer.from('storefront-photo-angle-2-timestamp-1002').toString('base64')

    const hash1 = hashPhoto(photoAngle1)
    const hash2 = hashPhoto(photoAngle2)

    // Different photos = different hashes -> both allowed
    expect(hash1).not.toBe(hash2)
  })
})
