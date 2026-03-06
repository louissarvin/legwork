import { describe, it, expect } from 'bun:test'
import { calculateDistance, verifyLocation } from '../lib/verification/gps.ts'
import { extractExifData } from '../lib/verification/exif.ts'

describe('GPS Verification', () => {
  it('should calculate distance between two points', () => {
    // New York City to nearby point (~1km)
    const distance = calculateDistance(40.7128, -74.0060, 40.7218, -74.0060)
    expect(distance).toBeGreaterThan(900)
    expect(distance).toBeLessThan(1100)
  })

  it('should pass location within radius', () => {
    const result = verifyLocation(40.7128, -74.0060, 40.7130, -74.0062, 100)
    expect(result.passed).toBe(true)
    expect(result.distanceMeters).toBeLessThan(100)
  })

  it('should fail location outside radius', () => {
    const result = verifyLocation(40.7128, -74.0060, 40.7228, -74.0160, 100)
    expect(result.passed).toBe(false)
    expect(result.distanceMeters).toBeGreaterThan(100)
  })

  it('should handle same coordinates', () => {
    const result = verifyLocation(40.7128, -74.0060, 40.7128, -74.0060, 100)
    expect(result.passed).toBe(true)
    expect(result.distanceMeters).toBe(0)
  })
})

describe('EXIF Extraction', () => {
  it('should handle buffer without EXIF data', () => {
    // Minimal JPEG header
    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
    const result = extractExifData(buffer)
    expect(result.timestamp).toBeNull()
    expect(result.gps.lat).toBeNull()
    expect(result.gps.lon).toBeNull()
    expect(result.isEdited).toBe(false)
  })
})
