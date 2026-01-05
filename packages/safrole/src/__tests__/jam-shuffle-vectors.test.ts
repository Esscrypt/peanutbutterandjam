/**
 * JAM Shuffle Test Vector Validation Tests
 *
 * Tests the shuffle implementation against official JAM test vectors
 * from submodules/jamtestvectors/shuffle/shuffle_tests.json
 */

import { logger, jamShuffle } from '@pbnjam/core'
import { readFileSync } from 'fs'
import { join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
// import { computeGuarantorAssignments } from '@pbnjam/safrole'

beforeAll(() => {
  logger.init()
})

interface ShuffleTestVector {
  input: number // Array length to shuffle [0, 1, 2, ..., input-1]
  entropy: string // 32-byte hex entropy
  output: number[] // Expected shuffled result
}

function loadShuffleTestVectors(): ShuffleTestVector[] {
  const testVectorPath = join(process.cwd(), '../../submodules/jamtestvectors/shuffle/shuffle_tests.json')
  const content = readFileSync(testVectorPath, 'utf-8')
  return JSON.parse(content) as ShuffleTestVector[]
}

// Using core package shuffle implementation

/*
// Inline shuffle implementation - now using core package version
function fromLittleEndianBytes(bytes: Uint8Array): number {
  let result = 0
  for (let i = 0; i < bytes.length; i++) {
    result += bytes[i] * Math.pow(256, i)
  }
  return result >>> 0 // Convert to unsigned 32-bit
}

function jamShuffle<T>(validators: T[], entropy: string): T[] {
  // Implementation moved to @pbnjam/core package
}
*/

// Test function that uses the core shuffle implementation
function jamShuffleTest(input: number[], entropy: string): number[] {
  return jamShuffle(input, entropy as `0x${string}`)
}

describe('JAM Shuffle Test Vectors', () => {
  let testVectors: ShuffleTestVector[] = []

  beforeAll(() => {
    try {
      testVectors = loadShuffleTestVectors()
      logger.info(`Loaded ${testVectors.length} shuffle test vectors`)
    } catch (error) {
      logger.error('Failed to load shuffle test vectors', { error })
      testVectors = []
    }
  })

  it('should load test vectors successfully', () => {
    expect(testVectors).toBeDefined()
    expect(testVectors.length).toBeGreaterThan(0)
  })

  it('should match all test vectors', () => {
    if (testVectors.length === 0) {
      throw new Error('No test vectors loaded')
    }
    
    testVectors.forEach((testVector, _index) => {
      // Create input sequence [0, 1, 2, ..., input-1]
      const inputSequence = Array.from({ length: testVector.input }, (_, i) => i)
      
      // Apply shuffle
      const result = jamShuffleTest(inputSequence, testVector.entropy)
      
      // Verify result
      expect(result).toEqual(testVector.output)
      expect(result.length).toBe(testVector.input)
      
      // Verify all elements are present (if input > 0)
      if (testVector.input > 0) {
        const sortedResult = [...result].sort((a, b) => a - b)
        const expectedSorted = Array.from({ length: testVector.input }, (_, i) => i)
        expect(sortedResult).toEqual(expectedSorted)
      }
    })
  })

  it('should handle edge cases correctly', () => {
    // Empty array
    expect(jamShuffleTest([], '0'.repeat(64))).toEqual([])
    
    // Single element
    expect(jamShuffleTest([0], '0'.repeat(64))).toEqual([0])
    
    // Two elements with deterministic entropy
    const twoElementResult = jamShuffleTest([0, 1], 'ff'.repeat(32))
    expect(twoElementResult).toHaveLength(2)
    expect(twoElementResult.sort()).toEqual([0, 1])
  })

  it('should be deterministic', () => {
    const input = [0, 1, 2, 3, 4]
    const entropy = 'abcd'.repeat(16) // 64 chars
    
    const result1 = jamShuffleTest(input, entropy)
    const result2 = jamShuffleTest(input, entropy)
    
    expect(result1).toEqual(result2)
  })

  it('should produce different results with different entropy', () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const entropy1 = '0'.repeat(64)
    const entropy2 = 'f'.repeat(64)
    
    const result1 = jamShuffleTest(input, entropy1)
    const result2 = jamShuffleTest(input, entropy2)
    
    // Results should be different (with very high probability)
    expect(result1).not.toEqual(result2)
    
    // But both should contain the same elements
    expect(result1.sort()).toEqual(result2.sort())
  })
})

// describe('Guarantor Assignment Shuffle Integration', () => {
//   it('should integrate shuffle into guarantor assignments', () => {
//     const epochalEntropy = ('0x' + 'ab'.repeat(32)) as `0x${string}`
//     const currentTime = 100n
//     const activeSet = Array.from({ length: 10 }, (_, _i) => ({
//       bandersnatch: `0x${'00'.repeat(32)}` as `0x${string}`,
//       ed25519: `0x${'00'.repeat(32)}` as `0x${string}`,
//       bls: `0x${'00'.repeat(144)}` as `0x${string}`,
//       metadata: `0x${'00'.repeat(128)}` as `0x${string}`,
//     }))
    
//     const assignments = computeGuarantorAssignments(epochalEntropy, currentTime, activeSet)
    
//     expect(assignments).toHaveLength(10)
//     expect(assignments.every(a => a >= 0 && a < 341)).toBe(true) // Core count = 341
//   })
// })
