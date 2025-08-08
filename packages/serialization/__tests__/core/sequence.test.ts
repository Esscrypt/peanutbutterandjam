/**
 * Sequence Serialization Tests
 *
 * Tests for Gray Paper-compliant sequence encoding
 * Reference: Gray Paper Appendix D.1 - Sequence Encoding
 */

import { describe, expect, it } from 'vitest'
import { encodeNatural } from '../../src/core/natural-number'
import {
  decodeUint8Array,
  decodeSequence,
  decodeSequenceWithLength,
  encodeUint8Array,
  encodeSequence,
  encodeSequenceWithLength,
} from '../../src/core/sequence'
import type { Natural } from '../../src/types'

describe('Sequence Encoding', () => {
  describe('Basic Sequence Encoding', () => {
    it('should encode empty sequence', () => {
      const sequence: Natural[] = []
      const encoded = encodeSequence(sequence)
      expect(encoded.length).toBe(0)

      const { value: decoded } = decodeSequence(encoded)
      expect(decoded).toEqual([])
    })

    it('should encode single element sequence', () => {
      const sequence = [123n]
      const encoded = encodeSequence(sequence)

      const { value: decoded } = decodeSequence(encoded)
      expect(decoded).toEqual(sequence)
    })

    it('should encode multiple element sequence', () => {
      const sequence = [1n, 2n, 3n, 4n, 5n]
      const encoded = encodeSequence(sequence)

      const { value: decoded } = decodeSequence(encoded)
      expect(decoded).toEqual(sequence)
    })

    it('should encode sequence with large numbers', () => {
      const sequence = [0n, 127n, 128n, 16383n, 16384n, 2097151n]
      const encoded = encodeSequence(sequence)

      const { value: decoded } = decodeSequence(encoded)
      expect(decoded).toEqual(sequence)
    })
  })

  describe('Sequence with Length Prefix', () => {
    it('should encode sequence with length prefix', () => {
      const sequence = [1n, 2n, 3n]
      const encoded = encodeSequenceWithLength(sequence)

      const { value: decoded } = decodeSequenceWithLength(encoded)
      expect(decoded).toEqual(sequence)
    })

    it('should handle empty sequence with length prefix', () => {
      const sequence: Natural[] = []
      const encoded = encodeSequenceWithLength(sequence)

      const { value: decoded } = decodeSequenceWithLength(encoded)
      expect(decoded).toEqual(sequence)
    })

    it('should handle large sequence with length prefix', () => {
      const sequence = Array.from({ length: 100 }, (_, i) => BigInt(i))
      const encoded = encodeSequenceWithLength(sequence)

      const { value: decoded } = decodeSequenceWithLength(encoded)
      expect(decoded).toEqual(sequence)
    })
  })

  describe('Octet Sequence Encoding', () => {
    it('should encode octet sequences', () => {
      const sequences = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
      ]
      const encoded = encodeUint8Array(sequences)

      const { value: decoded } = decodeUint8Array(encoded, 3, 3)
      expect(decoded).toEqual(sequences)
    })

    it('should handle empty octet sequences', () => {
      const sequences: Uint8Array[] = []
      const encoded = encodeUint8Array(sequences)
      expect(encoded.length).toBe(0)

      const { value: decoded } = decodeUint8Array(encoded, 0, 0)
      expect(decoded).toEqual(sequences)
    })

    it('should handle variable length octet sequences', () => {
      const sequences = [
        new Uint8Array([1]),
        new Uint8Array([2, 3]),
        new Uint8Array([4, 5, 6]),
      ]
      const encoded = encodeUint8Array(sequences)

      // For variable length, we need to decode manually
      let offset = 0
      const decoded: Uint8Array[] = []
      for (const seq of sequences) {
        decoded.push(encoded.slice(offset, offset + seq.length))
        offset += seq.length
      }
      expect(decoded).toEqual(sequences)
    })
  })

  describe('Edge Cases', () => {
    it('should handle sequence with zero values', () => {
      const sequence = [0n, 0n, 0n]
      const encoded = encodeSequence(sequence)

      const { value: decoded } = decodeSequence(encoded)
      expect(decoded).toEqual(sequence)
    })

    it('should handle sequence with maximum values', () => {
      const sequence = [2n ** 64n - 1n, 2n ** 63n, 2n ** 32n - 1n]
      const encoded = encodeSequence(sequence)

      const { value: decoded } = decodeSequence(encoded)
      expect(decoded).toEqual(sequence)
    })

    it('should handle insufficient data for decoding', () => {
      // Create data that claims to have length 2 but only has 1 element
      const lengthPrefix = encodeNatural(2n) // Length = 2
      const singleElement = encodeNatural(1n) // Only 1 element
      const data = new Uint8Array([...lengthPrefix, ...singleElement])
      expect(() => decodeSequenceWithLength(data)).toThrow()
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper sequence formula', () => {
      // Test the formula: encode([i₀, i₁, ...]) ≡ encode(i₀) ∥ encode(i₁) ∥ ...
      const sequence = [1n, 2n, 3n]
      const encoded = encodeSequence(sequence)

      // Each element should be encoded individually and concatenated
      const expected = new Uint8Array([
        ...encodeSequence([1n]),
        ...encodeSequence([2n]),
        ...encodeSequence([3n]),
      ])

      expect(encoded).toEqual(expected)
    })

    it('should handle identity serialization for fixed-length octet sequences', () => {
      // Fixed-length octet sequences (like hashes) should have identity serialization
      const hash1 = new Uint8Array(32).fill(1)
      const hash2 = new Uint8Array(32).fill(2)
      const sequences = [hash1, hash2]

      const encoded = encodeUint8Array(sequences)
      expect(encoded.length).toBe(hash1.length + hash2.length)

      // Should be direct concatenation
      const expected = new Uint8Array([...hash1, ...hash2])
      expect(encoded).toEqual(expected)
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve all values through encode/decode cycle', () => {
      const testSequences = [
        [],
        [1n],
        [1n, 2n, 3n],
        [0n, 127n, 128n, 16383n, 16384n],
        Array.from({ length: 50 }, (_, i) => BigInt(i)),
        [2n ** 64n - 1n, 2n ** 63n, 2n ** 32n - 1n],
      ]

      for (const sequence of testSequences) {
        const encoded = encodeSequence(sequence)
        const { value: decoded } = decodeSequence(encoded)
        expect(decoded).toEqual(sequence)
      }
    })

    it('should preserve values with length prefix through encode/decode cycle', () => {
      const testSequences = [
        [],
        [1n],
        [1n, 2n, 3n],
        Array.from({ length: 100 }, (_, i) => BigInt(i)),
      ]

      for (const sequence of testSequences) {
        const encoded = encodeSequenceWithLength(sequence)
        const { value: decoded } = decodeSequenceWithLength(encoded)
        expect(decoded).toEqual(sequence)
      }
    })
  })
})
