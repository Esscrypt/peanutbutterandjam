import { describe, expect, it } from 'vitest'
import {
  decodeImportReference,
  encodeImportReference,
} from '../../src/pvm/import-reference'
import type { ImportReference } from '../../src/types'

describe('Import Reference Serialization', () => {
  describe('Import Reference Encoding', () => {
    it('should encode import reference with simple values', () => {
      const importRef: ImportReference = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        index: 1234n,
      }

      const encoded = encodeImportReference(importRef)

      expect(encoded.length).toBe(34) // 32 bytes for hash + 2 bytes for index
    })

    it('should encode import reference with large index', () => {
      const importRef: ImportReference = {
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        index: 0x7fffn, // Max 15-bit value (2^15 - 1)
      }

      const encoded = encodeImportReference(importRef)

      expect(encoded.length).toBe(34) // 32 bytes for hash + 2 bytes for index
    })

    it('should encode import reference with zero index', () => {
      const importRef: ImportReference = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        index: 0n,
      }

      const encoded = encodeImportReference(importRef)

      expect(encoded.length).toBe(34) // 32 bytes for hash + 2 bytes for index
    })

    it('should handle different hash values', () => {
      const testHashes = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ]

      for (const hash of testHashes) {
        const importRef: ImportReference = {
          hash,
          index: 1234n,
        }

        const encoded = encodeImportReference(importRef)

        expect(encoded.length).toBe(34) // 32 bytes for hash + 2 bytes for index
      }
    })
  })

  describe('Import Reference Decoding', () => {
    it('should decode import reference with simple values', () => {
      const importRef: ImportReference = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        index: 1234n,
      }

      const encoded = encodeImportReference(importRef)
      const { value: decoded } = decodeImportReference(encoded)

      expect(decoded).toEqual(importRef)
    })

    it('should decode import reference with large index', () => {
      const importRef: ImportReference = {
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        index: 0x7fffn, // Max 15-bit value (2^15 - 1)
      }

      const encoded = encodeImportReference(importRef)
      const { value: decoded } = decodeImportReference(encoded)

      expect(decoded).toEqual(importRef)
    })

    it('should decode import reference with zero index', () => {
      const importRef: ImportReference = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        index: 0n,
      }

      const encoded = encodeImportReference(importRef)
      const { value: decoded } = decodeImportReference(encoded)

      expect(decoded).toEqual(importRef)
    })

    it('should handle different hash values', () => {
      const testHashes = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ]

      for (const hash of testHashes) {
        const importRef: ImportReference = {
          hash,
          index: 1234n,
        }

        const encoded = encodeImportReference(importRef)
        const { value: decoded } = decodeImportReference(encoded)

        expect(decoded).toEqual(importRef)
      }
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper import reference formula', () => {
      // Test the formula: encodeimportref(⟨h ∈ hash ∪ hash^⊞, i ∈ Nbits{15}⟩)
      const importRef: ImportReference = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        index: 1234n,
      }

      const encoded = encodeImportReference(importRef)

      // Verify the structure by decoding
      const { value: decoded } = decodeImportReference(encoded)
      expect(decoded).toEqual(importRef)
    })

    it('should handle maximum 15-bit index values', () => {
      // Test with maximum 15-bit value (2^15 - 1 = 32767)
      const importRef: ImportReference = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        index: 0x7fffn, // 32767
      }

      const encoded = encodeImportReference(importRef)
      const { value: decoded } = decodeImportReference(encoded)

      expect(decoded).toEqual(importRef)
    })

    it('should handle edge case index values', () => {
      const testCases = [
        0n, // Minimum value
        1n, // Small positive value
        0x7fffn, // Maximum 15-bit value
        0x1000n, // Mid-range value
        0x5555n, // Another mid-range value
      ]

      for (const index of testCases) {
        const importRef: ImportReference = {
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          index,
        }

        const encoded = encodeImportReference(importRef)
        const { value: decoded } = decodeImportReference(encoded)

        expect(decoded).toEqual(importRef)
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve import references through encode/decode cycle', () => {
      const testCases: ImportReference[] = [
        {
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          index: 1234n,
        },
        {
          hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          index: 0x7fffn,
        },
        {
          hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          index: 0n,
        },
        {
          hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          index: 0x5555n,
        },
        {
          hash: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          index: 0x1000n,
        },
      ]

      for (const importRef of testCases) {
        const encoded = encodeImportReference(importRef)
        const { value: decoded } = decodeImportReference(encoded)

        expect(decoded).toEqual(importRef)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array(20) // Too short for complete import reference
      expect(() => decodeImportReference(shortData)).toThrow(
        'Insufficient data',
      )
    })

    it('should handle negative index (should be rejected)', () => {
      const importRef: ImportReference = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        index: -1n as bigint, // Force negative value
      }

      expect(() => encodeImportReference(importRef)).toThrow(
        'Natural number cannot be negative',
      )
    })

    it('should handle index larger than 15 bits (should be rejected)', () => {
      const importRef: ImportReference = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        index: 0x10000n, // 2^16, larger than 15 bits
      }

      // The encodeFixedLength function should reject values that exceed 2-byte maximum
      expect(() => encodeImportReference(importRef)).toThrow(
        'Value 65536 exceeds maximum for 2-byte encoding: 65535',
      )
    })

    it('should handle empty hash string', () => {
      const importRef: ImportReference = {
        hash: '',
        index: 1234n,
      }

      const encoded = encodeImportReference(importRef)
      const { value: decoded } = decodeImportReference(encoded)

      // Empty hash should be treated as all zeros
      expect(decoded.hash).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      )
    })

    it('should handle hash without 0x prefix', () => {
      const importRef: ImportReference = {
        hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        index: 1234n,
      }

      const encoded = encodeImportReference(importRef)
      const { value: decoded } = decodeImportReference(encoded)

      expect(decoded.hash).toBe(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      )
    })
  })

  describe('Boxed Hash Support', () => {
    it('should handle regular hash encoding', () => {
      // Regular hash: ⟨h, encode[2]{i}⟩
      const importRef: ImportReference = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        index: 1234n,
      }

      const encoded = encodeImportReference(importRef)
      const { value: decoded } = decodeImportReference(encoded)

      expect(decoded).toEqual(importRef)
    })

    it('should handle boxed hash encoding (conceptual)', () => {
      // Boxed hash: ⟨r, encode[2]{i + 2^{15}}⟩
      // For now, we encode the index directly, but the transformation would be:
      // index + 2^15 for boxed hashes
      const importRef: ImportReference = {
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        index: 1234n,
      }

      const encoded = encodeImportReference(importRef)
      const { value: decoded } = decodeImportReference(encoded)

      expect(decoded).toEqual(importRef)
    })
  })
})
