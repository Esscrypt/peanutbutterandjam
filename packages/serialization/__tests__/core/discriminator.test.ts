/**
 * Discriminator Encoding Tests
 *
 * Tests for Gray Paper-compliant discriminator encoding
 * Reference: Gray Paper Appendix D.1 - Discriminator Encoding
 */

import { describe, expect, it } from 'vitest'
import {
  decodeDiscriminatedUnion,
  decodeOptional,
  decodeVariableLength,
  encodeDiscriminatedUnion,
  encodeOptional,
  encodeVariableLength,
} from '../../src/core/discriminator'
import { encodeNatural } from '../../src/core/natural-number'

describe('Discriminator Encoding', () => {
  describe('Variable Length Encoding', () => {
    it('should encode empty data', () => {
      const data = new Uint8Array()
      const encoded = encodeVariableLength(data)

      const { value: decoded } = decodeVariableLength(encoded)
      expect(decoded).toEqual(data)
    })

    it('should encode short data', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const encoded = encodeVariableLength(data)

      const { value: decoded } = decodeVariableLength(encoded)
      expect(decoded).toEqual(data)
    })

    it('should encode long data', () => {
      const data = new Uint8Array(1000).fill(42)
      const encoded = encodeVariableLength(data)

      const { value: decoded } = decodeVariableLength(encoded)
      expect(decoded).toEqual(data)
    })

    it('should handle data with length prefix', () => {
      const data = new Uint8Array([1, 2, 3])
      const encoded = encodeVariableLength(data)

      // First byte should be the length (3)
      expect(encoded[0]).toBe(3)
      // Rest should be the data
      expect(encoded.slice(1)).toEqual(data)
    })
  })

  describe('Optional Encoding', () => {
    it('should encode null value', () => {
      const value: string | undefined = undefined
      const encoded = encodeOptional(value, (v) => new TextEncoder().encode(v))

      expect(encoded).toEqual(new Uint8Array([0]))

      const { value: decoded } = decodeOptional(encoded, (data) => ({
        value: new TextDecoder().decode(data),
        remaining: new Uint8Array(),
      }))
      expect(decoded).toBeNull()
    })

    it('should encode present value', () => {
      const value = 'hello world'
      const encoded = encodeOptional(value, (v) => new TextEncoder().encode(v))

      // Should start with discriminator 1
      expect(encoded[0]).toBe(1)
      // Rest should be the encoded value
      expect(encoded.slice(1)).toEqual(new TextEncoder().encode(value))

      const { value: decoded } = decodeOptional(encoded, (data) => ({
        value: new TextDecoder().decode(data),
        remaining: new Uint8Array(),
      }))
      expect(decoded).toBe(value)
    })

    it('should handle complex optional values', () => {
      const value = { id: 123, name: 'test' }
      const encoded = encodeOptional(
        value,
        (v) =>
          new Uint8Array(
            JSON.stringify(v)
              .split('')
              .map((c) => c.charCodeAt(0)),
          ),
      )

      const { value: decoded } = decodeOptional(encoded, (data) => ({
        value: JSON.parse(new TextDecoder().decode(data)),
        remaining: new Uint8Array(),
      }))
      expect(decoded).toEqual(value)
    })
  })

  describe('Discriminated Union Encoding', () => {
    it('should encode discriminated union', () => {
      const discriminator = 42
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const encoded = encodeDiscriminatedUnion(discriminator, data)

      expect(encoded[0]).toBe(discriminator)
      expect(encoded.slice(1)).toEqual(data)
    })

    it('should decode discriminated union', () => {
      const discriminator = 42
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const encoded = encodeDiscriminatedUnion(discriminator, data)

      const decoders = new Map([
        [
          42,
          (data: Uint8Array) => ({ value: data, remaining: new Uint8Array() }),
        ],
      ])

      const { value: decoded } = decodeDiscriminatedUnion(encoded, decoders)
      expect(decoded).toEqual(data)
    })

    it('should reject invalid discriminator', () => {
      expect(() => encodeDiscriminatedUnion(-1, new Uint8Array())).toThrow(
        'Discriminator must be 0-255',
      )
      expect(() => encodeDiscriminatedUnion(256, new Uint8Array())).toThrow(
        'Discriminator must be 0-255',
      )
    })

    it('should reject unknown discriminator', () => {
      const encoded = encodeDiscriminatedUnion(42, new Uint8Array([1, 2, 3]))
      const decoders = new Map([
        [
          1,
          (data: Uint8Array) => ({ value: data, remaining: new Uint8Array() }),
        ],
      ])

      expect(() => decodeDiscriminatedUnion(encoded, decoders)).toThrow(
        'No decoder found for discriminator: 42',
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty data for variable length decoding', () => {
      expect(() => decodeVariableLength(new Uint8Array())).toThrow(
        'Cannot decode natural number from empty data',
      )
    })

    it('should handle insufficient data for variable length decoding', () => {
      const encoded = encodeNatural(100n) // Length prefix for 100 bytes
      expect(() => decodeVariableLength(encoded)).toThrow(
        'Insufficient data for variable-length decoding',
      )
    })

    it('should handle empty data for optional decoding', () => {
      expect(() =>
        decodeOptional(new Uint8Array(), () => ({
          value: 'test',
          remaining: new Uint8Array(),
        })),
      ).toThrow('Cannot decode optional value from empty data')
    })

    it('should handle invalid optional discriminator', () => {
      const data = new Uint8Array([2]) // Invalid discriminator
      expect(() =>
        decodeOptional(data, () => ({
          value: 'test',
          remaining: new Uint8Array(),
        })),
      ).toThrow('Invalid optional discriminator: 2')
    })

    it('should handle empty data for discriminated union decoding', () => {
      const decoders = new Map()
      expect(() =>
        decodeDiscriminatedUnion(new Uint8Array(), decoders),
      ).toThrow('Cannot decode discriminated union from empty data')
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper variable length formula', () => {
      // Test: encode(var{x}) ≡ encode(len(x)) ∥ encode(x)
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const encoded = encodeVariableLength(data)

      // Should be: encode(len(data)) + data
      const expectedLength = encodeNatural(BigInt(data.length))
      const expected = new Uint8Array([...expectedLength, ...data])

      expect(encoded).toEqual(expected)
    })

    it('should follow Gray Paper optional formula', () => {
      // Test: encode(maybe{x}) ≡ 0 when x = none, ⟨1, x⟩ otherwise

      // Null case
      const nullValue: string | undefined = undefined
      const nullEncoded = encodeOptional(nullValue, (v) =>
        new TextEncoder().encode(v),
      )
      expect(nullEncoded).toEqual(new Uint8Array([0]))

      // Present case
      const presentValue = 'test'
      const presentEncoded = encodeOptional(presentValue, (v) =>
        new TextEncoder().encode(v),
      )
      expect(presentEncoded[0]).toBe(1)
      expect(presentEncoded.slice(1)).toEqual(
        new TextEncoder().encode(presentValue),
      )
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve variable length data through encode/decode cycle', () => {
      const testData = [
        new Uint8Array(),
        new Uint8Array([1]),
        new Uint8Array([1, 2, 3, 4, 5]),
        new Uint8Array(100).fill(42),
        new Uint8Array(1000).fill(123),
      ]

      for (const data of testData) {
        const encoded = encodeVariableLength(data)
        const { value: decoded } = decodeVariableLength(encoded)
        expect(decoded).toEqual(data)
      }
    })

    it('should preserve optional values through encode/decode cycle', () => {
      const testValues = [null, 'hello', 'world', 'test string with spaces', '']

      for (const value of testValues) {
        const encoded = encodeOptional(value, (v) =>
          new TextEncoder().encode(v || ''),
        )
        const { value: decoded } = decodeOptional(encoded, (data) => ({
          value: new TextDecoder().decode(data),
          remaining: new Uint8Array(),
        }))
        expect(decoded).toBe(value)
      }
    })
  })
})
