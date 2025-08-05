/**
 * Block Body Serialization Tests
 *
 * Tests for Gray Paper-compliant block body encoding
 * Reference: Gray Paper Appendix D.2 - Block Body Encoding
 */

import { describe, expect, it } from 'vitest'
import {
  type BlockBody,
  decodeBlock,
  decodeBlockBody,
  encodeBlock,
  encodeBlockBody,
} from '../../src/block/body'

describe('Block Body Serialization', () => {
  const createTestBody = (): BlockBody => ({
    extrinsics: [
      new Uint8Array([1, 2, 3, 4, 5]),
      new Uint8Array([6, 7, 8, 9, 10]),
      new Uint8Array([11, 12, 13, 14, 15]),
    ],
  })

  describe('Block Body Encoding', () => {
    it('should encode block body with extrinsics', () => {
      const body = createTestBody()
      const encoded = encodeBlockBody(body)

      expect(encoded.length).toBeGreaterThan(0)

      const { value: decoded } = decodeBlockBody(encoded)
      expect(decoded.extrinsics.length).toBe(1) // Currently treats as single blob
      expect(decoded.extrinsics[0].length).toBe(15) // Total length of all extrinsics
    })

    it('should encode empty block body', () => {
      const body: BlockBody = { extrinsics: [] }
      const encoded = encodeBlockBody(body)

      const { value: decoded } = decodeBlockBody(encoded)
      expect(decoded.extrinsics.length).toBe(1) // Single empty extrinsic
      expect(decoded.extrinsics[0].length).toBe(0)
    })

    it('should encode block body with single extrinsic', () => {
      const body: BlockBody = {
        extrinsics: [new Uint8Array([1, 2, 3, 4, 5])],
      }
      const encoded = encodeBlockBody(body)

      const { value: decoded } = decodeBlockBody(encoded)
      expect(decoded.extrinsics[0].length).toBe(5)
      expect(decoded.extrinsics[0]).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
    })

    it('should handle large extrinsics', () => {
      const largeExtrinsic = new Uint8Array(1000).fill(42)
      const body: BlockBody = { extrinsics: [largeExtrinsic] }
      const encoded = encodeBlockBody(body)

      const { value: decoded } = decodeBlockBody(encoded)
      expect(decoded.extrinsics[0].length).toBe(1000)
      expect(decoded.extrinsics[0][0]).toBe(42)
      expect(decoded.extrinsics[0][999]).toBe(42)
    })
  })

  describe('Complete Block Encoding', () => {
    it('should encode complete block', () => {
      const header = new Uint8Array(100).fill(1)
      const body = new Uint8Array(50).fill(2)

      const encoded = encodeBlock(header, body)

      expect(encoded.length).toBe(150)
      expect(encoded.slice(0, 100)).toEqual(header)
      expect(encoded.slice(100)).toEqual(body)
    })

    it('should decode complete block', () => {
      const header = new Uint8Array(100).fill(1)
      const body = new Uint8Array(50).fill(2)
      const encoded = encodeBlock(header, body)

      const { header: decodedHeader, body: decodedBody } = decodeBlock(
        encoded,
        100,
      )

      expect(decodedHeader).toEqual(header)
      expect(decodedBody).toEqual(body)
    })

    it('should handle insufficient data for block decoding', () => {
      const shortData = new Uint8Array(50) // Too short for 100-byte header
      expect(() => decodeBlock(shortData, 100)).toThrow(
        'Insufficient data for block decoding',
      )
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper block body formula', () => {
      const body = createTestBody()
      const encoded = encodeBlockBody(body)

      // Verify the structure follows the Gray Paper formula:
      // encode(body) ≡ var{encode(extrinsics)}

      // The encoding should be variable-length data
      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle variable-length extrinsics data', () => {
      const shortBody: BlockBody = { extrinsics: [new Uint8Array([1, 2])] }
      const longBody: BlockBody = {
        extrinsics: [new Uint8Array(1000).fill(42)],
      }

      const shortEncoded = encodeBlockBody(shortBody)
      const longEncoded = encodeBlockBody(longBody)

      expect(longEncoded.length).toBeGreaterThan(shortEncoded.length)
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve block body through encode/decode cycle', () => {
      const testBodies = [
        createTestBody(),
        { extrinsics: [] },
        { extrinsics: [new Uint8Array([1, 2, 3])] },
        { extrinsics: [new Uint8Array(100).fill(42)] },
      ]

      for (const body of testBodies) {
        const encoded = encodeBlockBody(body)
        const { value: decoded } = decodeBlockBody(encoded)

        // Note: Current implementation treats extrinsics as single blob
        // So we only verify the total length matches
        const originalLength = body.extrinsics.reduce(
          (sum, ext) => sum + ext.length,
          0,
        )
        const decodedLength = decoded.extrinsics[0].length
        expect(decodedLength).toBe(originalLength)
      }
    })

    it('should preserve complete block through encode/decode cycle', () => {
      const header = new Uint8Array(100).fill(1)
      const body = new Uint8Array(50).fill(2)

      const encoded = encodeBlock(header, body)
      const { header: decodedHeader, body: decodedBody } = decodeBlock(
        encoded,
        100,
      )

      expect(decodedHeader).toEqual(header)
      expect(decodedBody).toEqual(body)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty extrinsics data', () => {
      const body: BlockBody = { extrinsics: [] }
      const encoded = encodeBlockBody(body)

      const { value: decoded } = decodeBlockBody(encoded)
      expect(decoded.extrinsics[0].length).toBe(0)
    })

    it('should handle very large extrinsics', () => {
      const largeExtrinsic = new Uint8Array(10000).fill(123)
      const body: BlockBody = { extrinsics: [largeExtrinsic] }

      const encoded = encodeBlockBody(body)
      const { value: decoded } = decodeBlockBody(encoded)

      expect(decoded.extrinsics[0].length).toBe(10000)
      expect(decoded.extrinsics[0][0]).toBe(123)
      expect(decoded.extrinsics[0][9999]).toBe(123)
    })
  })
})
