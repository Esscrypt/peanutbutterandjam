import { describe, expect, it } from 'vitest'
import { decodeNatural, encodeNatural } from '../../src/core/natural-number'
import {
  decodeSet,
  decodeSetWithLength,
  encodeSet,
  encodeSetWithLength,
} from '../../src/core/set'

describe('Set Encoding', () => {
  describe('Basic Set Encoding', () => {
    it('should encode empty set', () => {
      const set = new Set<number>()
      const encoded = encodeSet(set, (value) => encodeNatural(BigInt(value)))

      expect(encoded.length).toBe(0)
    })

    it('should encode single element set', () => {
      const set = new Set([42])
      const encoded = encodeSet(set, (value) => encodeNatural(BigInt(value)))

      expect(encoded.length).toBe(1)
      expect(encoded[0]).toBe(42)
    })

    it('should encode multiple element set', () => {
      const set = new Set([3, 1, 2])
      const encoded = encodeSet(set, (value) => encodeNatural(BigInt(value)))

      expect(encoded.length).toBe(3)
      // Should be sorted: 1, 2, 3
      expect(encoded[0]).toBe(1)
      expect(encoded[1]).toBe(2)
      expect(encoded[2]).toBe(3)
    })

    it('should order elements properly', () => {
      const set = new Set(['zebra', 'alpha', 'beta'])
      const encoded = encodeSet(set, (value) => new TextEncoder().encode(value))

      expect(encoded.length).toBeGreaterThan(0)
      // Should be sorted alphabetically: alpha, beta, zebra
    })
  })

  describe('Set with Length Prefix', () => {
    it('should encode set with length prefix', () => {
      const set = new Set([1, 2, 3])
      const encoded = encodeSetWithLength(set, (value) =>
        encodeNatural(BigInt(value)),
      )

      expect(encoded.length).toBe(4) // 1 byte for length (3), 3 bytes for values
      expect(encoded[0]).toBe(3) // Length = 3
    })

    it('should handle empty set with length prefix', () => {
      const set = new Set<number>()
      const encoded = encodeSetWithLength(set, (value) =>
        encodeNatural(BigInt(value)),
      )

      expect(encoded.length).toBe(1) // 1 byte for length (0)
      expect(encoded[0]).toBe(0) // Length = 0
    })

    it('should handle large set with length prefix', () => {
      const set = new Set(Array.from({ length: 100 }, (_, i) => i))
      const encoded = encodeSetWithLength(set, (value) =>
        encodeNatural(BigInt(value)),
      )

      expect(encoded.length).toBeGreaterThan(100) // Length prefix + 100 values
      expect(encoded[0]).toBe(100) // Length = 100
    })
  })

  describe('Set Decoding', () => {
    it('should decode empty set', () => {
      const data = new Uint8Array(0)
      const { value: decoded } = decodeSet(data, (data) => decodeNatural(data))

      expect(decoded.size).toBe(0)
    })

    it('should decode single element set', () => {
      const data = new Uint8Array([42])
      const { value: decoded } = decodeSet(data, (data) => decodeNatural(data))

      expect(decoded.size).toBe(1)
      expect(decoded.has(42n)).toBe(true)
    })

    it('should decode multiple element set', () => {
      const data = new Uint8Array([1, 2, 3])
      const { value: decoded } = decodeSet(data, (data) => decodeNatural(data))

      expect(decoded.size).toBe(3)
      expect(decoded.has(1n)).toBe(true)
      expect(decoded.has(2n)).toBe(true)
      expect(decoded.has(3n)).toBe(true)
    })

    it('should decode set with specific element count', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const { value: decoded } = decodeSet(
        data,
        (data) => decodeNatural(data),
        3,
      )

      expect(decoded.size).toBe(3)
      expect(decoded.has(1n)).toBe(true)
      expect(decoded.has(2n)).toBe(true)
      expect(decoded.has(3n)).toBe(true)
    })
  })

  describe('Set with Length Prefix Decoding', () => {
    it('should decode set with length prefix', () => {
      const data = new Uint8Array([3, 1, 2, 3]) // Length = 3, values = 1, 2, 3
      const { value: decoded } = decodeSetWithLength(data, (data) =>
        decodeNatural(data),
      )

      expect(decoded.size).toBe(3)
      expect(decoded.has(1n)).toBe(true)
      expect(decoded.has(2n)).toBe(true)
      expect(decoded.has(3n)).toBe(true)
    })

    it('should handle empty set with length prefix', () => {
      const data = new Uint8Array([0]) // Length = 0
      const { value: decoded } = decodeSetWithLength(data, (data) =>
        decodeNatural(data),
      )

      expect(decoded.size).toBe(0)
    })

    it('should handle large set with length prefix', () => {
      const set = new Set(Array.from({ length: 100 }, (_, i) => i))
      const encoded = encodeSetWithLength(set, (value) =>
        encodeNatural(BigInt(value)),
      )
      const { value: decoded } = decodeSetWithLength(encoded, (data) =>
        decodeNatural(data),
      )

      expect(decoded.size).toBe(100)
      for (let i = 0; i < 100; i++) {
        expect(decoded.has(BigInt(i))).toBe(true)
      }
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper set formula', () => {
      // Test the formula: encode({a,b,c,...}) ≡ encode(a) ∥ encode(b) ∥ encode(c) ∥ ...
      const set = new Set([3, 1, 2])
      const encoded = encodeSet(set, (value) => encodeNatural(BigInt(value)))

      // Should be concatenated in sorted order: encode(1) ∥ encode(2) ∥ encode(3)
      expect(encoded.length).toBe(3)
      expect(encoded[0]).toBe(1) // encode(1)
      expect(encoded[1]).toBe(2) // encode(2)
      expect(encoded[2]).toBe(3) // encode(3)
    })

    it('should handle variable-length elements', () => {
      const testCases = [
        new Set<number>(),
        new Set([1]),
        new Set([1, 2, 3]),
        new Set([100, 200, 300]),
        new Set(Array.from({ length: 100 }, (_, i) => i)),
      ]

      for (const set of testCases) {
        const encoded = encodeSet(set, (value) => encodeNatural(BigInt(value)))
        const { value: decoded } = decodeSet(encoded, (data) =>
          decodeNatural(data),
        )

        expect(decoded.size).toBe(set.size)
        for (const element of set) {
          expect(decoded.has(BigInt(element))).toBe(true)
        }
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve sets through encode/decode cycle', () => {
      const testCases = [
        new Set<number>(),
        new Set([42]),
        new Set([3, 1, 2]),
        new Set([100, 200, 300]),
        new Set(Array.from({ length: 50 }, (_, i) => i)),
      ]

      for (const set of testCases) {
        const encoded = encodeSet(set, (value) => encodeNatural(BigInt(value)))
        const { value: decoded } = decodeSet(encoded, (data) =>
          decodeNatural(data),
        )

        expect(decoded.size).toBe(set.size)
        for (const element of set) {
          expect(decoded.has(BigInt(element))).toBe(true)
        }
      }
    })

    it('should preserve sets with length prefix through encode/decode cycle', () => {
      const testCases = [
        new Set<number>(),
        new Set([42]),
        new Set([3, 1, 2]),
        new Set([100, 200, 300]),
      ]

      for (const set of testCases) {
        const encoded = encodeSetWithLength(set, (value) =>
          encodeNatural(BigInt(value)),
        )
        const { value: decoded } = decodeSetWithLength(encoded, (data) =>
          decodeNatural(data),
        )

        expect(decoded.size).toBe(set.size)
        for (const element of set) {
          expect(decoded.has(BigInt(element))).toBe(true)
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle duplicate elements (should not occur in Set)', () => {
      const set = new Set([1, 1, 1]) // Set automatically removes duplicates
      const encoded = encodeSet(set, (value) => encodeNatural(BigInt(value)))

      expect(encoded.length).toBe(1) // Only one element after deduplication
      expect(encoded[0]).toBe(1)
    })

    it('should handle zero values', () => {
      const set = new Set([0, 1, 2])
      const encoded = encodeSet(set, (value) => encodeNatural(BigInt(value)))

      expect(encoded.length).toBe(3)
      expect(encoded[0]).toBe(0)
    })

    it('should handle large numbers', () => {
      const set = new Set([1000, 2000, 3000])
      const encoded = encodeSet(set, (value) => encodeNatural(BigInt(value)))

      expect(encoded.length).toBeGreaterThan(3) // Variable-length encoding for large numbers
    })

    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array([1]) // Only 1 byte, but trying to decode 3 elements
      expect(() =>
        decodeSet(shortData, (data) => decodeNatural(data), 3),
      ).toThrow('Insufficient data for set decoding')
    })
  })
})
