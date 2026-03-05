import ExifReader from 'exifreader'

export interface ExifData {
  timestamp: string | null
  gps: { lat: number | null; lon: number | null }
  device: string | null
  software: string | null
  isEdited: boolean
}

export function extractExifData(imageBuffer: Buffer): ExifData {
  try {
    const tags = ExifReader.load(imageBuffer)

    const lat = tags['GPSLatitude']?.description
      ? parseFloat(tags['GPSLatitude'].description as string)
      : null
    const lon = tags['GPSLongitude']?.description
      ? parseFloat(tags['GPSLongitude'].description as string)
      : null

    const software = tags['Software']?.description as string | undefined
    const isEdited = !!software?.match(/photoshop|gimp|canva|snapseed/i)

    return {
      timestamp: (tags['DateTimeOriginal']?.description as string) || null,
      gps: { lat, lon },
      device: (tags['Model']?.description as string) || null,
      software: software || null,
      isEdited,
    }
  } catch {
    return {
      timestamp: null,
      gps: { lat: null, lon: null },
      device: null,
      software: null,
      isEdited: false,
    }
  }
}
