/**
 * IPFS Photo Storage via Pinata
 * Uploads task completion photos for immutable, tamper-proof evidence
 */

let pinataInstance: any = null

async function getPinata() {
  if (pinataInstance) return pinataInstance

  const jwt = process.env.PINATA_JWT
  const gateway = process.env.PINATA_GATEWAY

  if (!jwt) {
    console.warn('[IPFS] PINATA_JWT not set, IPFS uploads disabled')
    return null
  }

  try {
    const { PinataSDK } = await import('pinata')
    pinataInstance = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway })
    return pinataInstance
  } catch (error) {
    console.error('[IPFS] Failed to initialize Pinata:', error)
    return null
  }
}

export interface IpfsUploadResult {
  cid: string
  gatewayUrl: string
  ipfsUrl: string
}

export async function uploadPhotoToIpfs(
  base64Data: string,
  taskId: string,
  mediaType: string = 'image/jpeg'
): Promise<IpfsUploadResult | null> {
  const pinata = await getPinata()
  if (!pinata) return null

  try {
    const buffer = Buffer.from(base64Data, 'base64')
    const blob = new Blob([buffer], { type: mediaType })
    const extension = mediaType === 'image/png' ? 'png' : 'jpg'
    const file = new File([blob], `task-${taskId}-proof.${extension}`, { type: mediaType })

    const upload = await pinata.upload.public.file(file)

    const gateway = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud'
    return {
      cid: upload.cid,
      gatewayUrl: `https://${gateway}/ipfs/${upload.cid}`,
      ipfsUrl: `ipfs://${upload.cid}`,
    }
  } catch (error) {
    console.error('[IPFS] Upload failed:', error)
    return null
  }
}

export async function getIpfsUrl(cid: string): Promise<string> {
  const gateway = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud'
  return `https://${gateway}/ipfs/${cid}`
}
