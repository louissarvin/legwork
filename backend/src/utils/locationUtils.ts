/**
 * Location privacy utilities
 *
 * Public task listings show approximate location only (~1km precision).
 * Exact coordinates are revealed only after a worker accepts the task.
 */

// Round to 2 decimal places = ~1.1km precision (neighborhood level)
export function approximateCoord(coord: number): number {
  return Math.round(coord * 100) / 100
}

// Derive a neighborhood-level label from an address
// "123 Main St, Manhattan, NY 10001" -> "Manhattan, NY"
export function approximateAddress(address: string | null): string | null {
  if (!address) return null
  // Try to extract city/area from address
  const parts = address.split(',').map(p => p.trim())
  if (parts.length >= 2) {
    // Return last 2 parts (city, state or neighborhood, city)
    return parts.slice(-2).join(', ')
  }
  return address
}

// Strip exact location from a task for public listing
export function redactTaskLocation<T extends { lat: number; lon: number; address: string | null; radiusMeters: number }>(
  task: T
): T & { latApprox: number; lonApprox: number; addressApprox: string | null } {
  return {
    ...task,
    lat: 0,            // Hide exact lat
    lon: 0,            // Hide exact lon
    radiusMeters: 0,   // Hide geofence radius
    address: null,     // Hide exact address
    latApprox: approximateCoord(task.lat),
    lonApprox: approximateCoord(task.lon),
    addressApprox: approximateAddress(task.address),
  }
}
