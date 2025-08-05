/**
 * Ring VRF Tests
 *
 * Tests the Ring VRF implementation for anonymity and correctness
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  type RingVRFInput,
  type RingVRFParams,
  RingVRFProver,
  type RingVRFRing,
  RingVRFVerifier,
  type VRFPublicKey,
  type VRFSecretKey,
} from '../index'

// Initialize logger for tests
beforeAll(() => {
  logger.init()
})

describe('Ring VRF', () => {
  // Mock data for testing
  const mockSecretKey: VRFSecretKey = {
    bytes: new Uint8Array(32).fill(1),
  }

  const mockPublicKeys: VRFPublicKey[] = [
    { bytes: new Uint8Array(32).fill(1) },
    { bytes: new Uint8Array(32).fill(2) },
    { bytes: new Uint8Array(32).fill(3) },
    { bytes: new Uint8Array(32).fill(4) },
  ]

  const mockRing: RingVRFRing = {
    publicKeys: mockPublicKeys,
    size: mockPublicKeys.length,
    commitment: new Uint8Array(32).fill(0),
  }

  const mockParams: RingVRFParams = {
    ringSize: mockPublicKeys.length,
    securityParam: 128,
    hashFunction: 'sha256',
  }

  const mockInput: RingVRFInput = {
    message: new TextEncoder().encode('test message'),
    ring: mockRing,
    proverIndex: 0,
    params: mockParams,
  }

  it('should generate Ring VRF proof and output', async () => {
    const result = RingVRFProver.prove(mockSecretKey, mockInput)

    expect(result.output).toBeDefined()
    expect(result.output.gamma).toBeDefined()
    expect(result.output.hash).toBeDefined()
    expect(result.output.ringCommitment).toBeDefined()
    expect(result.output.positionCommitment).toBeDefined()
    expect(result.output.anonymitySetSize).toBe(mockRing.size)

    expect(result.proof).toBeDefined()
    expect(result.proof.zkProof).toBeDefined()
    expect(result.proof.positionCommitment).toBeDefined()
    expect(result.proof.ringSignature).toBeDefined()
  })

  it('should validate ring input parameters', () => {
    // Test valid input
    expect(() => RingVRFProver.prove(mockSecretKey, mockInput)).not.toThrow()

    // Test invalid ring size (too small)
    const smallRingInput: RingVRFInput = {
      ...mockInput,
      ring: { ...mockRing, size: 1, publicKeys: [mockPublicKeys[0]] },
    }
    expect(() => RingVRFProver.prove(mockSecretKey, smallRingInput)).toThrow(
      'Ring size too small',
    )

    // Test invalid prover index
    const invalidIndexInput: RingVRFInput = {
      ...mockInput,
      proverIndex: 10,
    }
    expect(() => RingVRFProver.prove(mockSecretKey, invalidIndexInput)).toThrow(
      'Invalid prover index',
    )

    // Test ring size mismatch
    const mismatchInput: RingVRFInput = {
      ...mockInput,
      ring: { ...mockRing, size: 5, publicKeys: mockPublicKeys },
    }
    expect(() => RingVRFProver.prove(mockSecretKey, mismatchInput)).toThrow(
      'Ring size mismatch',
    )
  })

  it('should handle different ring sizes', () => {
    // Test with different ring sizes
    const ringSizes = [2, 4, 8, 16]

    for (const size of ringSizes) {
      const publicKeys = Array.from({ length: size }, (_, i) => ({
        bytes: new Uint8Array(32).fill(i + 1),
      }))

      const ring: RingVRFRing = {
        publicKeys,
        size,
        commitment: new Uint8Array(32).fill(0),
      }

      const input: RingVRFInput = {
        ...mockInput,
        ring,
        proverIndex: 0,
        params: { ...mockParams, ringSize: size },
      }

      const result = RingVRFProver.prove(mockSecretKey, input)
      expect(result.output.anonymitySetSize).toBe(size)
    }
  })

  it('should handle different prover positions', () => {
    // Test with different prover positions
    for (let i = 0; i < mockRing.size; i++) {
      const input: RingVRFInput = {
        ...mockInput,
        proverIndex: i,
      }

      const result = RingVRFProver.prove(mockSecretKey, input)
      expect(result.output).toBeDefined()
      expect(result.proof).toBeDefined()
    }
  })

  it('should handle auxiliary data', () => {
    const auxData = new Uint8Array([1, 2, 3, 4])

    const result = RingVRFProver.prove(mockSecretKey, mockInput, auxData)

    expect(result.output).toBeDefined()
    expect(result.proof.auxData).toEqual(auxData)
  })

  it('should generate different outputs for different inputs', () => {
    const input1: RingVRFInput = {
      ...mockInput,
      message: new TextEncoder().encode('message 1'),
    }

    const input2: RingVRFInput = {
      ...mockInput,
      message: new TextEncoder().encode('message 2'),
    }

    const result1 = RingVRFProver.prove(mockSecretKey, input1)
    const result2 = RingVRFProver.prove(mockSecretKey, input2)

    // Different inputs should produce different outputs
    expect(result1.output.hash).not.toEqual(result2.output.hash)
  })

  it('should maintain anonymity properties', () => {
    // Test that outputs don't reveal the prover's position
    const results = []

    for (let i = 0; i < mockRing.size; i++) {
      const input: RingVRFInput = {
        ...mockInput,
        proverIndex: i,
      }

      const result = RingVRFProver.prove(mockSecretKey, input)
      results.push(result)
    }

    // All outputs should have the same structure
    for (const result of results) {
      expect(result.output.anonymitySetSize).toBe(mockRing.size)
      expect(result.output.ringCommitment).toBeDefined()
      expect(result.output.positionCommitment).toBeDefined()
    }
  })

  it('should verify Ring VRF proof', () => {
    const result = RingVRFProver.prove(mockSecretKey, mockInput)

    const isValid = RingVRFVerifier.verify(
      mockRing.publicKeys,
      mockInput,
      result.output,
      result.proof,
    )

    expect(isValid).toBe(true)
  })

  it('should verify Ring VRF proof with detailed result', () => {
    const result = RingVRFProver.prove(mockSecretKey, mockInput)

    const verificationResult = RingVRFVerifier.verifyWithResult(
      mockRing.publicKeys,
      mockInput,
      result.output,
      result.proof,
    )

    expect(verificationResult.isValid).toBe(true)
    expect(verificationResult.verificationTime).toBeGreaterThanOrEqual(0)
    expect(verificationResult.metadata?.scheme).toBe('RING')
    expect(verificationResult.metadata?.usedAuxData).toBe(false)
  })
})
