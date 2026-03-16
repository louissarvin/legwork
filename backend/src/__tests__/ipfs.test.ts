import { describe, it, expect } from 'bun:test'
import { getIpfsUrl } from '../lib/storage/ipfs.ts'

describe('IPFS Storage', () => {
  it('should construct gateway URL from CID', async () => {
    const url = await getIpfsUrl('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')
    expect(url).toContain('ipfs')
    expect(url).toContain('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')
  })

  it('should use gateway from env or default', async () => {
    const url = await getIpfsUrl('test-cid')
    expect(url).toContain('gateway')
    expect(url).toContain('test-cid')
  })
})
