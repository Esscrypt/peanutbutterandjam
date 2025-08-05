/**
 * IETF VRF Tests
 *
 * Tests the IETF VRF implementation against RFC-9381 specifications
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { BandersnatchCurve, IETFVRFProver, IETFVRFVerifier } from '../index'

// Initialize logger for tests
beforeAll(() => {
  logger.init()
})

describe('IETF VRF', () => {
  const mockSecretKey = {
    bytes: new Uint8Array(32).fill(1),
  }

  const mockPublicKey = {
    bytes: new Uint8Array(32).fill(2),
  }

  const mockInput = {
    message: new TextEncoder().encode('test message'),
  }

  it('should generate VRF proof and output', async () => {
    const result = IETFVRFProver.prove(mockSecretKey, mockInput)

    expect(result.output).toBeDefined()
    expect(result.output.gamma).toBeDefined()
    expect(result.output.hash).toBeDefined()
    expect(result.proof).toBeDefined()
    expect(result.proof.bytes).toBeDefined()
  })

  it('should verify VRF proof', () => {
    const result = IETFVRFProver.prove(mockSecretKey, mockInput)

    const isValid = IETFVRFVerifier.verify(
      mockPublicKey,
      mockInput,
      result.output,
      result.proof,
    )

    expect(isValid).toBe(true)
  })

  it('should handle different input messages', () => {
    const input1 = { message: new TextEncoder().encode('message 1') }
    const input2 = { message: new TextEncoder().encode('message 2') }

    const result1 = IETFVRFProver.prove(mockSecretKey, input1)
    const result2 = IETFVRFProver.prove(mockSecretKey, input2)

    // Different inputs should produce different outputs
    expect(result1.output.hash).not.toEqual(result2.output.hash)
  })

  it('should handle auxiliary data', () => {
    const auxData = new Uint8Array([1, 2, 3, 4])

    const result = IETFVRFProver.prove(mockSecretKey, mockInput, auxData)

    expect(result.output).toBeDefined()
    expect(result.proof).toBeDefined()
  })
})

describe('Bandersnatch Curve', () => {
  it('should perform point addition', () => {
    const point1 = { x: 1n, y: 2n, isInfinity: false }
    const point2 = { x: 3n, y: 4n, isInfinity: false }

    const result = BandersnatchCurve.add(point1, point2)

    expect(result.isInfinity).toBe(false)
    expect(result.x).toBeDefined()
    expect(result.y).toBeDefined()
  })

  it('should handle infinity point', () => {
    const point = { x: 1n, y: 2n, isInfinity: false }
    const infinity = BandersnatchCurve.INFINITY

    const result1 = BandersnatchCurve.add(point, infinity)
    const result2 = BandersnatchCurve.add(infinity, point)

    expect(result1).toEqual(point)
    expect(result2).toEqual(point)
  })

  it('should perform scalar multiplication', () => {
    const point = { x: 1n, y: 2n, isInfinity: false }
    const scalar = 5n

    const result = BandersnatchCurve.scalarMultiply(point, scalar)

    expect(result.isInfinity).toBe(false)
    expect(result.x).toBeDefined()
    expect(result.y).toBeDefined()
  })

  it('should handle zero scalar', () => {
    const point = { x: 1n, y: 2n, isInfinity: false }
    const scalar = 0n

    const result = BandersnatchCurve.scalarMultiply(point, scalar)

    expect(result.isInfinity).toBe(true)
  })

  it('should convert between points and bytes', () => {
    const point = { x: 123n, y: 456n, isInfinity: false }

    const bytes = BandersnatchCurve.pointToBytes(point)
    const reconstructed = BandersnatchCurve.bytesToPoint(bytes)

    expect(reconstructed.x).toBe(point.x)
    expect(reconstructed.y).toBe(point.y)
    expect(reconstructed.isInfinity).toBe(point.isInfinity)
  })

  it('should hash to curve', () => {
    const data = new TextEncoder().encode('test data')

    const point = BandersnatchCurve.hashToCurve(data)

    expect(point.isInfinity).toBe(false)
    expect(point.x).toBeDefined()
    expect(point.y).toBeDefined()
  })

  it('should hash curve points', () => {
    const point = { x: 123n, y: 456n, isInfinity: false }

    const hash = BandersnatchCurve.hashPoint(point)

    expect(hash).toBeInstanceOf(Uint8Array)
    expect(hash.length).toBe(32)
  })
})
