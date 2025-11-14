import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeBlock, encodeBlock } from '../block/body'
import type { IConfigService } from '@pbnj/types'

describe('JAM Test Vectors - Round Trip Encoding/Decoding', () => {
  const testVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')
  
  describe('Block Test Vectors', () => {
    // Create a config that matches the jamtestvectors
    const jamtestvectorsConfig = {
      numCores: 341, // Test vectors use 43-byte bitfields (ceil(341/8) = 43)
      numValidators: 1023, // Keep same as full config
    } as IConfigService
    
    it('should handle block round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'block.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'block.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedBlock] = decodeBlock(binaryData, jamtestvectorsConfig)
      if (error) {
        throw error
      }
      
      // Verify the decoded block matches the JSON structure
      expect(decodedBlock.value.header.parent).toBe(jsonData.header.parent)
      expect(decodedBlock.value.header.priorStateRoot).toBe(jsonData.header.parent_state_root)
      expect(decodedBlock.value.header.extrinsicHash).toBe(jsonData.header.extrinsic_hash)
      expect(Number(decodedBlock.value.header.timeslot)).toBe(jsonData.header.slot)
      
      // Check body
    //   expect(decodedBlock.value.body.extrinsics).toHaveLength(jsonData.body.extrinsics.length)
      
      // Encode the decoded block back to binary
      const [encodeError, encodedData] = encodeBlock(decodedBlock.value, jamtestvectorsConfig)
      if (encodeError) {
        throw encodeError
      }
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
  })
})