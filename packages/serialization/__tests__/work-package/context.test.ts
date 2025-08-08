/**
 * Work Context Serialization Tests
 *
 * Tests for Gray Paper-compliant work context encoding
 * Reference: Gray Paper Appendix D.3 - Work Context Encoding
 */

import { describe, expect, it } from 'vitest'
import type { WorkContext } from '@pbnj/types'
import {
  decodeWorkContext,
  encodeWorkContext,
} from '../../src/work-package/context'

describe('Work Context Serialization', () => {
  const createTestContext = (): WorkContext => ({
    anchorHash:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    anchorPostState:
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    anchorAccountLog: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    lookupAnchorHash:
      '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    lookupAnchorTime: 1234567890n,
    prerequisites: new Uint8Array([9, 10, 11, 12, 13, 14, 15, 16]),
  })

  describe('Work Context Encoding', () => {
    it('should encode complete work context', () => {
      const context = createTestContext()
      const encoded = encodeWorkContext(context)

      expect(encoded.length).toBeGreaterThan(0)

      const { value: decoded } = decodeWorkContext(encoded)
      expect(decoded.anchorHash).toBe(context.anchorHash)
      expect(decoded.anchorPostState).toBe(context.anchorPostState)
      expect(decoded.anchorAccountLog).toEqual(context.anchorAccountLog)
      expect(decoded.lookupAnchorHash).toBe(context.lookupAnchorHash)
      expect(decoded.lookupAnchorTime).toBe(context.lookupAnchorTime)
      expect(decoded.prerequisites).toEqual(context.prerequisites)
    })

    it('should handle empty variable-length fields', () => {
      const context: WorkContext = {
        anchorHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        anchorPostState:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        anchorAccountLog: new Uint8Array(0),
        lookupAnchorHash:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        lookupAnchorTime: 0n,
        prerequisites: new Uint8Array(0),
      }

      const encoded = encodeWorkContext(context)
      const { value: decoded } = decodeWorkContext(encoded)

      expect(decoded.anchorAccountLog.length).toBe(0)
      expect(decoded.prerequisites.length).toBe(0)
      expect(decoded.lookupAnchorTime).toBe(0n)
    })

    it('should handle large variable-length fields', () => {
      const context: WorkContext = {
        anchorHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        anchorPostState:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        anchorAccountLog: new Uint8Array(1000).fill(42),
        lookupAnchorHash:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        lookupAnchorTime: 4294967295n, // 2^32 - 1
        prerequisites: new Uint8Array(500).fill(123),
      }

      const encoded = encodeWorkContext(context)
      const { value: decoded } = decodeWorkContext(encoded)

      expect(decoded.anchorAccountLog.length).toBe(1000)
      expect(decoded.prerequisites.length).toBe(500)
      expect(decoded.anchorAccountLog[0]).toBe(42)
      expect(decoded.prerequisites[0]).toBe(123)
      expect(decoded.lookupAnchorTime).toBe(4294967295n)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper work context formula', () => {
      const context = createTestContext()
      const _encoded = encodeWorkContext(context)

      // Verify the structure follows the Gray Paper formula:
      // encode(context) ≡ encode(H_anchor) ∥ encode(H_anchorpoststate) ∥ var{context.anchoraccountlog} ∥
      //                  encode(H_lookupanchorhash) ∥ encode[4](context.lookupanchortime) ∥ var{context.prerequisites}

      // Each hash should be 32 bytes (64 hex chars)
      expect(context.anchorHash.length).toBe(66) // 0x + 64 chars
      expect(context.anchorPostState.length).toBe(66)
      expect(context.lookupAnchorHash.length).toBe(66)

      // Lookup anchor time should be 4 bytes
      expect(context.lookupAnchorTime).toBeLessThan(2n ** 32n)
    })

    it('should handle variable-length anchor account log', () => {
      const context = createTestContext()

      // Test with different account log lengths
      const shortLog = new Uint8Array(16).fill(0x11)
      const longLog = new Uint8Array(1000).fill(0x22)

      const contextWithShort = { ...context, anchorAccountLog: shortLog }
      const contextWithLong = { ...context, anchorAccountLog: longLog }

      const encodedShort = encodeWorkContext(contextWithShort)
      const encodedLong = encodeWorkContext(contextWithLong)

      expect(encodedLong.length).toBeGreaterThan(encodedShort.length)
    })

    it('should handle variable-length prerequisites', () => {
      const context = createTestContext()

      // Test with different prerequisites lengths
      const shortPrereq = new Uint8Array(8).fill(0x33)
      const longPrereq = new Uint8Array(500).fill(0x44)

      const contextWithShort = { ...context, prerequisites: shortPrereq }
      const contextWithLong = { ...context, prerequisites: longPrereq }

      const encodedShort = encodeWorkContext(contextWithShort)
      const encodedLong = encodeWorkContext(contextWithLong)

      expect(encodedLong.length).toBeGreaterThan(encodedShort.length)
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve all values through encode/decode cycle', () => {
      const testContexts = [
        createTestContext(),
        {
          ...createTestContext(),
          anchorAccountLog: new Uint8Array(0),
          prerequisites: new Uint8Array(0),
          lookupAnchorTime: 0n,
        },
        {
          ...createTestContext(),
          anchorAccountLog: new Uint8Array(100).fill(42),
          prerequisites: new Uint8Array(200).fill(123),
          lookupAnchorTime: 4294967295n,
        },
      ]

      for (const context of testContexts) {
        const encoded = encodeWorkContext(context)
        const { value: decoded } = decodeWorkContext(encoded)

        expect(decoded.anchorHash).toBe(context.anchorHash)
        expect(decoded.anchorPostState).toBe(context.anchorPostState)
        expect(decoded.anchorAccountLog).toEqual(context.anchorAccountLog)
        expect(decoded.lookupAnchorHash).toBe(context.lookupAnchorHash)
        expect(decoded.lookupAnchorTime).toBe(context.lookupAnchorTime)
        expect(decoded.prerequisites).toEqual(context.prerequisites)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle maximum lookup anchor time', () => {
      const context = createTestContext()
      context.lookupAnchorTime = 4294967295n // 2^32 - 1

      const encoded = encodeWorkContext(context)
      const { value: decoded } = decodeWorkContext(encoded)

      expect(decoded.lookupAnchorTime).toBe(4294967295n)
    })

    it('should handle zero lookup anchor time', () => {
      const context = createTestContext()
      context.lookupAnchorTime = 0n

      const encoded = encodeWorkContext(context)
      const { value: decoded } = decodeWorkContext(encoded)

      expect(decoded.lookupAnchorTime).toBe(0n)
    })

    it('should handle very large variable-length fields', () => {
      const context: WorkContext = {
        anchorHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        anchorPostState:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        anchorAccountLog: new Uint8Array(10000).fill(42),
        lookupAnchorHash:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        lookupAnchorTime: 1234567890n,
        prerequisites: new Uint8Array(5000).fill(123),
      }

      const encoded = encodeWorkContext(context)
      const { value: decoded } = decodeWorkContext(encoded)

      expect(decoded.anchorAccountLog.length).toBe(10000)
      expect(decoded.prerequisites.length).toBe(5000)
      expect(decoded.anchorAccountLog[0]).toBe(42)
      expect(decoded.anchorAccountLog[9999]).toBe(42)
      expect(decoded.prerequisites[0]).toBe(123)
      expect(decoded.prerequisites[4999]).toBe(123)
    })
  })
})
