/**
 * Simplified Shard Service Proof Tests
 * 
 * Tests the core merkle proof functionality using direct core methods
 */

import { describe, expect, it } from 'vitest'
import { 
  blake2bHash, 
  bytesToHex, 
  generateWellBalancedProof, 
  hexToBytes, 
  merklizewb, 
  verifyMerkleProof 
} from '@pbnj/core'

describe('Core Merkle Proof Methods', () => {
  describe('merklizewb function', () => {
    it('should calculate merkle root for multiple items', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12])
      ]

      const [error, root] = merklizewb(testData, blake2bHash)
      
      expect(error).toBeUndefined()
      expect(root).toBeDefined()
      expect(root.length).toBe(32)
    })

    it('should handle single item correctly', () => {
      const testData = [new Uint8Array([1, 2, 3, 4])]

      const [error, root] = merklizewb(testData, blake2bHash)
      
      expect(error).toBeUndefined()
      expect(root).toBeDefined()
      expect(root.length).toBe(32)
    })

    it('should handle empty array', () => {
      const testData: Uint8Array[] = []

      const [error, root] = merklizewb(testData, blake2bHash)
      
      expect(error).toBeUndefined()
      expect(root).toBeDefined()
      expect(root.length).toBe(32)
      
      // Should be zero hash for empty array
      const zeroHash = new Uint8Array(32)
      expect(root.every((byte, i) => byte === zeroHash[i])).toBe(true)
    })
  })

  describe('generateWellBalancedProof function', () => {
    it('should generate valid proofs for all indices', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12]),
        new Uint8Array([13, 14, 15, 16])
      ]

      for (let i = 0; i < testData.length; i++) {
        const [error, proof] = generateWellBalancedProof(testData, i, blake2bHash)
        
        expect(error).toBeUndefined()
        expect(proof).toBeDefined()
        expect(proof.path).toBeDefined()
        expect(proof.leafIndex).toBe(i)
      }
    })

    it('should handle single item proof', () => {
      const testData = [new Uint8Array([1, 2, 3, 4])]

      const [error, proof] = generateWellBalancedProof(testData, 0, blake2bHash)
      
      expect(error).toBeUndefined()
      expect(proof).toBeDefined()
      expect(proof.path.length).toBe(0) // Single item has empty path
      expect(proof.leafIndex).toBe(0)
    })

    it('should reject invalid leaf index', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8])
      ]

      const [error] = generateWellBalancedProof(testData, 5, blake2bHash)
      
      expect(error).toBeDefined()
      expect(error?.message).toContain('Leaf index out of range')
    })
  })

  describe('verifyMerkleProof function', () => {
    it('should verify valid proofs correctly', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12])
      ]

      // Generate root and proof
      const [rootError, root] = merklizewb(testData, blake2bHash)
      expect(rootError).toBeUndefined()

      const [proofError, proof] = generateWellBalancedProof(testData, 1, blake2bHash)
      expect(proofError).toBeUndefined()

      // Verify proof
      const [verifyError, isValid] = verifyMerkleProof(
        testData[1],
        proof,
        root,
        blake2bHash
      )
      
      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it('should reject invalid proofs', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12])
      ]

      // Generate root and proof
      const [rootError, root] = merklizewb(testData, blake2bHash)
      expect(rootError).toBeUndefined()

      const [proofError, proof] = generateWellBalancedProof(testData, 1, blake2bHash)
      expect(proofError).toBeUndefined()

      // Verify with wrong leaf data
      const wrongLeaf = new Uint8Array([99, 99, 99, 99])
      const [verifyError, isValid] = verifyMerkleProof(
        wrongLeaf,
        proof,
        root,
        blake2bHash
      )
      
      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(false)
    })

    it('should verify all leaves in a tree', () => {
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12]),
        new Uint8Array([13, 14, 15, 16])
      ]

      // Generate root
      const [rootError, root] = merklizewb(testData, blake2bHash)
      expect(rootError).toBeUndefined()

      // Verify each leaf
      for (let i = 0; i < testData.length; i++) {
        const [proofError, proof] = generateWellBalancedProof(testData, i, blake2bHash)
        expect(proofError).toBeUndefined()

        const [verifyError, isValid] = verifyMerkleProof(
          testData[i],
          proof,
          root,
          blake2bHash
        )
        
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })
  })

  describe('End-to-End Proof Workflow', () => {
    it('should complete full proof generation and verification cycle', () => {
      // Simulate bundle shards
      const bundleShards = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12])
      ]

      // Simulate segment shard roots
      const segmentShards = [
        new Uint8Array([13, 14]),
        new Uint8Array([15, 16]),
        new Uint8Array([17, 18])
      ]

      // Build shard sequence (bundle shards + segment roots)
      const shardSequence = [...bundleShards, ...segmentShards]

      // Calculate merkle root
      const [rootError, merkleRoot] = merklizewb(shardSequence, blake2bHash)
      expect(rootError).toBeUndefined()
      expect(merkleRoot).toBeDefined()

      // Generate and verify proof for each bundle shard
      for (let i = 0; i < bundleShards.length; i++) {
        const [proofError, proof] = generateWellBalancedProof(
          shardSequence,
          i,
          blake2bHash
        )
        expect(proofError).toBeUndefined()

        const [verifyError, isValid] = verifyMerkleProof(
          shardSequence[i],
          proof,
          merkleRoot,
          blake2bHash
        )
        
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }

      // Generate and verify proof for each segment root
      for (let i = bundleShards.length; i < shardSequence.length; i++) {
        const [proofError, proof] = generateWellBalancedProof(
          shardSequence,
          i,
          blake2bHash
        )
        expect(proofError).toBeUndefined()

        const [verifyError, isValid] = verifyMerkleProof(
          shardSequence[i],
          proof,
          merkleRoot,
          blake2bHash
        )
        
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

    it('should handle Gray Paper trace function T correctly', () => {
      // Test the trace function T(s,i,H) as specified in Gray Paper
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12])
      ]

      // Generate root
      const [rootError, root] = merklizewb(testData, blake2bHash)
      expect(rootError).toBeUndefined()

      // Generate trace for each index
      for (let i = 0; i < testData.length; i++) {
        const [traceError, trace] = generateWellBalancedProof(testData, i, blake2bHash)
        expect(traceError).toBeUndefined()
        expect(trace.path).toBeDefined()
        
        // Trace should be valid for reconstruction
        const [verifyError, isValid] = verifyMerkleProof(
          testData[i],
          trace,
          root,
          blake2bHash
        )
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large sequences efficiently', () => {
      // Create a larger test sequence
      const testData: Uint8Array[] = []
      for (let i = 0; i < 100; i++) {
        testData.push(new Uint8Array([i, i + 1, i + 2, i + 3]))
      }

      const [rootError, root] = merklizewb(testData, blake2bHash)
      expect(rootError).toBeUndefined()
      expect(root).toBeDefined()

      // Test a few proofs from the large sequence
      const testIndices = [0, 25, 50, 75, 99]
      for (const index of testIndices) {
        const [proofError, proof] = generateWellBalancedProof(testData, index, blake2bHash)
        expect(proofError).toBeUndefined()

        const [verifyError, isValid] = verifyMerkleProof(
          testData[index],
          proof,
          root,
          blake2bHash
        )
        
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

    it('should handle identical data correctly', () => {
      const identicalData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([1, 2, 3, 4])
      ]

      const [rootError, root] = merklizewb(identicalData, blake2bHash)
      expect(rootError).toBeUndefined()

      // All proofs should be valid
      for (let i = 0; i < identicalData.length; i++) {
        const [proofError, proof] = generateWellBalancedProof(identicalData, i, blake2bHash)
        expect(proofError).toBeUndefined()

        const [verifyError, isValid] = verifyMerkleProof(
          identicalData[i],
          proof,
          root,
          blake2bHash
        )
        
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })
  })
})
