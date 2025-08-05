import { describe, expect, it } from 'vitest'
import type { AvailabilitySpecification } from '../../src/types'
import {
  decodeAvailabilitySpecification,
  encodeAvailabilitySpecification,
} from '../../src/work-package/availability-specification'

describe('Availability Specification Serialization', () => {
  describe('Availability Specification Encoding', () => {
    it('should encode complete availability specification', () => {
      const spec: AvailabilitySpecification = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        bundleLength: 1000n,
        erasureRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        segmentRoot:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        segmentCount: 256n,
      }

      const encoded = encodeAvailabilitySpecification(spec)

      expect(encoded.length).toBe(102) // 32 + 4 + 32 + 32 + 2 = 102 bytes
    })

    it('should handle zero values correctly', () => {
      const spec: AvailabilitySpecification = {
        packageHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        bundleLength: 0n,
        erasureRoot:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        segmentRoot:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        segmentCount: 0n,
      }

      const encoded = encodeAvailabilitySpecification(spec)

      expect(encoded.length).toBe(102)
    })

    it('should handle maximum values correctly', () => {
      const spec: AvailabilitySpecification = {
        packageHash:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        bundleLength: 0xffffffffn, // Max 32-bit integer
        erasureRoot:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        segmentRoot:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        segmentCount: 0xffffn, // Max 16-bit integer
      }

      const encoded = encodeAvailabilitySpecification(spec)

      expect(encoded.length).toBe(102)
    })
  })

  describe('Availability Specification Decoding', () => {
    it('should decode complete availability specification', () => {
      const spec: AvailabilitySpecification = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        bundleLength: 1000n,
        erasureRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        segmentRoot:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        segmentCount: 256n,
      }

      const encoded = encodeAvailabilitySpecification(spec)
      const { value: decoded } = decodeAvailabilitySpecification(encoded)

      expect(decoded).toEqual(spec)
    })

    it('should handle zero values correctly', () => {
      const spec: AvailabilitySpecification = {
        packageHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        bundleLength: 0n,
        erasureRoot:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        segmentRoot:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        segmentCount: 0n,
      }

      const encoded = encodeAvailabilitySpecification(spec)
      const { value: decoded } = decodeAvailabilitySpecification(encoded)

      expect(decoded).toEqual(spec)
    })

    it('should handle maximum values correctly', () => {
      const spec: AvailabilitySpecification = {
        packageHash:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        bundleLength: 0xffffffffn, // Max 32-bit integer
        erasureRoot:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        segmentRoot:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        segmentCount: 0xffffn, // Max 16-bit integer
      }

      const encoded = encodeAvailabilitySpecification(spec)
      const { value: decoded } = decodeAvailabilitySpecification(encoded)

      expect(decoded).toEqual(spec)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper availability specification formula', () => {
      // Test the formula: encode(asX ∈ avspec) ≡ asX_as_packagehash ∥ encode[4](asX_as_bundlelen) ∥ asX_as_erasureroot ∥ asX_as_segroot ∥ encode[2](asX_as_segcount)
      const spec: AvailabilitySpecification = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        bundleLength: 1000n,
        erasureRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        segmentRoot:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        segmentCount: 256n,
      }

      const encoded = encodeAvailabilitySpecification(spec)

      // Should be exactly 102 bytes: 32 + 4 + 32 + 32 + 2
      expect(encoded.length).toBe(102)

      // Verify the structure by decoding
      const { value: decoded } = decodeAvailabilitySpecification(encoded)
      expect(decoded).toEqual(spec)
    })

    it('should handle variable-length bundle lengths', () => {
      const testCases = [
        0n,
        1n,
        100n,
        1000n,
        10000n,
        100000n,
        0xffffffffn, // Max 32-bit integer
      ]

      for (const bundleLength of testCases) {
        const spec: AvailabilitySpecification = {
          packageHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          bundleLength,
          erasureRoot:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          segmentRoot:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          segmentCount: 256n,
        }

        const encoded = encodeAvailabilitySpecification(spec)
        const { value: decoded } = decodeAvailabilitySpecification(encoded)

        expect(decoded.bundleLength).toBe(bundleLength)
      }
    })

    it('should handle variable segment counts', () => {
      const testCases = [
        0n,
        1n,
        100n,
        256n,
        1000n,
        0xffffn, // Max 16-bit integer
      ]

      for (const segmentCount of testCases) {
        const spec: AvailabilitySpecification = {
          packageHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          bundleLength: 1000n,
          erasureRoot:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          segmentRoot:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          segmentCount,
        }

        const encoded = encodeAvailabilitySpecification(spec)
        const { value: decoded } = decodeAvailabilitySpecification(encoded)

        expect(decoded.segmentCount).toBe(segmentCount)
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve availability specifications through encode/decode cycle', () => {
      const testCases: AvailabilitySpecification[] = [
        {
          packageHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          bundleLength: 1000n,
          erasureRoot:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          segmentRoot:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          segmentCount: 256n,
        },
        {
          packageHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          bundleLength: 0n,
          erasureRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          segmentRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          segmentCount: 0n,
        },
        {
          packageHash:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          bundleLength: 0xffffffffn,
          erasureRoot:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          segmentRoot:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          segmentCount: 0xffffn,
        },
      ]

      for (const spec of testCases) {
        const encoded = encodeAvailabilitySpecification(spec)
        const { value: decoded } = decodeAvailabilitySpecification(encoded)

        expect(decoded).toEqual(spec)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array(50) // Less than 102 bytes
      expect(() => decodeAvailabilitySpecification(shortData)).toThrow(
        'Insufficient data for availability specification decoding',
      )
    })

    it('should handle negative bundle length (should be rejected)', () => {
      const spec: AvailabilitySpecification = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        bundleLength: -1n, // This should be rejected
        erasureRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        segmentRoot:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        segmentCount: 256n,
      }

      // Should throw an error for negative bundle length
      expect(() => encodeAvailabilitySpecification(spec)).toThrow(
        'Natural number cannot be negative: -1',
      )
    })

    it('should handle negative segment count (should be rejected)', () => {
      const spec: AvailabilitySpecification = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        bundleLength: 1000n,
        erasureRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        segmentRoot:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        segmentCount: -1n, // This should be rejected
      }

      // Should throw an error for negative segment count
      expect(() => encodeAvailabilitySpecification(spec)).toThrow(
        'Natural number cannot be negative: -1',
      )
    })
  })
})
