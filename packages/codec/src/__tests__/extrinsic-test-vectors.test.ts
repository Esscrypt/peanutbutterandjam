import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeAssurances, encodeAssurances } from '../block/assurance'
import { decodeGuarantees, encodeGuarantees } from '../block/guarantee'
import { decodePreimages, encodePreimages } from '../block/preimage'
import { decodeSafroleTickets, encodeSafroleTickets } from '../block/ticket'
import type { IConfigService } from '@pbnjam/types'

describe('Extrinsic Test Vectors - Round Trip Encoding/Decoding', () => {
  const testVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')
  
  // Create a config that matches the jamtestvectors
  const jamtestvectorsConfig = {
    numCores: 341, // Test vectors use 43-byte bitfields (ceil(341/8) = 43)
    numValidators: 1023, // Keep same as full config
  } as IConfigService
    
  it('should handle assurances_extrinsic round-trip encoding/decoding', () => {
    const binaryPath = join(testVectorsDir, 'assurances_extrinsic.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(testVectorsDir, 'assurances_extrinsic.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data
    const [error, decodedAssurances] = decodeAssurances(binaryData, jamtestvectorsConfig)
    if (error) {
      throw error
    }
    
    // Verify the decoded assurances match the JSON structure
    expect(decodedAssurances.value).toHaveLength(jsonData.length)
    
    for (let i = 0; i < jsonData.length; i++) {
      expect(decodedAssurances.value[i].anchor).toBe(jsonData[i].anchor)
      expect(decodedAssurances.value[i].bitfield).toBe(jsonData[i].bitfield)
      expect(decodedAssurances.value[i].validator_index).toBe(jsonData[i].validator_index)
      expect(decodedAssurances.value[i].signature).toBe(jsonData[i].signature)
    }
    
    // Encode the decoded assurances back to binary
    const [encodeError, encodedData] = encodeAssurances(decodedAssurances.value, jamtestvectorsConfig)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
    
  it('should handle guarantees_extrinsic round-trip encoding/decoding', () => {
    const binaryPath = join(testVectorsDir, 'guarantees_extrinsic.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(testVectorsDir, 'guarantees_extrinsic.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data
    const [error, decodedGuarantees] = decodeGuarantees(binaryData)
    if (error) {
      throw error
    }
    
    // Verify the decoded guarantees match the JSON structure
    expect(decodedGuarantees.value).toHaveLength(jsonData.length)
    
    // Validate the content of each guarantee
    for (let i = 0; i < jsonData.length; i++) {
      const guarantee = decodedGuarantees.value[i]
      const expectedGuarantee = jsonData[i]
      
      // Check report structure
      expect(guarantee.report.package_spec.hash).toBe(expectedGuarantee.report.package_spec.hash)
      expect(guarantee.report.package_spec.length).toBe(BigInt(expectedGuarantee.report.package_spec.length))
      expect(guarantee.report.package_spec.erasure_root).toBe(expectedGuarantee.report.package_spec.erasure_root)
      expect(guarantee.report.package_spec.exports_root).toBe(expectedGuarantee.report.package_spec.exports_root)
      expect(guarantee.report.package_spec.exports_count).toBe(BigInt(expectedGuarantee.report.package_spec.exports_count))
      
      // Check context
      expect(guarantee.report.context.anchor).toBe(expectedGuarantee.report.context.anchor)
      expect(guarantee.report.context.state_root).toBe(expectedGuarantee.report.context.state_root)
      expect(guarantee.report.context.beefy_root).toBe(expectedGuarantee.report.context.beefy_root)
      expect(guarantee.report.context.lookup_anchor).toBe(expectedGuarantee.report.context.lookup_anchor)
      expect(guarantee.report.context.lookup_anchor_slot).toBe(BigInt(expectedGuarantee.report.context.lookup_anchor_slot))
      
      // Check other fields
      expect(guarantee.report.core_index).toBe(BigInt(expectedGuarantee.report.core_index))
      expect(guarantee.report.auth_gas_used).toBe(BigInt(expectedGuarantee.report.auth_gas_used))
      expect(guarantee.report.auth_output).toBe(expectedGuarantee.report.auth_output)
      
      // Check results length
      expect(guarantee.report.results).toHaveLength(expectedGuarantee.report.results.length)
    }
    
    // Encode the decoded guarantees back to binary
    const [encodeError, encodedData] = encodeGuarantees(decodedGuarantees.value)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
    
  it('should handle preimages_extrinsic round-trip encoding/decoding', () => {
    const binaryPath = join(testVectorsDir, 'preimages_extrinsic.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(testVectorsDir, 'preimages_extrinsic.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data
    const [error, decodedPreimages] = decodePreimages(binaryData)
    if (error) {
      throw error
    }
    
    // Verify the decoded preimages match the JSON structure
    expect(decodedPreimages.value).toHaveLength(jsonData.length)
    
    // Validate the content of each preimage
    for (let i = 0; i < jsonData.length; i++) {
      const preimage = decodedPreimages.value[i]
      const expectedPreimage = jsonData[i]
      
      expect(preimage.requester).toBe(BigInt(expectedPreimage.requester))
      expect(preimage.blob).toBe(expectedPreimage.blob)
    }
    
    // Encode the decoded preimages back to binary
    const [encodeError, encodedData] = encodePreimages(decodedPreimages.value)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
    
  it('should handle tickets_extrinsic round-trip encoding/decoding', () => {
    const binaryPath = join(testVectorsDir, 'tickets_extrinsic.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(testVectorsDir, 'tickets_extrinsic.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data
    const [error, decodedTickets] = decodeSafroleTickets(binaryData)
    if (error) {
      throw error
    }
    
    // Verify the decoded tickets match the JSON structure
    expect(decodedTickets.value).toHaveLength(jsonData.length)
    
    // Encode the decoded tickets back to binary
    const [encodeError, encodedData] = encodeSafroleTickets(decodedTickets.value)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
})