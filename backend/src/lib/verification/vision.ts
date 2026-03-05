import { callVision } from '../ai/provider.ts'

export interface VerificationResult {
  verified: boolean
  confidence: number
  evidence: string[]
  concerns: string[]
  recommendation: 'approve' | 'reject' | 'manual_review'
}

const PROMPT = (taskDescription: string) =>
  `You are a photo verification agent for a gig economy platform. A worker was assigned this task and submitted this photo as proof of completion.

Task: "${taskDescription}"

Your job is to determine if this is a REAL photo taken at a REAL location that is relevant to the task. You are NOT judging photo quality, lighting, or composition.

Score with HIGH confidence (0.8+) if:
- The photo shows a real physical location (indoor or outdoor)
- The scene is plausibly related to the task description (e.g., a cafe photo for a cafe task, a storefront photo for a storefront task)
- The photo appears to be taken by a phone camera (not a screenshot, not AI-generated, not a stock photo)

Score with MEDIUM confidence (0.5-0.7) if:
- The photo is real but the connection to the task is unclear
- The photo is blurry or dark but appears genuine

Score with LOW confidence (<0.5) ONLY if:
- The photo is clearly a screenshot of another image
- The photo appears AI-generated (smooth textures, impossible geometry)
- The photo has nothing to do with the task (e.g., a selfie for a storefront task)
- The photo shows signs of intentional fraud

Important: Indoor photos, nighttime photos, and photos with people are all VALID as long as they show a real location related to the task. Do not penalize for lighting conditions or image quality.

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "verified": true,
  "confidence": 0.85,
  "evidence": ["shows interior of a cafe/restaurant", "appears to be a real phone photo", "lighting consistent with indoor venue"],
  "concerns": [],
  "recommendation": "approve"
}`

export async function verifyTaskPhoto(
  photoBase64: string,
  taskDescription: string,
  mediaType: string = 'image/jpeg'
): Promise<VerificationResult> {
  const text = await callVision(photoBase64, PROMPT(taskDescription), mediaType)

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      verified: false,
      confidence: 0.5,
      evidence: ['AI returned non-JSON response'],
      concerns: ['Could not parse AI response'],
      recommendation: 'manual_review',
    }
  }

  try {
    return JSON.parse(jsonMatch[0]) as VerificationResult
  } catch {
    return {
      verified: false,
      confidence: 0.5,
      evidence: [],
      concerns: ['Could not parse AI JSON'],
      recommendation: 'manual_review',
    }
  }
}
