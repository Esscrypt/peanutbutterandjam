/**
 * Unit tests for Gray Paper merkle tree implementation
 * 
 * Tests the core merkle functions: merklizewb, generateWellBalancedProof, and verifyMerkleProof
 * according to Gray Paper specifications (Equations 213-222, 187-207, 174-182)
 */

import { describe, expect, it } from 'vitest'
import { 
  generateWellBalancedProof, 
  merklizewb, 
  verifyMerkleProof 
} from '@pbnjam/core'

describe('Gray Paper Merkle Tree Implementation', () => {
  describe('merklizewb - Well-Balanced Binary Merkle Tree', () => {
    it('should handle empty sequence', () => {
      const [error, root] = merklizewb([])
      expect(error).toBeUndefined()
      expect(root).toBeDefined()
      expect(root?.length).toBe(32) // Zero hash
    })

    it('should handle single value', () => {
      const testData = [new Uint8Array([1, 2, 3, 4])]
      const [error, root] = merklizewb(testData)
      expect(error).toBeUndefined()
      expect(root).toBeDefined()
      expect(root?.length).toBe(32)
    })

    it('should handle two values', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8])
      ]
      const [error, root] = merklizewb(testData)
      expect(error).toBeUndefined()
      expect(root).toBeDefined()
      expect(root?.length).toBe(32)
    })

    it('should handle multiple values', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12]),
        new Uint8Array([13, 14, 15, 16])
      ]
      const [error, root] = merklizewb(testData)
      expect(error).toBeUndefined()
      expect(root).toBeDefined()
      expect(root?.length).toBe(32)
    })

    it('should produce deterministic results', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8])
      ]
      
      const [error1, root1] = merklizewb(testData)
      const [error2, root2] = merklizewb(testData)
      
      expect(error1).toBeUndefined()
      expect(error2).toBeUndefined()
      expect(root1).toEqual(root2)
    })
  })

  describe('generateWellBalancedProof - Trace Function T', () => {
    it('should handle single value (empty proof)', () => {
      const testData = [new Uint8Array([1, 2, 3, 4])]
      const [error, proof] = generateWellBalancedProof(testData, 0)
      
      expect(error).toBeUndefined()
      expect(proof).toBeDefined()
      expect(proof?.path).toEqual([])
      expect(proof?.leafIndex).toBe(0)
    })

    it('should generate proof for two values', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8])
      ]
      
      // Test both leaf indices
      for (let i = 0; i < testData.length; i++) {
        const [error, proof] = generateWellBalancedProof(testData, i)
        expect(error).toBeUndefined()
        expect(proof).toBeDefined()
        expect(proof?.leafIndex).toBe(i)
        expect(proof?.path.length).toBe(1) // One sibling for 2-element tree
      }
    })

    it('should generate proof for multiple values', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12]),
        new Uint8Array([13, 14, 15, 16])
      ]
      
      // Test all leaf indices
      for (let i = 0; i < testData.length; i++) {
        const [error, proof] = generateWellBalancedProof(testData, i)
        expect(error).toBeUndefined()
        expect(proof).toBeDefined()
        expect(proof?.leafIndex).toBe(i)
        expect(proof?.path.length).toBeGreaterThan(0)
      }
    })

    it('should reject invalid leaf index', () => {
      const testData = [new Uint8Array([1, 2, 3, 4])]
      
      const [error1] = generateWellBalancedProof(testData, -1)
      expect(error1).toBeDefined()
      
      const [error2] = generateWellBalancedProof(testData, 1)
      expect(error2).toBeDefined()
    })
  })

  describe('verifyMerkleProof - Proof Verification', () => {
    it('should verify single value proof', () => {
      const testData = [new Uint8Array([1, 2, 3, 4])]
      
      const [rootError, root] = merklizewb(testData)
      expect(rootError).toBeUndefined()
      
      const [proofError, proof] = generateWellBalancedProof(testData, 0)
      expect(proofError).toBeUndefined()
      
      const [verifyError, isValid] = verifyMerkleProof(testData[0], proof!, root!)
      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it('should verify two value proofs', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8])
      ]
      
      const [rootError, root] = merklizewb(testData)
      expect(rootError).toBeUndefined()
      
      // Test both leaf indices
      for (let i = 0; i < testData.length; i++) {
        const [proofError, proof] = generateWellBalancedProof(testData, i)
        expect(proofError).toBeUndefined()
        
        const [verifyError, isValid] = verifyMerkleProof(testData[i], proof!, root!)
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

    it('should verify multiple value proofs', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12]),
        new Uint8Array([13, 14, 15, 16])
      ]
      
      const [rootError, root] = merklizewb(testData)
      expect(rootError).toBeUndefined()
      
      // Test all leaf indices
      for (let i = 0; i < testData.length; i++) {
        const [proofError, proof] = generateWellBalancedProof(testData, i)
        expect(proofError).toBeUndefined()
        
        const [verifyError, isValid] = verifyMerkleProof(testData[i], proof!, root!)
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

    it('should reject invalid proofs', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8])
      ]
      
      const [rootError, root] = merklizewb(testData)
      expect(rootError).toBeUndefined()
      
      const [proofError, proof] = generateWellBalancedProof(testData, 0)
      expect(proofError).toBeUndefined()
      
      // Test with wrong leaf
      const [verifyError, isValid] = verifyMerkleProof(testData[1], proof!, root!)
      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(false)
    })
  })

  describe('End-to-End Integration', () => {
    it('should complete full merkle workflow for various tree sizes', () => {
      const testCases = [
        [new Uint8Array([1, 2, 3, 4])], // 1 element
        [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8])], // 2 elements
        [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8]), new Uint8Array([9, 10, 11, 12])], // 3 elements
        [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8]), new Uint8Array([9, 10, 11, 12]), new Uint8Array([13, 14, 15, 16])], // 4 elements
        [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8]), new Uint8Array([9, 10, 11, 12]), new Uint8Array([13, 14, 15, 16]), new Uint8Array([17, 18, 19, 20])], // 5 elements
      ]

      for (const testData of testCases) {
        // Step 1: Generate merkle root
        const [rootError, root] = merklizewb(testData)
        expect(rootError).toBeUndefined()
        expect(root).toBeDefined()
        expect(root?.length).toBe(32)

        // Step 2: Generate and verify proof for each leaf
        for (let i = 0; i < testData.length; i++) {
          const [proofError, proof] = generateWellBalancedProof(testData, i)
          expect(proofError).toBeUndefined()
          expect(proof).toBeDefined()
          expect(proof?.leafIndex).toBe(i)

          const [verifyError, isValid] = verifyMerkleProof(testData[i], proof!, root!)
          expect(verifyError).toBeUndefined()
          expect(isValid).toBe(true)
        }
      }
    })

    it('should handle different data sizes', () => {
      const testCases = [
        [new Uint8Array([1])], // 1 byte
        [new Uint8Array([1, 2, 3, 4])], // 4 bytes
        [new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])], // 16 bytes
        [new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32])], // 32 bytes
      ]

      for (const testData of testCases) {
        const [rootError, root] = merklizewb(testData)
        expect(rootError).toBeUndefined()
        expect(root).toBeDefined()
        expect(root?.length).toBe(32)

        const [proofError, proof] = generateWellBalancedProof(testData, 0)
        expect(proofError).toBeUndefined()

        const [verifyError, isValid] = verifyMerkleProof(testData[0], proof!, root!)
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

    it('should produce consistent results across multiple runs', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12])
      ]

      // Run multiple times to ensure consistency
      for (let run = 0; run < 5; run++) {
        const [rootError, root] = merklizewb(testData)
        expect(rootError).toBeUndefined()
        expect(root).toBeDefined()

        for (let i = 0; i < testData.length; i++) {
          const [proofError, proof] = generateWellBalancedProof(testData, i)
          expect(proofError).toBeUndefined()

          const [verifyError, isValid] = verifyMerkleProof(testData[i], proof!, root!)
          expect(verifyError).toBeUndefined()
          expect(isValid).toBe(true)
        }
      }
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper merklizewb formula', () => {
      // Test the formula: merklizewb(v, H) ≡ { H(v₀) when |v| = 1, N(v, H) otherwise }
      
      // Single value case
      const singleValue = [new Uint8Array([1, 2, 3, 4])]
      const [singleError, singleRoot] = merklizewb(singleValue)
      expect(singleError).toBeUndefined()
      expect(singleRoot).toBeDefined()

      // Multiple values case
      const multipleValues = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8])
      ]
      const [multipleError, multipleRoot] = merklizewb(multipleValues)
      expect(multipleError).toBeUndefined()
      expect(multipleRoot).toBeDefined()

      // Roots should be different
      expect(singleRoot).not.toEqual(multipleRoot)
    })

    it('should implement Gray Paper trace function T correctly', () => {
      // Test the trace function T(s,i,H) as specified in Gray Paper
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12])
      ]

      // Generate root
      const [rootError, root] = merklizewb(testData)
      expect(rootError).toBeUndefined()

      // Generate trace for each index
      for (let i = 0; i < testData.length; i++) {
        const [traceError, trace] = generateWellBalancedProof(testData, i)
        expect(traceError).toBeUndefined()
        expect(trace?.path).toBeDefined()
        
        // Trace should be valid for reconstruction
        const [verifyError, isValid] = verifyMerkleProof(
          testData[i],
          trace!,
          root!
        )
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })
  })
})
