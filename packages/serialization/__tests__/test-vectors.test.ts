/**
 * Test Vectors for Serialization
 *
 * Tests serialization implementation against official JAM test vectors
 * This validates that our implementation correctly encodes/decodes according to the Gray Paper
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { 
  encodeWorkItem,
  decodeWorkItem,
  encodeWorkPackage,
  decodeWorkPackage,
  encodeWorkReport,
  decodeWorkReport,
  encodeBlockHeader,
  decodeBlockHeader
} from '../src'
import type {
  WorkItem,
  WorkPackage,
  WorkReport,
  BlockHeader
} from '../src'
import type { Uint8Array } from '@pbnj/types'

interface TestVector {
  name: string
  jsonPath: string
  binPath: string
  encoder: (data: any) => Uint8Array
  decoder: (data: Uint8Array) => any
}

/**
 * Helper function to read binary file
 */
function readBinaryFile(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path))
}

/**
 * Helper function to read JSON file
 */
function readJsonFile(path: string): any {
  const content = readFileSync(path, 'utf-8')
  return JSON.parse(content)
}

/**
 * Helper function to convert Uint8Array to hex string
 */
function bytesToHex(Uint8Array: Uint8Array): string {
  return Array.from(Uint8Array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Helper function to convert Uint8Array to Uint8Array (number[])
 */
function uint8ArrayToUint8Array(Uint8Array: Uint8Array): Uint8Array {
  return Array.from(Uint8Array)
}

/**
 * Helper function to convert Uint8Array (number[]) to Uint8Array
 */
function Uint8ArrayToUint8Array(octets: Uint8Array): Uint8Array {
  return new Uint8Array(octets)
}

/**
 * Helper function to normalize data for comparison
 */
function normalizeData(data: any): any {
  if (typeof data === 'string' && data.startsWith('0x')) {
    return data.toLowerCase()
  }
  if (typeof data === 'bigint') {
    return data.toString()
  }
  if (Array.isArray(data)) {
    return data.map(normalizeData)
  }
  if (data && typeof data === 'object') {
    const normalized: any = {}
    for (const [key, value] of Object.entries(data)) {
      normalized[key] = normalizeData(value)
    }
    return normalized
  }
  return data
}

/**
 * Helper function to perform deep equality check
 */
function deepEqual(a: any, b: any): boolean {
  const normalizedA = normalizeData(a)
  const normalizedB = normalizeData(b)
  return JSON.stringify(normalizedA) === JSON.stringify(normalizedB)
}

/**
 * Test vector configuration
 * Maps test vector names to their file paths and encoder/decoder functions
 */
const TEST_VECTORS: TestVector[] = [
  {
    name: 'work_item',
    jsonPath: 'work_item.json',
    binPath: 'work_item.bin',
    encoder: encodeWorkItem,
    decoder: decodeWorkItem,
  },
  {
    name: 'work_package',
    jsonPath: 'work_package.json',
    binPath: 'work_package.bin',
    encoder: encodeWorkPackage,
    decoder: decodeWorkPackage,
  },
  {
    name: 'work_report',
    jsonPath: 'work_report.json',
    binPath: 'work_report.bin',
    encoder: encodeWorkReport,
    decoder: decodeWorkReport,
  },
  {
    name: 'header_0',
    jsonPath: 'header_0.json',
    binPath: 'header_0.bin',
    encoder: encodeBlockHeader,
    decoder: decodeBlockHeader,
  },
  {
    name: 'header_1',
    jsonPath: 'header_1.json',
    binPath: 'header_1.bin',
    encoder: encodeBlockHeader,
    decoder: decodeBlockHeader,
  },
]

/**
 * Base path for test vectors
 */
const TEST_VECTORS_BASE_PATH = join(process.cwd(), '../../submodules/jamtestvectors/codec/full')

describe('Serialization Test Vectors', () => {
  describe('File Validation', () => {
    it('should have all test vector files available', () => {
      for (const vector of TEST_VECTORS) {
        const jsonPath = join(TEST_VECTORS_BASE_PATH, vector.jsonPath)
        const binPath = join(TEST_VECTORS_BASE_PATH, vector.binPath)
        
        expect(existsSync(jsonPath), `JSON file should exist: ${vector.jsonPath}`).toBe(true)
        expect(existsSync(binPath), `Binary file should exist: ${vector.binPath}`).toBe(true)
      }
    })

    it('should have valid JSON data for each test vector', () => {
      for (const vector of TEST_VECTORS) {
        const jsonPath = join(TEST_VECTORS_BASE_PATH, vector.jsonPath)
        const jsonData = readJsonFile(jsonPath)
        
        expect(jsonData).toBeDefined()
        expect(typeof jsonData).toBe('object')
        
        // Log file sizes for debugging
        const jsonSize = JSON.stringify(jsonData).length
        const binSize = readBinaryFile(join(TEST_VECTORS_BASE_PATH, vector.binPath)).length
        console.log(`${vector.name}: ${jsonSize} Uint8Array JSON, ${binSize} Uint8Array binary`)
      }
    })

    it('should have valid binary data for each test vector', () => {
      for (const vector of TEST_VECTORS) {
        const binPath = join(TEST_VECTORS_BASE_PATH, vector.binPath)
        const binaryData = readBinaryFile(binPath)
        
        expect(binaryData).toBeDefined()
        expect(binaryData.length).toBeGreaterThan(0)
        expect(binaryData.length).toBeLessThan(1000000) // Sanity check: less than 1MB
      }
    })
  })

  describe('Type Validation', () => {
    it('should have JSON data that matches our type definitions', () => {
      for (const vector of TEST_VECTORS) {
        const jsonPath = join(TEST_VECTORS_BASE_PATH, vector.jsonPath)
        const jsonData = readJsonFile(jsonPath)
        
        // Validate that the JSON data has the expected structure
        switch (vector.name) {
          case 'work_item':
            expect(jsonData.service).toBeDefined()
            expect(typeof jsonData.service).toBe('number')
            expect(jsonData.code_hash).toBeDefined()
            expect(jsonData.code_hash.startsWith('0x')).toBe(true)
            expect(jsonData.payload).toBeDefined()
            expect(jsonData.payload.startsWith('0x')).toBe(true)
            expect(jsonData.refine_gas_limit).toBeDefined()
            expect(typeof jsonData.refine_gas_limit).toBe('number')
            expect(jsonData.accumulate_gas_limit).toBeDefined()
            expect(typeof jsonData.accumulate_gas_limit).toBe('number')
            expect(Array.isArray(jsonData.import_segments)).toBe(true)
            expect(Array.isArray(jsonData.extrinsic)).toBe(true)
            expect(jsonData.export_count).toBeDefined()
            expect(typeof jsonData.export_count).toBe('number')
            break
            
          case 'work_package':
            expect(jsonData.authorization).toBeDefined()
            expect(jsonData.authorization.startsWith('0x')).toBe(true)
            expect(jsonData.auth_code_host).toBeDefined()
            expect(typeof jsonData.auth_code_host).toBe('number')
            expect(jsonData.authorizer).toBeDefined()
            expect(jsonData.authorizer.code_hash).toBeDefined()
            expect(jsonData.authorizer.params).toBeDefined()
            expect(jsonData.context).toBeDefined()
            expect(Array.isArray(jsonData.items)).toBe(true)
            break
            
          case 'work_report':
            expect(jsonData.package_spec).toBeDefined()
            expect(jsonData.context).toBeDefined()
            expect(jsonData.core_index).toBeDefined()
            expect(typeof jsonData.core_index).toBe('number')
            expect(jsonData.authorizer_hash).toBeDefined()
            expect(jsonData.auth_output).toBeDefined()
            expect(Array.isArray(jsonData.results)).toBe(true)
            expect(jsonData.auth_gas_used).toBeDefined()
            expect(typeof jsonData.auth_gas_used).toBe('number')
            break
            
          case 'header_0':
          case 'header_1':
            expect(jsonData.parent).toBeDefined()
            expect(jsonData.parent_state_root).toBeDefined()
            expect(jsonData.extrinsic_hash).toBeDefined()
            expect(jsonData.slot).toBeDefined()
            expect(typeof jsonData.slot).toBe('number')
            expect(jsonData.epoch_mark).toBeDefined()
            expect(jsonData.tickets_mark).toBeDefined()
            expect(jsonData.offenders_mark).toBeDefined()
            expect(Array.isArray(jsonData.offenders_mark)).toBe(true)
            expect(jsonData.author_index).toBeDefined()
            expect(typeof jsonData.author_index).toBe('number')
            expect(jsonData.entropy_source).toBeDefined()
            expect(jsonData.seal).toBeDefined()
            break
        }
      }
    })

    it('should be able to assign JSON data to our type definitions', () => {
      for (const vector of TEST_VECTORS) {
        const jsonPath = join(TEST_VECTORS_BASE_PATH, vector.jsonPath)
        const jsonData = readJsonFile(jsonPath)
        
        // Test that the JSON data can be assigned to our types
        switch (vector.name) {
          case 'work_item':
            const workItem: WorkItem = jsonData
            expect(workItem.service).toBe(jsonData.service)
            expect(workItem.code_hash).toBe(jsonData.code_hash)
            expect(workItem.payload).toBe(jsonData.payload)
            break
            
          case 'work_package':
            const workPackage: WorkPackage = jsonData
            expect(workPackage.authorization).toBe(jsonData.authorization)
            expect(workPackage.auth_code_host).toBe(jsonData.auth_code_host)
            expect(workPackage.authorizer.code_hash).toBe(jsonData.authorizer.code_hash)
            expect(workPackage.authorizer.params).toBe(jsonData.authorizer.params)
            break
            
          case 'work_report':
            const workReport: WorkReport = jsonData
            expect(workReport.package_spec).toBeDefined()
            expect(workReport.context).toBeDefined()
            expect(workReport.core_index).toBe(jsonData.core_index)
            expect(workReport.authorizer_hash).toBe(jsonData.authorizer_hash)
            expect(workReport.auth_output).toBe(jsonData.auth_output)
            break
            
          case 'header_0':
          case 'header_1':
            const blockHeader: BlockHeader = jsonData
            expect(blockHeader.parent).toBe(jsonData.parent)
            expect(blockHeader.parent_state_root).toBe(jsonData.parent_state_root)
            expect(blockHeader.extrinsic_hash).toBe(jsonData.extrinsic_hash)
            expect(blockHeader.slot).toBe(jsonData.slot)
            expect(blockHeader.epoch_mark).toBeDefined()
            expect(blockHeader.tickets_mark).toBeDefined()
            expect(blockHeader.offenders_mark).toBeDefined()
            expect(blockHeader.author_index).toBe(jsonData.author_index)
            expect(blockHeader.entropy_source).toBe(jsonData.entropy_source)
            expect(blockHeader.seal).toBe(jsonData.seal)
            break
        }
      }
    })
  })

  describe('Encoding and Decoding', () => {
    for (const vector of TEST_VECTORS) {
      describe(`${vector.name}`, () => {
        let jsonData: any
        let binaryData: Uint8Array

        beforeAll(() => {
          const jsonPath = join(TEST_VECTORS_BASE_PATH, vector.jsonPath)
          const binPath = join(TEST_VECTORS_BASE_PATH, vector.binPath)
          
          jsonData = readJsonFile(jsonPath)
          binaryData = readBinaryFile(binPath)
        })

        it('should decode binary data correctly', () => {
          const Uint8Array = uint8ArrayToUint8Array(binaryData)
          const decoded = vector.decoder(Uint8Array)
          
          expect(decoded).toBeDefined()
          expect(typeof decoded).toBe('object')
        })

        it('should match JSON data after decoding', () => {
          const Uint8Array = uint8ArrayToUint8Array(binaryData)
          const decoded = vector.decoder(Uint8Array)
          
          // The decoded data should match the JSON structure
          expect(deepEqual(decoded, jsonData)).toBe(true)
        })

        it('should re-encode decoded data correctly', () => {
          const Uint8Array = uint8ArrayToUint8Array(binaryData)
          const decoded = vector.decoder(Uint8Array)
          const reEncoded = vector.encoder(decoded)
          
          expect(reEncoded).toBeDefined()
          expect(Array.isArray(reEncoded)).toBe(true)
        })

        it('should match original binary after re-encoding', () => {
          const Uint8Array = uint8ArrayToUint8Array(binaryData)
          const decoded = vector.decoder(Uint8Array)
          const reEncoded = vector.encoder(decoded)
          const reEncodedUint8Array = Uint8ArrayToUint8Array(reEncoded)
          
          // The re-encoded data should match the original binary
          expect(reEncodedUint8Array.length).toBe(binaryData.length)
          expect(bytesToHex(reEncodedUint8Array)).toBe(bytesToHex(binaryData))
        })

        it('should handle round-trip encoding/decoding', () => {
          // Start with JSON data
          const encoded = vector.encoder(jsonData)
          const decoded = vector.decoder(encoded)
          
          // Should match original JSON
          expect(deepEqual(decoded, jsonData)).toBe(true)
        })

        it('should handle invalid binary data gracefully', () => {
          const invalidData: Uint8Array = [0, 1, 2, 3] // Too short
          
          expect(() => {
            vector.decoder(invalidData)
          }).toThrow()
        })

        it('should handle empty binary data appropriately', () => {
          const emptyData: Uint8Array = []
          
          expect(() => {
            vector.decoder(emptyData)
          }).toThrow()
        })

        it('should encode/decode efficiently', () => {
          const startTime = performance.now()
          
          // Perform multiple encode/decode cycles
          for (let i = 0; i < 10; i++) {
            const encoded = vector.encoder(jsonData)
            const decoded = vector.decoder(encoded)
            expect(decoded).toBeDefined()
          }
          
          const endTime = performance.now()
          const duration = endTime - startTime
          
          // Should complete within reasonable time (adjust threshold as needed)
          expect(duration).toBeLessThan(1000) // 1 second
        })
      })
    }
  })

  describe('Data Consistency', () => {
    it('should have consistent data structures across test vectors', () => {
      for (const vector of TEST_VECTORS) {
        const jsonPath = join(TEST_VECTORS_BASE_PATH, vector.jsonPath)
        const jsonData = readJsonFile(jsonPath)
        
        // Verify that all hex strings are properly formatted
        const hexStrings = extractHexStrings(jsonData)
        for (const hexString of hexStrings) {
          expect(hexString.startsWith('0x')).toBe(true)
          expect(hexString.length % 2).toBe(0) // Even length (excluding 0x prefix)
          expect(/^0x[0-9a-fA-F]+$/.test(hexString)).toBe(true) // Valid hex characters
        }
        
        // Verify that all numeric values are reasonable
        const numbers = extractNumbers(jsonData)
        for (const num of numbers) {
          expect(typeof num).toBe('number')
          expect(Number.isFinite(num)).toBe(true)
          expect(num >= 0).toBe(true) // All numbers should be non-negative
        }
      }
    })
  })
})

/**
 * Helper function to extract all hex strings from an object
 */
function extractHexStrings(obj: any): string[] {
  const hexStrings: string[] = []
  
  function traverse(value: any) {
    if (typeof value === 'string' && value.startsWith('0x')) {
      hexStrings.push(value)
    } else if (Array.isArray(value)) {
      value.forEach(traverse)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(traverse)
    }
  }
  
  traverse(obj)
  return hexStrings
}

/**
 * Helper function to extract all numbers from an object
 */
function extractNumbers(obj: any): number[] {
  const numbers: number[] = []
  
  function traverse(value: any) {
    if (typeof value === 'number') {
      numbers.push(value)
    } else if (Array.isArray(value)) {
      value.forEach(traverse)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(traverse)
    }
  }
  
  traverse(obj)
  return numbers
} 