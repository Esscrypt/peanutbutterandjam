/**
 * JAM Test Vector Validation Tests
 *
 * Tests the Rust erasure coding implementation against official JAM test vectors
 * Uses the reed-solomon-simd Rust library for high-performance erasure coding.
 */

import { type Hex, logger, bytesToHex } from '@pbnj/core'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import { RustReedSolomonCoder, isRustModuleAvailable } from '../rust-wrapper'

beforeAll(() => {
  logger.init()
})

interface JAMTestVector {
  data: string
  shards: string[]
}

function hexToUint8Array(hex: string | undefined): Uint8Array {
  if (!hex) {
    return new Uint8Array(0)
  }
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const paddedHex = cleanHex.length % 2 === 0 ? cleanHex : '0' + cleanHex
  
  const bytes = new Uint8Array(paddedHex.length / 2)
  for (let i = 0; i < paddedHex.length; i += 2) {
    bytes[i / 2] = parseInt(paddedHex.slice(i, i + 2), 16)
  }
  return bytes
}


function loadJAMTestVectors(directory: string): Array<{ file: string, testVector: JAMTestVector }> {
  const testVectors: Array<{ file: string, testVector: JAMTestVector }> = []
  
  try {
    const files = readdirSync(directory)
    const jsonFiles = files.filter(file => file.endsWith('.json') && file.startsWith('ec-'))
    
    for (const file of jsonFiles) {
      try {
        const content = readFileSync(join(directory, file), 'utf-8')
        const testVector = JSON.parse(content) as JAMTestVector
        testVectors.push({ file, testVector })
      } catch (error) {
        logger.warn('Failed to load test vector', { file, error })
      }
    }
  } catch (error) {
    logger.warn('Failed to read test vector directory', { directory, error })
  }
  
  return testVectors
}

describe('JAM Test Vector Analysis', () => {
  beforeAll(() => {
    if (!isRustModuleAvailable()) {
      throw new Error('Rust module not available. Please build with: bun run build:native')
    }
  })

  describe('Real JAM Test Vectors', () => {
    it('should test against actual JAM test vectors from jamtestvectors', () => {
      const jamTestVectorPaths = [
        '../../../../submodules/jamtestvectors/erasure/tiny',
        '../../../../submodules/jamtestvectors/erasure/full'
      ]

      for (const [index, vectorPath] of jamTestVectorPaths.entries()) {
        const category = index === 0 ? 'tiny' : 'full'
        const testVectors = loadJAMTestVectors(join(__dirname, vectorPath))

        logger.info(`Found ${testVectors.length} ${category} test vectors`)
        
        for (const { testVector } of testVectors) { // Test first 5 vectors
          const inputData = hexToUint8Array(testVector.data)
          // const expectedShards = testVector.shards.map(hex => hexToUint8Array(hex))
          
          // Use appropriate configuration for each category
          const k = category === 'tiny' ? 2 : 342
          const n = category === 'tiny' ? 6 : 1023
          
          const coder = new RustReedSolomonCoder(k, n)
          
            // Use our simplified Gray Paper-compliant encoding
            const encoded = coder.encode(inputData)

            for (let i = 0; i < encoded.shards.length; i++) {
              const shard = encoded.shards[i]
              expect(bytesToHex(shard)).toEqual(testVector.shards[i] as Hex)
            }
            
            logger.debug(`DEBUG: encoded.originalLength = ${encoded.originalLength}, inputData.length = ${inputData.length}`)
            
            const decoded = coder.decode(encoded.shards, encoded.originalLength)

            expect(bytesToHex(decoded)).toEqual(testVector.data as Hex)
            expect(decoded.length).toEqual(inputData.length)
            
        }
      }
    
    })
  })
})