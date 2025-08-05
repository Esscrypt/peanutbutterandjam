/**
 * Fixed-Length Integer Serialization Tests
 *
 * Tests for Gray Paper-compliant fixed-length integer encoding
 * Reference: Gray Paper Appendix D.1 - Fixed-Length Integer Encoding
 */

import { describe, expect, it } from 'vitest'
import {
  decodeFixedLength,
  decodeUint8,
  decodeUint16,
  decodeUint32,
  decodeUint64,
  encodeFixedLength,
  encodeUint8,
  encodeUint16,
  encodeUint32,
  encodeUint64,
} from '../../src/core/fixed-length'

describe('Fixed-Length Integer Encoding', () => {
  describe('Basic Encoding/Decoding', () => {
    it('should encode and decode 8-bit integers', () => {
      const testCases = [
        { value: 0n, expected: [0] },
        { value: 1n, expected: [1] },
        { value: 255n, expected: [255] },
      ]

      for (const { value, expected } of testCases) {
        const encoded = encodeFixedLength(value, 1)
        expect(encoded).toEqual(new Uint8Array(expected))

        const { value: decoded } = decodeFixedLength(encoded, 1)
        expect(decoded).toBe(value)
      }
    })

    it('should encode and decode 16-bit integers', () => {
      const testCases = [
        { value: 0n, expected: [0, 0] },
        { value: 1n, expected: [1, 0] },
        { value: 256n, expected: [0, 1] },
        { value: 65535n, expected: [255, 255] },
      ]

      for (const { value, expected } of testCases) {
        const encoded = encodeFixedLength(value, 2)
        expect(encoded).toEqual(new Uint8Array(expected))

        const { value: decoded } = decodeFixedLength(encoded, 2)
        expect(decoded).toBe(value)
      }
    })

    it('should encode and decode 32-bit integers', () => {
      const testCases = [
        { value: 0n, expected: [0, 0, 0, 0] },
        { value: 1n, expected: [1, 0, 0, 0] },
        { value: 256n, expected: [0, 1, 0, 0] },
        { value: 65536n, expected: [0, 0, 1, 0] },
        { value: 16777216n, expected: [0, 0, 0, 1] },
        { value: 4294967295n, expected: [255, 255, 255, 255] },
      ]

      for (const { value, expected } of testCases) {
        const encoded = encodeFixedLength(value, 4)
        expect(encoded).toEqual(new Uint8Array(expected))

        const { value: decoded } = decodeFixedLength(encoded, 4)
        expect(decoded).toBe(value)
      }
    })

    it('should encode and decode 64-bit integers', () => {
      const testCases = [
        { value: 0n, expected: [0, 0, 0, 0, 0, 0, 0, 0] },
        { value: 1n, expected: [1, 0, 0, 0, 0, 0, 0, 0] },
        { value: 256n, expected: [0, 1, 0, 0, 0, 0, 0, 0] },
        { value: 65536n, expected: [0, 0, 1, 0, 0, 0, 0, 0] },
        { value: 16777216n, expected: [0, 0, 0, 1, 0, 0, 0, 0] },
        { value: 4294967296n, expected: [0, 0, 0, 0, 1, 0, 0, 0] },
        { value: 1099511627776n, expected: [0, 0, 0, 0, 0, 1, 0, 0] },
        { value: 281474976710656n, expected: [0, 0, 0, 0, 0, 0, 1, 0] },
        { value: 72057594037927936n, expected: [0, 0, 0, 0, 0, 0, 0, 1] },
      ]

      for (const { value, expected } of testCases) {
        const encoded = encodeFixedLength(value, 8)
        expect(encoded).toEqual(new Uint8Array(expected))

        const { value: decoded } = decodeFixedLength(encoded, 8)
        expect(decoded).toBe(value)
      }
    })
  })

  describe('Convenience Functions', () => {
    it('should encode and decode uint8', () => {
      const value = 123n
      const encoded = encodeUint8(value)
      expect(encoded.length).toBe(1)

      const { value: decoded } = decodeUint8(encoded)
      expect(decoded).toBe(value)
    })

    it('should encode and decode uint16', () => {
      const value = 12345n
      const encoded = encodeUint16(value)
      expect(encoded.length).toBe(2)

      const { value: decoded } = decodeUint16(encoded)
      expect(decoded).toBe(value)
    })

    it('should encode and decode uint32', () => {
      const value = 123456789n
      const encoded = encodeUint32(value)
      expect(encoded.length).toBe(4)

      const { value: decoded } = decodeUint32(encoded)
      expect(decoded).toBe(value)
    })

    it('should encode and decode uint64', () => {
      const value = 1234567890123456789n
      const encoded = encodeUint64(value)
      expect(encoded.length).toBe(8)

      const { value: decoded } = decodeUint64(encoded)
      expect(decoded).toBe(value)
    })
  })

  describe('Edge Cases', () => {
    it('should reject negative numbers', () => {
      expect(() => encodeFixedLength(-1n, 1)).toThrow(
        'Natural number cannot be negative',
      )
      expect(() => encodeFixedLength(-100n, 2)).toThrow(
        'Natural number cannot be negative',
      )
    })

    it('should reject numbers exceeding maximum for length', () => {
      expect(() => encodeFixedLength(256n, 1)).toThrow(
        'exceeds maximum for 1-byte encoding',
      )
      expect(() => encodeFixedLength(65536n, 2)).toThrow(
        'exceeds maximum for 2-byte encoding',
      )
      expect(() => encodeFixedLength(4294967296n, 4)).toThrow(
        'exceeds maximum for 4-byte encoding',
      )
    })

    it('should handle insufficient data for decoding', () => {
      expect(() => decodeFixedLength(new Uint8Array([1]), 2)).toThrow(
        'Insufficient data for 2-byte decoding',
      )
      expect(() => decodeFixedLength(new Uint8Array([1, 2]), 4)).toThrow(
        'Insufficient data for 4-byte decoding',
      )
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should use little-endian encoding as specified', () => {
      // Test that bytes are ordered from least significant to most significant
      const value = 0x12345678n
      const encoded = encodeFixedLength(value, 4)

      // In little-endian: 0x12345678 = [0x78, 0x56, 0x34, 0x12]
      expect(encoded).toEqual(new Uint8Array([0x78, 0x56, 0x34, 0x12]))
    })

    it('should handle maximum values correctly', () => {
      const maxValues = [
        { length: 1, max: 255n },
        { length: 2, max: 65535n },
        { length: 4, max: 4294967295n },
        { length: 8, max: 18446744073709551615n },
      ]

      for (const { length, max } of maxValues) {
        const encoded = encodeFixedLength(max, length as 1 | 2 | 4 | 8)
        const { value: decoded } = decodeFixedLength(
          encoded,
          length as 1 | 2 | 4 | 8,
        )
        expect(decoded).toBe(max)
      }
    })
  })
})
