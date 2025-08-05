import { describe, expect, it } from 'vitest'
import {
  decodeBitSequence,
  decodeBitSequenceWithLength,
  encodeBitSequence,
  encodeBitSequenceWithLength,
} from '../../src/core/bit-sequence'

describe('Bit Sequence Encoding', () => {
  describe('Basic Bit Sequence Encoding', () => {
    it('should encode empty bit sequence', () => {
      const bits: boolean[] = []
      const encoded = encodeBitSequence(bits)

      expect(encoded.length).toBe(0)
    })

    it('should encode single bit', () => {
      const bits = [true]
      const encoded = encodeBitSequence(bits)

      expect(encoded.length).toBe(1)
      expect(encoded[0]).toBe(1) // 00000001 in binary
    })

    it('should encode 8 bits into single octet', () => {
      const bits = [true, false, true, false, true, false, true, false]
      const encoded = encodeBitSequence(bits)

      expect(encoded.length).toBe(1)
      expect(encoded[0]).toBe(85) // 01010101 in binary = 85
    })

    it('should encode 9 bits into two octets', () => {
      const bits = [true, false, true, false, true, false, true, false, true]
      const encoded = encodeBitSequence(bits)

      expect(encoded.length).toBe(2)
      expect(encoded[0]).toBe(85) // First 8 bits: 01010101
      expect(encoded[1]).toBe(1) // Last bit: 00000001
    })

    it('should encode 16 bits into two octets', () => {
      const bits = [
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
      ]
      const encoded = encodeBitSequence(bits)

      expect(encoded.length).toBe(2)
      expect(encoded[0]).toBe(85) // First 8 bits: 01010101
      expect(encoded[1]).toBe(170) // Second 8 bits: 10101010
    })
  })

  describe('Bit Sequence with Length Prefix', () => {
    it('should encode bit sequence with length prefix', () => {
      const bits = [true, false, true, false, true, false, true, false]
      const encoded = encodeBitSequenceWithLength(bits)

      expect(encoded.length).toBe(2) // 1 byte for length (8), 1 byte for bits
      expect(encoded[0]).toBe(8) // Length = 8
      expect(encoded[1]).toBe(85) // Bits: 01010101
    })

    it('should handle empty bit sequence with length prefix', () => {
      const bits: boolean[] = []
      const encoded = encodeBitSequenceWithLength(bits)

      expect(encoded.length).toBe(1) // 1 byte for length (0)
      expect(encoded[0]).toBe(0) // Length = 0
    })

    it('should handle large bit sequence with length prefix', () => {
      const bits = Array(100).fill(true)
      const encoded = encodeBitSequenceWithLength(bits)

      expect(encoded.length).toBe(14) // 1 byte for length (100), 13 bytes for bits
      expect(encoded[0]).toBe(100) // Length = 100
    })
  })

  describe('Bit Sequence Decoding', () => {
    it('should decode empty bit sequence', () => {
      const data = new Uint8Array(0)
      const { value: decoded } = decodeBitSequence(data)

      expect(decoded).toEqual([])
    })

    it('should decode single bit', () => {
      const data = new Uint8Array([1])
      const { value: decoded } = decodeBitSequence(data)

      expect(decoded).toEqual([
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ])
    })

    it('should decode 8 bits from single octet', () => {
      const data = new Uint8Array([85]) // 01010101
      const { value: decoded } = decodeBitSequence(data)

      expect(decoded).toEqual([
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
      ])
    })

    it('should decode 9 bits from two octets', () => {
      const data = new Uint8Array([85, 1]) // 01010101 + 00000001
      const { value: decoded } = decodeBitSequence(data, 9)

      expect(decoded).toEqual([
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
      ])
    })

    it('should decode 16 bits from two octets', () => {
      const data = new Uint8Array([85, 170]) // 01010101 + 10101010
      const { value: decoded } = decodeBitSequence(data, 16)

      expect(decoded).toEqual([
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
      ])
    })
  })

  describe('Bit Sequence with Length Prefix Decoding', () => {
    it('should decode bit sequence with length prefix', () => {
      const data = new Uint8Array([8, 85]) // Length = 8, bits = 01010101
      const { value: decoded } = decodeBitSequenceWithLength(data)

      expect(decoded).toEqual([
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
      ])
    })

    it('should handle empty bit sequence with length prefix', () => {
      const data = new Uint8Array([0]) // Length = 0
      const { value: decoded } = decodeBitSequenceWithLength(data)

      expect(decoded).toEqual([])
    })

    it('should handle large bit sequence with length prefix', () => {
      const bits = Array(100).fill(true)
      const encoded = encodeBitSequenceWithLength(bits)
      const { value: decoded } = decodeBitSequenceWithLength(encoded)

      expect(decoded).toEqual(bits)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper bitstring formula', () => {
      // Test the formula: encode(b ∈ bitstring) ≡ ⟨∑(bᵢ·2ⁱ)⟩ ∥ encode(b[8:])
      const bits = [true, false, true, false, true, false, true, false, true]
      const encoded = encodeBitSequence(bits)

      // First 8 bits should be packed into first octet: ∑(bᵢ·2ⁱ) = 1·2⁰ + 0·2¹ + 1·2² + 0·2³ + 1·2⁴ + 0·2⁵ + 1·2⁶ + 0·2⁷ = 1 + 4 + 16 + 64 = 85
      expect(encoded[0]).toBe(85)

      // Remaining bit should be in second octet
      expect(encoded[1]).toBe(1)
    })

    it('should handle variable-length bit sequences', () => {
      const testCases = [
        [],
        [true],
        [true, false],
        [true, false, true, false, true, false, true, false],
        Array(100).fill(true),
        Array(1000).fill(false),
      ]

      for (const bits of testCases) {
        const encoded = encodeBitSequence(bits)
        const { value: decoded } = decodeBitSequence(encoded, bits.length)
        expect(decoded).toEqual(bits)
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve bit sequences through encode/decode cycle', () => {
      const testCases = [
        [],
        [true],
        [false],
        [true, false, true, false],
        [true, false, true, false, true, false, true, false],
        [true, false, true, false, true, false, true, false, true],
        Array(64).fill(true),
        Array(64).fill(false),
        Array.from({ length: 64 }, (_, i) => i % 2 === 0),
      ]

      for (const bits of testCases) {
        const encoded = encodeBitSequence(bits)
        const { value: decoded } = decodeBitSequence(encoded, bits.length)
        expect(decoded).toEqual(bits)
      }
    })

    it('should preserve bit sequences with length prefix through encode/decode cycle', () => {
      const testCases = [
        [],
        [true],
        [true, false, true, false],
        Array(100).fill(true),
        Array.from({ length: 1000 }, (_, i) => i % 2 === 0),
      ]

      for (const bits of testCases) {
        const encoded = encodeBitSequenceWithLength(bits)
        const { value: decoded } = decodeBitSequenceWithLength(encoded)
        expect(decoded).toEqual(bits)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle all zeros', () => {
      const bits = Array(8).fill(false)
      const encoded = encodeBitSequence(bits)
      expect(encoded[0]).toBe(0)
    })

    it('should handle all ones', () => {
      const bits = Array(8).fill(true)
      const encoded = encodeBitSequence(bits)
      expect(encoded[0]).toBe(255)
    })

    it('should handle alternating bits', () => {
      const bits = Array.from({ length: 8 }, (_, i) => i % 2 === 0)
      const encoded = encodeBitSequence(bits)
      expect(encoded[0]).toBe(85) // 01010101
    })

    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array([1]) // Only 1 byte, but trying to decode 16 bits
      const { value: decoded } = decodeBitSequence(shortData, 16)
      expect(decoded.length).toBe(8) // Should only decode what's available
    })
  })
})
