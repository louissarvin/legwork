import { createHash } from 'crypto'

/**
 * Generate SHA-256 hash of photo bytes for duplicate detection.
 *
 * Input: base64-encoded photo string (as received from the client)
 * Output: hex-encoded SHA-256 hash
 *
 * The hash is computed from the raw photo bytes (after base64 decode),
 * not from the base64 string itself. This means the same photo sent
 * with different base64 line wrapping still produces the same hash.
 */
export function hashPhoto(photoBase64: string): string {
  const buffer = Buffer.from(photoBase64, 'base64')
  return createHash('sha256').update(buffer).digest('hex')
}
