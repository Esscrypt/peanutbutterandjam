import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { encodeRefineContext, decodeRefineContext } from '../work-package/context'

describe('Context Test Vectors - Round Trip Encoding/Decoding', () => {
  const testVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')

  it('should handle refine_context round-trip encoding/decoding', () => {
    const binaryPath = join(testVectorsDir, 'refine_context.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(testVectorsDir, 'refine_context.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data
    const [error, decodedContext] = decodeRefineContext(binaryData)
    if (error) {
      throw error
    }
    
    // Verify the decoded context matches the JSON structure
    expect(decodedContext.value.anchor).toBe(jsonData.anchor)
    expect(decodedContext.value.state_root).toBe(jsonData.state_root)
    expect(decodedContext.value.beefy_root).toBe(jsonData.beefy_root)
    expect(decodedContext.value.lookup_anchor).toBe(jsonData.lookup_anchor)
    expect(decodedContext.value.lookup_anchor_slot).toBe(BigInt(jsonData.lookup_anchor_slot))
    expect(decodedContext.value.prerequisites).toEqual(jsonData.prerequisites || [])
    
    // Encode the decoded context back to binary
    const [encodeError, encodedData] = encodeRefineContext(decodedContext.value)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
})