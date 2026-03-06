import { verifyLocation } from './gps.ts'
import { verifyTaskPhoto, type VerificationResult } from './vision.ts'
import { extractExifData, type ExifData } from './exif.ts'

export interface VerificationInput {
  photoBase64: string
  photoMediaType?: 'image/jpeg' | 'image/png' | 'image/webp'
  gpsLat: number
  gpsLon: number
  taskDescription: string
  taskLat: number
  taskLon: number
  taskRadiusMeters: number
  // Delivery: worker-reported pickup GPS from reportData
  taskCategory?: string
  pickupLat?: number | null
  pickupLon?: number | null
  pickupRadiusMeters?: number | null
  reportPickupLat?: number | null
  reportPickupLon?: number | null
  // Event: duration check
  minDurationMinutes?: number | null
  reportDurationMinutes?: number | null
}

export interface PipelineResult {
  passed: boolean
  overallScore: number
  gps: { passed: boolean; distanceMeters: number }
  exif: ExifData
  vision: VerificationResult
  delivery?: { pickupPassed: boolean; pickupDistanceMeters: number; dropoffPassed: boolean; dropoffDistanceMeters: number }
  event?: { durationMinutes: number; minRequired: number; durationPassed: boolean }
  reason: string
}

export async function runVerificationPipeline(input: VerificationInput): Promise<PipelineResult> {
  const category = input.taskCategory?.toLowerCase() || 'photo'

  // Step 1: GPS geofence check (primary location / dropoff for delivery)
  const gpsResult = verifyLocation(
    input.gpsLat, input.gpsLon,
    input.taskLat, input.taskLon,
    input.taskRadiusMeters
  )

  // Step 2: EXIF extraction
  const photoBuffer = Buffer.from(input.photoBase64, 'base64')
  const exifData = extractExifData(photoBuffer)

  // Step 3: AI Vision analysis
  const visionResult = await verifyTaskPhoto(
    input.photoBase64,
    input.taskDescription,
    input.photoMediaType
  )

  // Step 4: Category-specific validation
  let deliveryResult: PipelineResult['delivery'] = undefined
  let eventResult: PipelineResult['event'] = undefined

  // Delivery: validate both pickup and dropoff GPS
  if (category === 'delivery' && input.pickupLat && input.pickupLon && input.reportPickupLat && input.reportPickupLon) {
    const pickupCheck = verifyLocation(
      input.reportPickupLat, input.reportPickupLon,
      input.pickupLat, input.pickupLon,
      input.pickupRadiusMeters || 500 // Default 500m for pickup
    )
    deliveryResult = {
      pickupPassed: pickupCheck.passed,
      pickupDistanceMeters: pickupCheck.distanceMeters,
      dropoffPassed: gpsResult.passed,
      dropoffDistanceMeters: gpsResult.distanceMeters,
    }
  }

  // Event: validate minimum duration
  if (category === 'event' && input.minDurationMinutes && input.reportDurationMinutes !== null && input.reportDurationMinutes !== undefined) {
    eventResult = {
      durationMinutes: input.reportDurationMinutes,
      minRequired: input.minDurationMinutes,
      durationPassed: input.reportDurationMinutes >= input.minDurationMinutes,
    }
  }

  // Calculate overall score (0-100)
  let score = 0

  // GPS geofence: +30 (worker is at the target location)
  if (gpsResult.passed) score += 30

  // Vision AI confidence: +50 (high) or +30 (medium) or +10 (low)
  if (visionResult.confidence >= 0.8) score += 50
  else if (visionResult.confidence >= 0.5) score += 30
  else if (visionResult.confidence >= 0.3) score += 10

  // EXIF integrity: +10 if not edited
  if (!exifData.isEdited) score += 10

  // EXIF GPS metadata: +10 if present (bonus)
  if (exifData.gps.lat !== null) score += 10

  // Delivery bonus/penalty
  if (category === 'delivery' && deliveryResult) {
    if (deliveryResult.pickupPassed && deliveryResult.dropoffPassed) {
      // Both checkpoints verified: no penalty
    } else if (!deliveryResult.pickupPassed) {
      score -= 15 // Pickup GPS didn't match: significant penalty
    }
  }

  // Event bonus/penalty
  if (category === 'event' && eventResult) {
    if (eventResult.durationPassed) {
      // Duration met: no penalty
    } else {
      score -= 10 // Didn't stay long enough: penalty
    }
  }

  score = Math.max(0, Math.min(100, score))

  // Determine pass/fail
  let passed = score >= 70 && gpsResult.passed && visionResult.recommendation !== 'reject'

  // Delivery: both checkpoints must pass
  if (category === 'delivery' && deliveryResult && !deliveryResult.dropoffPassed) {
    passed = false
  }

  let reason = ''
  if (!gpsResult.passed) {
    reason = `GPS check failed: ${gpsResult.distanceMeters}m from target (max ${input.taskRadiusMeters}m)`
  } else if (category === 'delivery' && deliveryResult && !deliveryResult.pickupPassed) {
    reason = `Delivery pickup GPS failed: ${deliveryResult.pickupDistanceMeters}m from pickup point`
  } else if (category === 'event' && eventResult && !eventResult.durationPassed) {
    reason = `Event duration too short: ${eventResult.durationMinutes}min (min ${eventResult.minRequired}min required)`
  } else if (visionResult.recommendation === 'reject') {
    reason = `AI verification rejected: ${visionResult.concerns.join(', ')}`
  } else if (passed) {
    reason = 'All checks passed'
  } else {
    reason = `Score too low: ${score}/100`
  }

  return {
    passed,
    overallScore: score,
    gps: gpsResult,
    exif: exifData,
    vision: visionResult,
    delivery: deliveryResult,
    event: eventResult,
    reason,
  }
}
