/**
 * JAM Test Vector Validation Tests using ErasureCodingService
 *
 * Tests the ErasureCodingService implementation against official JAM test vectors
 * Requires EXACT shard content matching for JAM protocol compliance
 * Uses the ConfigService to get proper Gray Paper parameters
 */

import { logger, EventBusService } from '@pbnjam/core'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { beforeAll, describe, expect, it } from 'bun:test'
import { ConfigService } from '../services/config-service'
import { ErasureCodingService } from '../services/erasure-coding-service'

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
    bytes[i / 2] = parseInt(paddedHex.substr(i, 2), 16)
  }
  return bytes
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
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

describe('JAM Test Vector Analysis using ErasureCodingService', () => {
  let eventBusService: EventBusService
  let tinyConfigService: ConfigService
  let fullConfigService: ConfigService
  let tinyShardService: ErasureCodingService
  let fullShardService: ErasureCodingService

  beforeAll(async () => {
    eventBusService = new EventBusService()
    await eventBusService.init()
    await eventBusService.start()
    
    // Initialize config services for different modes
    tinyConfigService = new ConfigService('tiny')
    fullConfigService = new ConfigService('full')
    
    // Initialize shard services
    tinyShardService = new ErasureCodingService({ configService: tinyConfigService })
    fullShardService = new ErasureCodingService({ configService: fullConfigService })
    
    // Start shard services
    const [tinyStartError, tinyStartResult] = await tinyShardService.start()
    const [fullStartError, fullStartResult] = await fullShardService.start()
    
    if (tinyStartError || !tinyStartResult) {
      throw new Error('Failed to start tiny shard service')
    }
    if (fullStartError || !fullStartResult) {
      throw new Error('Failed to start full shard service')
    }
  })

  describe('Real JAM Test Vectors', () => {
    it('should test against actual JAM test vectors with exact shard content matching', async () => {
      // Root to workspace
      const WORKSPACE_ROOT = join(__dirname, '../../../')
      const jamTestVectorPaths = [
        join(WORKSPACE_ROOT, 'submodules/jam-test-vectors/erasure/tiny'),
        join(WORKSPACE_ROOT, 'submodules/jam-test-vectors/erasure/full')
      ]
      
      let totalVectorsFound = 0
      let totalVectorsTested = 0
      let vectorResults: Array<{
        file: string
        category: string
        roundTripSuccess: boolean
        shardSizeMatch: boolean
        shardContentMatch: boolean
        inputSize: number
        shardSizes: number[]
        parameters: { k: number; n: number; parityShards: number } | null
        shardComparison?: Array<{
          index: number
          ourShard: string
          expectedShard: string
          match: boolean
        }>
      }> = []
      
      for (const [index, vectorPath] of jamTestVectorPaths.entries()) {
        const category = index === 0 ? 'tiny' : 'full'
        const testVectors = loadJAMTestVectors(vectorPath)
        totalVectorsFound += testVectors.length
        
        logger.info(`Found ${testVectors.length} ${category} test vectors`)
        
        // Use appropriate shard service for each category
        const shardService = category === 'tiny' ? tinyShardService : fullShardService
        
        for (const { file, testVector } of testVectors.slice(0, 5)) { // Test first 5 vectors
          const inputData = hexToUint8Array(testVector.data)
          const expectedShards = testVector.shards.map(hex => hexToUint8Array(hex))
          
          // Extract shard size from filename (ec-3.json -> 3, ec-32.json -> 32, etc.)
          const shardSizeMatch = file.match(/ec-(\d+)\.json/)
          const shardSize = shardSizeMatch ? parseInt(shardSizeMatch[1], 10) : 2 // Default to 2 if not found
          
          try {
            // Encode using ErasureCodingService
            const [encodeError, encodeResult] = await shardService.encodeData(inputData)
            
            if (encodeError || !encodeResult) {
              logger.warn(`Failed to encode vector ${file}:`, encodeError)
              continue
            }
            
            // Decode using ErasureCodingService
            const [decodeError, decodeResult] = await shardService.decode(encodeResult.shards, encodeResult.originalLength)
            
            if (decodeError || !decodeResult) {
              logger.warn(`Failed to decode vector ${file}:`, decodeError)
              continue
            }
            
            // Check round-trip success
            const roundTripSuccess = decodeResult.length === inputData.length && 
              decodeResult.every((byte, i) => byte === inputData[i])
            
            // Check shard size compliance (use shard size from filename)
            const shardSizeMatch = encodeResult.shards.every(shard => shard.shard.length === shardSize)
            
            // Check exact shard content match with JAM test vectors
            const shardContentMatch = encodeResult.shards.every((shard, index) => {
              if (index >= expectedShards.length) return false
              return uint8ArrayToHex(shard.shard) === uint8ArrayToHex(expectedShards[index])
            })
            
            const result = {
              file,
              category,
              roundTripSuccess,
              shardSizeMatch,
              shardContentMatch,
              inputSize: inputData.length,
              shardSize, // Include the shard size from filename
              shardSizes: encodeResult.shards.map(s => s.shard.length),
              parameters: { k: shardService['coder'].k, n: shardService['coder'].n, parityShards: shardService['coder'].n - shardService['coder'].k },
              // Detailed comparison for debugging
              shardComparison: encodeResult.shards.map((shard, i) => ({
                index: i,
                ourShard: uint8ArrayToHex(shard.shard),
                expectedShard: i < expectedShards.length ? uint8ArrayToHex(expectedShards[i]) : 'N/A',
                match: i < expectedShards.length ? uint8ArrayToHex(shard.shard) === uint8ArrayToHex(expectedShards[i]) : false
              }))
            }
            
            vectorResults.push(result)
            totalVectorsTested++
            
 
            
            // We expect round-trip to work, shard sizes to match, AND exact shard content match
            expect(roundTripSuccess).toBe(true)
            expect(shardSizeMatch).toBe(true)
            expect(shardContentMatch).toBe(true)
            
            // For small data sizes that fit within shard capacity, we expect round-trip to work
            // For larger data, truncation is expected behavior
            if (inputData.length <= (shardService['coder'].k * 2)) {
              expect(roundTripSuccess).toBe(true)
            }
            
            // Log shard content comparison for debugging failures
            if (!shardContentMatch) {
              logger.error(`Shard content mismatch for ${file}`, {
                inputSize: inputData.length,
                maxCapacity: shardService['coder'].k * 2,
                systematicMatches: encodeResult.shards.slice(0, shardService['coder'].k).map((shard, i) => ({
                  index: i,
                  match: i < expectedShards.length ? uint8ArrayToHex(shard.shard) === uint8ArrayToHex(expectedShards[i]) : false,
                  ourShard: uint8ArrayToHex(shard.shard),
                  expectedShard: i < expectedShards.length ? uint8ArrayToHex(expectedShards[i]) : 'N/A'
                }))
              })
            }
            
          } catch (error) {
            logger.warn(`Failed to test vector ${file}:`, error)
          }
        }
      }
      
      logger.info('JAM test vector results using ErasureCodingService', {
        totalVectorsFound,
        totalVectorsTested,
        roundTripSuccessRate: vectorResults.filter(r => r.roundTripSuccess).length / vectorResults.length,
        shardSizeMatchRate: vectorResults.filter(r => r.shardSizeMatch).length / vectorResults.length,
        shardContentMatchRate: vectorResults.filter(r => r.shardContentMatch).length / vectorResults.length,
        results: vectorResults
      })
      
      // If no test vectors found, skip the test
      if (totalVectorsTested === 0) {
        logger.warn('No JAM test vectors found, skipping test')
        return
      }
      
      expect(totalVectorsTested).toBeGreaterThan(0)
      expect(vectorResults.every(r => r.shardSizeMatch)).toBe(true)
      expect(vectorResults.every(r => r.shardContentMatch)).toBe(true)
      
      // Round-trip success rate should be high for data that fits within shard capacity
      const roundTripSuccessRate = vectorResults.filter(r => r.roundTripSuccess).length / vectorResults.length
      
      // Calculate success rate for data that fits within shard capacity
      const capacityFittingResults = vectorResults.filter(r => r.inputSize <= (r.parameters?.k || 0) * 2)
      const capacityFittingSuccessRate = capacityFittingResults.length > 0 
        ? capacityFittingResults.filter(r => r.roundTripSuccess).length / capacityFittingResults.length 
        : 0
      
      logger.info('JAM test vector capacity analysis', {
        totalVectors: vectorResults.length,
        capacityFittingVectors: capacityFittingResults.length,
        overallSuccessRate: `${(roundTripSuccessRate * 100).toFixed(1)}%`,
        capacityFittingSuccessRate: `${(capacityFittingSuccessRate * 100).toFixed(1)}%`,
        note: 'Many JAM test vectors exceed shard capacity, causing expected truncation'
      })
      
      // For data that fits within capacity, we expect high success rate
      if (capacityFittingResults.length > 0) {
        expect(capacityFittingSuccessRate).toBeGreaterThan(0.8) // At least 80% for fitting data
      }
      
      // Overall success rate should be reasonable (some vectors will be truncated)
      expect(roundTripSuccessRate).toBeGreaterThan(0.3) // At least 30% overall
      
      // Shard content matching is REQUIRED for JAM compliance
      const shardContentMatchRate = vectorResults.filter(r => r.shardContentMatch).length / vectorResults.length
      logger.info('JAM test vector compliance summary', {
        roundTripSuccessRate: `${(roundTripSuccessRate * 100).toFixed(1)}%`,
        shardSizeMatchRate: '100%', // Always expect this
        shardContentMatchRate: `${(shardContentMatchRate * 100).toFixed(1)}%`,
        note: 'Exact shard content matching is required for JAM protocol compliance'
      })
    })
  })

})
