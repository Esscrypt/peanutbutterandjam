/**
 * Natural Number Serialization Tests
 *
 * Tests for Gray Paper-compliant natural number encoding
 * Reference: Gray Paper Appendix D.1 - Natural Number Encoding
 */

import { describe, expect, it } from 'vitest'
import {
  decodeNatural,
  encodeNatural,
  getNaturalEncodedLength,
} from '../../src/core/natural-number'
import type { Natural } from '../../src/types'

describe('Natural Number Encoding', () => {
  describe('Zero Encoding', () => {
    it('should encode zero as single byte', () => {
      const encoded = encodeNatural(0n)
      expect(encoded).toEqual(new Uint8Array([0]))
      expect(encoded.length).toBe(1)
    })

    it('should decode zero correctly', () => {
      const data = new Uint8Array([0])
      const { value, remaining } = decodeNatural(data)
      expect(value).toBe(0n)
      expect(remaining.length).toBe(0)
    })
  })

  describe('Gray Paper Encoding Examples', () => {
    it('should encode and decode key values per Gray Paper', () => {
      // Format: value, expected Gray Paper encoding
      // Calculated according to Gray Paper formula:
      // encode(x) ≡ ⟨2^8-2^(8-l) + ⌊x/2^(8l)⌋⟩ ∥ encode[l](x mod 2^(8l))
      const testCases = [
        { value: 1n, expected: [1] },
        { value: 127n, expected: [127] },
        { value: 128n, expected: [128, 128] }, // 2^8-2^7 + 0 = 128, 128 mod 256 = 128
        { value: 16383n, expected: [191, 255] }, // 2^8-2^7 + 63 = 191, 16383 mod 256 = 255
        { value: 16384n, expected: [192, 0, 64] }, // 2^8-2^6 + 0 = 192, 16384 mod 2^16 = 16384 = [0, 64] LE
        { value: 2097151n, expected: [223, 255, 255] }, // 2^8-2^6 + 31 = 223, 2097151 mod 2^16 = 65535 = [255, 255] LE
        { value: 2097152n, expected: [224, 0, 0, 32] }, // 2^8-2^5 + 0 = 224, 2097152 mod 2^24 = 2097152 = [0, 0, 32] LE
        {
          value: 2n ** 64n - 1n,
          expected: [255, 255, 255, 255, 255, 255, 255, 255, 255],
        },
      ]
      for (const { value, expected } of testCases) {
        const encoded = encodeNatural(value)
        expect(Array.from(encoded)).toEqual(expected)
        const { value: decoded, remaining } = decodeNatural(encoded)
        expect(decoded).toBe(value)
        expect(remaining.length).toBe(0)
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve values through encode/decode cycle', () => {
      const testValues: Natural[] = [
        0n,
        1n,
        127n,
        128n,
        16383n,
        16384n,
        2097151n,
        2097152n,
        268435455n,
        268435456n,
        34359738367n,
        34359738368n,
        4398046511103n,
        4398046511104n,
        562949953421311n,
        562949953421312n,
        2n ** 56n,
        2n ** 63n,
        2n ** 64n - 1n,
      ]
      for (const value of testValues) {
        const encoded = encodeNatural(value)
        const { value: decoded } = decodeNatural(encoded)
        expect(decoded).toBe(value)
      }
    })
  })

  describe('Length Prediction', () => {
    it('should correctly predict encoded length', () => {
      const testCases = [
        { value: 0n, expectedLength: 1 },
        { value: 1n, expectedLength: 1 },
        { value: 127n, expectedLength: 1 },
        { value: 128n, expectedLength: 2 },
        { value: 16383n, expectedLength: 2 },
        { value: 16384n, expectedLength: 3 },
        { value: 2097151n, expectedLength: 3 },
        { value: 2097152n, expectedLength: 4 },
        { value: 268435455n, expectedLength: 4 },
        { value: 268435456n, expectedLength: 5 },
        { value: 34359738367n, expectedLength: 5 },
        { value: 34359738368n, expectedLength: 6 },
        { value: 4398046511103n, expectedLength: 6 },
        { value: 4398046511104n, expectedLength: 7 },
        { value: 562949953421311n, expectedLength: 7 },
        { value: 562949953421312n, expectedLength: 8 },
        { value: 2n ** 56n, expectedLength: 9 },
        { value: 2n ** 63n, expectedLength: 9 },
        { value: 2n ** 64n - 1n, expectedLength: 9 },
      ]
      for (const { value, expectedLength } of testCases) {
        const predictedLength = getNaturalEncodedLength(value)
        expect(predictedLength).toBe(expectedLength)
        const actualLength = encodeNatural(value).length
        expect(actualLength).toBe(expectedLength)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should reject negative numbers', () => {
      expect(() => encodeNatural(-1n)).toThrow(
        'Natural number cannot be negative',
      )
      expect(() => encodeNatural(-100n)).toThrow(
        'Natural number cannot be negative',
      )
    })

    it('should reject numbers exceeding maximum', () => {
      const tooLarge = 2n ** 64n
      expect(() => encodeNatural(tooLarge)).toThrow(
        'Natural number exceeds maximum value',
      )
    })

    it('should handle empty data for decoding', () => {
      expect(() => decodeNatural(new Uint8Array())).toThrow(
        'Cannot decode natural number from empty data',
      )
    })
  })
})
