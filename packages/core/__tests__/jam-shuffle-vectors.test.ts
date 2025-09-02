/**
 * JAM Shuffle Test Vector Validation Tests
 *
 * Tests the JAM shuffle implementation against official JAM shuffle test vectors
 * Validates conformance to the Gray Paper Fisher-Yates shuffle specification (Appendix F)
 */

import { logger } from '../src/logger'
import { jamShuffle, shuffleValidatorIndices } from '../src/shuffle'
import { readFileSync } from 'fs'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Hex } from 'viem'

beforeAll(() => {
  logger.init()
})

// Test vector interface based on jamtestvectors structure
interface ShuffleTestVector {
  input: number // Length of input sequence (sequence is [0, 1, 2, ..., input-1])
  entropy: string // 32-byte hex string (without 0x prefix in test vectors)
  output: number[] // Expected shuffled sequence
}

function loadShuffleTestVectors(): ShuffleTestVector[] {
  try {
    const testVectorPath = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jamtestvectors/shuffle/shuffle_tests.json'
    const content = readFileSync(testVectorPath, 'utf-8')
    const testVectors = JSON.parse(content) as ShuffleTestVector[]
    
    logger.info(`Loaded ${testVectors.length} shuffle test vectors`)
    return testVectors
  } catch (error) {
    logger.warn('Could not load shuffle test vectors', { error })
    return []
  }
}

// Helper function to normalize entropy to HashValue format
function normalizeEntropy(entropy: string): Hex {
  // Test vectors don't have 0x prefix, so add it
  return entropy.startsWith('0x') ? entropy as Hex : `0x${entropy}`
}

// Helper function to create input sequence from length
function createInputSequence(length: number): number[] {
  return Array.from({ length }, (_, i) => i)
}

describe('JAM Shuffle Test Vectors', () => {
  const testVectors = loadShuffleTestVectors()
  
  if (testVectors.length === 0) {
    it.skip('No shuffle test vectors found', () => {})
    return
  }

  describe('Official JAM shuffle test vectors', () => {
    testVectors.forEach((testVector, index) => {
      it(`should pass shuffle test vector ${index + 1}: length=${testVector.input}`, () => {
        logger.info(`Testing shuffle vector ${index + 1}`, {
          inputLength: testVector.input,
          entropy: testVector.entropy.slice(0, 16) + '...'
        })
        
        // Create input sequence [0, 1, 2, ..., n-1]
        const inputSequence = createInputSequence(testVector.input)
        
        // Normalize entropy to HashValue format
        const entropy = normalizeEntropy(testVector.entropy)
        
        // Perform shuffle
        const result = jamShuffle(inputSequence, entropy)
        
        // Verify result matches expected output
        expect(result).toEqual(testVector.output)
        
        // Additional validations
        expect(result.length).toBe(testVector.input)
        
        // Verify it's a valid permutation (if input length > 0)
        if (testVector.input > 0) {
          const sortedResult = [...result].sort((a, b) => a - b)
          const expectedSorted = Array.from({ length: testVector.input }, (_, i) => i)
          expect(sortedResult).toEqual(expectedSorted)
        }
      })
    })
  })

  describe('shuffleValidatorIndices function', () => {
    testVectors.forEach((testVector, index) => {
      it(`should match jamShuffle for test vector ${index + 1}`, () => {
        const entropy = normalizeEntropy(testVector.entropy)
        
        const shuffleResult = jamShuffle(
          createInputSequence(testVector.input), 
          entropy
        )
        const validatorResult = shuffleValidatorIndices(testVector.input, entropy)
        
        expect(validatorResult).toEqual(shuffleResult)
        expect(validatorResult).toEqual(testVector.output)
      })
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle empty arrays', () => {
      const result = jamShuffle([], '0x0000000000000000000000000000000000000000000000000000000000000000')
      expect(result).toEqual([])
    })

    it('should handle single element arrays', () => {
      const result = jamShuffle([42], '0x0000000000000000000000000000000000000000000000000000000000000000')
      expect(result).toEqual([42])
    })

    it('should throw on invalid entropy length', () => {
      expect(() => {
        jamShuffle([1, 2, 3], '0x123') // Too short
      }).toThrow('Invalid entropy length')
    })

    it('should handle zero validator count', () => {
      const result = shuffleValidatorIndices(0, '0x0000000000000000000000000000000000000000000000000000000000000000')
      expect(result).toEqual([])
    })

    it('should throw on negative validator count', () => {
      expect(() => {
        shuffleValidatorIndices(-1, '0x0000000000000000000000000000000000000000000000000000000000000000')
      }).toThrow('Invalid validator count')
    })

    it('should produce deterministic results', () => {
      const entropy = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      const input = [0, 1, 2, 3, 4, 5, 6, 7]
      
      const result1 = jamShuffle(input, entropy)
      const result2 = jamShuffle(input, entropy)
      
      expect(result1).toEqual(result2)
    })

    it('should produce different results with different entropy', () => {
      const entropy1 = '0x0000000000000000000000000000000000000000000000000000000000000000'
      const entropy2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      const input = [0, 1, 2, 3, 4, 5, 6, 7]
      
      const result1 = jamShuffle(input, entropy1)
      const result2 = jamShuffle(input, entropy2)
      
      // Results should be different (unless extremely unlikely collision)
      expect(result1).not.toEqual(result2)
    })

    it('should maintain array element count and uniqueness', () => {
      const input = [10, 20, 30, 40, 50]
      const entropy = '0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0'
      
      const result = jamShuffle(input, entropy)
      
      expect(result.length).toBe(input.length)
      expect(new Set(result).size).toBe(input.length) // All elements unique
      
      // All original elements should be present
      for (const element of input) {
        expect(result).toContain(element)
      }
    })
  })

  describe('Performance and scalability', () => {
    it('should handle larger arrays efficiently', () => {
      const largeInput = Array.from({ length: 1000 }, (_, i) => i)
      const entropy = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      
      const start = Date.now()
      const result = jamShuffle(largeInput, entropy)
      const duration = Date.now() - start
      
      expect(result.length).toBe(1000)
      expect(duration).toBeLessThan(100) // Should complete within 100ms
      
      // Verify it's still a valid permutation
      const sortedResult = [...result].sort((a, b) => a - b)
      expect(sortedResult).toEqual(largeInput)
    })
  })
})
