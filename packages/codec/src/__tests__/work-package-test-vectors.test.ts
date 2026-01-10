import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeWorkPackage, encodeWorkPackage, decodeWorkItem, encodeWorkItem } from '../work-package/package'

describe('Work Package Test Vectors - Round Trip Encoding/Decoding', () => {
  const testVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')

  it('should handle work_package round-trip encoding/decoding', () => {
    const binaryPath = join(testVectorsDir, 'work_package.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(testVectorsDir, 'work_package.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data
    const [error, decodedPackageResult] = decodeWorkPackage(binaryData)
    if (error) {
      throw error
    }

    const decodedPackage = decodedPackageResult.value
    
    // Verify the decoded package matches the JSON structure
    expect(decodedPackage.authToken).toBe(jsonData.authorization)
    expect(decodedPackage.authCodeHost).toBe(BigInt(jsonData.auth_code_host))
    expect(decodedPackage.authCodeHash).toBe(jsonData.auth_code_hash)
    expect(decodedPackage.authConfig).toBe(jsonData.authorizer_config)
    
    // Check context
    expect(decodedPackage.context.anchor).toBe(jsonData.context.anchor)
    expect(decodedPackage.context.state_root).toBe(jsonData.context.state_root)
    expect(decodedPackage.context.beefy_root).toBe(jsonData.context.beefy_root)
    expect(decodedPackage.context.lookup_anchor).toBe(jsonData.context.lookup_anchor)
    expect(decodedPackage.context.lookup_anchor_slot).toBe(BigInt(jsonData.context.lookup_anchor_slot))
    
    // Check items
    expect(decodedPackage.workItems).toHaveLength(jsonData.items.length)
    
    // Encode the decoded package back to binary
    const [encodeError, encodedData] = encodeWorkPackage(decodedPackage)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
  
  it('should handle work_item round-trip encoding/decoding', () => {
    const binaryPath = join(testVectorsDir, 'work_item.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(testVectorsDir, 'work_item.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data
    const [error, decodedItem] = decodeWorkItem(binaryData)
    if (error) {
      throw error
    }
    
     // Verify the decoded item matches the JSON structure
     expect(decodedItem.value.serviceindex).toBe(BigInt(jsonData.service))
    expect(decodedItem.value.codehash).toBe(jsonData.code_hash)
    expect(decodedItem.value.payload).toBe(jsonData.payload)
    expect(decodedItem.value.refgaslimit).toBe(BigInt(jsonData.refine_gas_limit))
    expect(decodedItem.value.accgaslimit).toBe(BigInt(jsonData.accumulate_gas_limit))
    expect(decodedItem.value.exportcount).toBe(BigInt(jsonData.export_count))
    
    // Check import segments
    expect(decodedItem.value.importsegments).toHaveLength(jsonData.import_segments.length)
    decodedItem.value.importsegments.forEach((segment, index) => {
      expect(segment.treeRoot).toBe(jsonData.import_segments[index].tree_root)
      expect(segment.index).toBe(jsonData.import_segments[index].index)
    })
    
    // Check extrinsic references
    expect(decodedItem.value.extrinsics).toHaveLength(jsonData.extrinsic.length)
    decodedItem.value.extrinsics.forEach((extrinsic, index) => {
      expect(extrinsic.hash).toBe(jsonData.extrinsic[index].hash)
      expect(extrinsic.length).toBe(BigInt(jsonData.extrinsic[index].len))
    })
    
    // Encode the decoded item back to binary
    const [encodeError, encodedData] = encodeWorkItem(decodedItem.value)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify round-trip encoding matches original binary
    expect(encodedData.length).toBe(binaryData.length)
    expect(encodedData).toEqual(binaryData)
  })
})
