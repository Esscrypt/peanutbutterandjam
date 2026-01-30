import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeAssurances, encodeAssurances } from '../block/assurance'
import type { Assurance, IConfigService } from '@pbnjam/types'
import { getCodecTestVectorsDir } from './test-vector-dir'

describe('Assurances Test Vectors - Comprehensive Round Trip', () => {
  // Create configs for different test vector sizes
  const tinyConfig = {
    numCores: 5, // Tiny config uses 5 validators
    numValidators: 5,
  } as IConfigService

  const fullConfig = {
    numCores: 341, // Full config uses 341 cores
    numValidators: 1023, // Full config uses 1023 validators
  } as IConfigService

  it('should handle tiny assurances_extrinsic round-trip encoding/decoding', () => {
    const tinyTestVectorsDir = getCodecTestVectorsDir('tiny')
    const binaryPath = join(tinyTestVectorsDir, 'assurances_extrinsic.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(tinyTestVectorsDir, 'assurances_extrinsic.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data using tiny config
    const [error, decodedAssurances] = decodeAssurances(binaryData, tinyConfig)
    if (error) {
      throw error
    }
    
    // Verify the decoded assurances match the JSON structure
    expect(decodedAssurances.value).toHaveLength(jsonData.length)
    
    for (let i = 0; i < jsonData.length; i++) {
      const assurance = decodedAssurances.value[i]
      const expectedAssurance = jsonData[i]
      
      expect(assurance.anchor).toBe(expectedAssurance.anchor)
      expect(assurance.bitfield).toBe(expectedAssurance.bitfield)
      expect(assurance.validator_index).toBe(expectedAssurance.validator_index)
      expect(assurance.signature).toBe(expectedAssurance.signature)
    }
    
    // Encode the decoded assurances back to binary
    const [encodeError, encodedData] = encodeAssurances(decodedAssurances.value, tinyConfig)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })

  it('should handle full assurances_extrinsic round-trip encoding/decoding', () => {
    const fullTestVectorsDir = getCodecTestVectorsDir('full')
    const binaryPath = join(fullTestVectorsDir, 'assurances_extrinsic.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(fullTestVectorsDir, 'assurances_extrinsic.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data using full config
    const [error, decodedAssurances] = decodeAssurances(binaryData, fullConfig)
    if (error) {
      throw error
    }
    
    // Verify the decoded assurances match the JSON structure
    expect(decodedAssurances.value).toHaveLength(jsonData.length)
    
    // For full test vectors, check first few assurances to avoid testing all (performance)
    const maxAssurancesToCheck = Math.min(5, jsonData.length)
    for (let i = 0; i < maxAssurancesToCheck; i++) {
      const assurance = decodedAssurances.value[i]
      const expectedAssurance = jsonData[i]
      
      expect(assurance.anchor).toBe(expectedAssurance.anchor)
      expect(assurance.bitfield).toBe(expectedAssurance.bitfield)
      expect(assurance.validator_index).toBe(expectedAssurance.validator_index)
      expect(assurance.signature).toBe(expectedAssurance.signature)
    }
    
    // Encode the decoded assurances back to binary
    const [encodeError, encodedData] = encodeAssurances(decodedAssurances.value, fullConfig)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })

  it('should handle empty assurances round-trip encoding/decoding', () => {
    // Test empty assurances case
    const emptyAssurances: any[] = []
    
    // Encode empty assurances
    const [encodeError, encodedData] = encodeAssurances(emptyAssurances, tinyConfig)
    if (encodeError) {
      throw encodeError
    }
    
    // Decode empty assurances
    const [decodeError, decodedAssurances] = decodeAssurances(encodedData, tinyConfig)
    if (decodeError) {
      throw decodeError
    }
    
    // Verify empty assurances round-trip
    expect(decodedAssurances.value).toHaveLength(0)
  })

  it('should handle single assurance round-trip encoding/decoding', () => {
    // Test single assurance case
    const singleAssurance: Assurance[] = [{
      anchor: '0xdd1b65c036547750d2f84ff4c6fac7de56944658530a62e81c6cc290087440d0',
      bitfield: '0x1f', // 5 validators = 1 byte bitfield
      validator_index: 0,
      signature: '0xc072848f5bc77d85a09dc4e69f3420293891163406ec3a49ccf31a5ff8c063042a9c8c59e5f83d4d276ab4110af0ca85d7a713434694f8c6b391b122c303aadb'
    }]
    
    // Encode single assurance
    const [encodeError, encodedData] = encodeAssurances(singleAssurance, tinyConfig)
    if (encodeError) {
      throw encodeError
    }
    
    // Decode single assurance
    const [decodeError, decodedAssurances] = decodeAssurances(encodedData, tinyConfig)
    if (decodeError) {
      throw decodeError
    }
    
    // Verify single assurance round-trip
    expect(decodedAssurances.value).toHaveLength(1)
    expect(decodedAssurances.value[0].anchor).toBe(singleAssurance[0].anchor)
    expect(decodedAssurances.value[0].bitfield).toBe(singleAssurance[0].bitfield)
    expect(decodedAssurances.value[0].validator_index).toBe(singleAssurance[0].validator_index)
    expect(decodedAssurances.value[0].signature).toBe(singleAssurance[0].signature)
  })

  it('should handle multiple assurances round-trip encoding/decoding', () => {
    // Test multiple assurances case
    const multipleAssurances: Assurance[] = [
      {
        anchor: '0xdd1b65c036547750d2f84ff4c6fac7de56944658530a62e81c6cc290087440d0',
        bitfield: '0x1f', // 5 validators = 1 byte bitfield
        validator_index: 0,
        signature: '0xc072848f5bc77d85a09dc4e69f3420293891163406ec3a49ccf31a5ff8c063042a9c8c59e5f83d4d276ab4110af0ca85d7a713434694f8c6b391b122c303aadb'
      },
      {
        anchor: '0x2bdbba473648c1414a534e2cd362571cfb340151d6bb268db379c5997b08dc61',
        bitfield: '0x1f', // 5 validators = 1 byte bitfield
        validator_index: 1,
        signature: '0xcb021d8507925eb2d49040cc08cbcca0af197c5f3eb7aad639a82497a8d6046780da26d4cbc113b375c34298bc5be500eb088a33a099f86e428154c9f6724d8c'
      }
    ]
    
    // Encode multiple assurances
    const [encodeError, encodedData] = encodeAssurances(multipleAssurances, tinyConfig)
    if (encodeError) {
      throw encodeError
    }
    
    // Decode multiple assurances
    const [decodeError, decodedAssurances] = decodeAssurances(encodedData, tinyConfig)
    if (decodeError) {
      throw decodeError
    }
    
    // Verify multiple assurances round-trip
    expect(decodedAssurances.value).toHaveLength(2)
    
    // Check first assurance
    expect(decodedAssurances.value[0].anchor).toBe(multipleAssurances[0].anchor)
    expect(decodedAssurances.value[0].bitfield).toBe(multipleAssurances[0].bitfield)
    expect(decodedAssurances.value[0].validator_index).toBe(multipleAssurances[0].validator_index)
    expect(decodedAssurances.value[0].signature).toBe(multipleAssurances[0].signature)
    
    // Check second assurance
    expect(decodedAssurances.value[1].anchor).toBe(multipleAssurances[1].anchor)
    expect(decodedAssurances.value[1].bitfield).toBe(multipleAssurances[1].bitfield)
    expect(decodedAssurances.value[1].validator_index).toBe(multipleAssurances[1].validator_index)
    expect(decodedAssurances.value[1].signature).toBe(multipleAssurances[1].signature)
  })
})
