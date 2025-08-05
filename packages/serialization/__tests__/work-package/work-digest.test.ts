import { describe, expect, it } from 'vitest'
import type { WorkDigest } from '../../src/types'
import { WorkError } from '../../src/types'
import {
  decodeWorkDigest,
  encodeWorkDigest,
} from '../../src/work-package/work-digest'

describe('Work Digest Serialization', () => {
  describe('Work Digest Encoding', () => {
    it('should encode complete work digest with success result', () => {
      const digest: WorkDigest = {
        serviceIndex: 1n,
        codeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        payloadHash:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        gasLimit: 1000000n,
        result: new Uint8Array([1, 2, 3, 4, 5]), // Success result as octet sequence
        gasUsed: 500000n,
        importCount: 10n,
        extrinsicCount: 5n,
        extrinsicSize: 1024n,
        exportCount: 3n,
      }

      const encoded = encodeWorkDigest(digest)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should encode work digest with error result', () => {
      const digest: WorkDigest = {
        serviceIndex: 2n,
        codeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        payloadHash:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        gasLimit: 1000000n,
        result: WorkError.PANIC, // Error result
        gasUsed: 0n,
        importCount: 0n,
        extrinsicCount: 0n,
        extrinsicSize: 0n,
        exportCount: 0n,
      }

      const encoded = encodeWorkDigest(digest)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle zero values correctly', () => {
      const digest: WorkDigest = {
        serviceIndex: 0n,
        codeHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        payloadHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        gasLimit: 0n,
        result: new Uint8Array([]), // Empty success result
        gasUsed: 0n,
        importCount: 0n,
        extrinsicCount: 0n,
        extrinsicSize: 0n,
        exportCount: 0n,
      }

      const encoded = encodeWorkDigest(digest)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle maximum values correctly', () => {
      const digest: WorkDigest = {
        serviceIndex: 0xffffffffn, // Max 32-bit integer
        codeHash:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        payloadHash:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        gasLimit: 0xffffffffffffffffn, // Max 64-bit integer
        result: new Uint8Array([255, 255, 255, 255]), // Large result
        gasUsed: 0xffffffffffffffffn,
        importCount: 0xffffffffffffffffn,
        extrinsicCount: 0xffffffffffffffffn,
        extrinsicSize: 0xffffffffffffffffn,
        exportCount: 0xffffffffffffffffn,
      }

      const encoded = encodeWorkDigest(digest)

      expect(encoded.length).toBeGreaterThan(0)
    })
  })

  describe('Work Digest Decoding', () => {
    it('should decode complete work digest with success result', () => {
      const digest: WorkDigest = {
        serviceIndex: 1n,
        codeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        payloadHash:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        gasLimit: 1000000n,
        result: new Uint8Array([1, 2, 3, 4, 5]), // Success result as octet sequence
        gasUsed: 500000n,
        importCount: 10n,
        extrinsicCount: 5n,
        extrinsicSize: 1024n,
        exportCount: 3n,
      }

      const encoded = encodeWorkDigest(digest)
      const { value: decoded } = decodeWorkDigest(encoded)

      expect(decoded).toEqual(digest)
    })

    it('should decode work digest with error result', () => {
      const digest: WorkDigest = {
        serviceIndex: 2n,
        codeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        payloadHash:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        gasLimit: 1000000n,
        result: WorkError.PANIC, // Error result
        gasUsed: 0n,
        importCount: 0n,
        extrinsicCount: 0n,
        extrinsicSize: 0n,
        exportCount: 0n,
      }

      const encoded = encodeWorkDigest(digest)
      const { value: decoded } = decodeWorkDigest(encoded)

      expect(decoded).toEqual(digest)
    })

    it('should handle zero values correctly', () => {
      const digest: WorkDigest = {
        serviceIndex: 0n,
        codeHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        payloadHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        gasLimit: 0n,
        result: new Uint8Array([]), // Empty success result
        gasUsed: 0n,
        importCount: 0n,
        extrinsicCount: 0n,
        extrinsicSize: 0n,
        exportCount: 0n,
      }

      const encoded = encodeWorkDigest(digest)
      const { value: decoded } = decodeWorkDigest(encoded)

      expect(decoded).toEqual(digest)
    })

    it('should handle maximum values correctly', () => {
      const digest: WorkDigest = {
        serviceIndex: 0xffffffffn, // Max 32-bit integer
        codeHash:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        payloadHash:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        gasLimit: 0xffffffffffffffffn, // Max 64-bit integer
        result: new Uint8Array([255, 255, 255, 255]), // Large result
        gasUsed: 0xffffffffffffffffn,
        importCount: 0xffffffffffffffffn,
        extrinsicCount: 0xffffffffffffffffn,
        extrinsicSize: 0xffffffffffffffffn,
        exportCount: 0xffffffffffffffffn,
      }

      const encoded = encodeWorkDigest(digest)
      const { value: decoded } = decodeWorkDigest(encoded)

      expect(decoded).toEqual(digest)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper work digest formula', () => {
      // Test the formula: encode(wdX ∈ workdigest) ≡ encode[4](wdX_wd_serviceindex) ∥ wdX_wd_codehash ∥ wdX_wd_payloadhash ∥ encode[8](wdX_wd_gaslimit) ∥ encoderesult(wdX_wd_result) ∥ wdX_wd_gasused ∥ wdX_wd_importcount ∥ wdX_wd_xtcount ∥ wdX_wd_xtsize ∥ wdX_wd_exportcount
      const digest: WorkDigest = {
        serviceIndex: 1n,
        codeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        payloadHash:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        gasLimit: 1000000n,
        result: new Uint8Array([1, 2, 3, 4, 5]),
        gasUsed: 500000n,
        importCount: 10n,
        extrinsicCount: 5n,
        extrinsicSize: 1024n,
        exportCount: 3n,
      }

      const encoded = encodeWorkDigest(digest)

      // Verify the structure by decoding
      const { value: decoded } = decodeWorkDigest(encoded)
      expect(decoded).toEqual(digest)
    })

    it('should handle all work error types', () => {
      const errorTypes = [
        WorkError.INFINITY,
        WorkError.PANIC,
        WorkError.BAD_EXPORTS,
        WorkError.OVERSIZE,
        WorkError.BAD,
        WorkError.BIG,
      ]

      for (const errorType of errorTypes) {
        const digest: WorkDigest = {
          serviceIndex: 1n,
          codeHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          payloadHash:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          gasLimit: 1000000n,
          result: errorType,
          gasUsed: 0n,
          importCount: 0n,
          extrinsicCount: 0n,
          extrinsicSize: 0n,
          exportCount: 0n,
        }

        const encoded = encodeWorkDigest(digest)
        const { value: decoded } = decodeWorkDigest(encoded)

        expect(decoded.result).toBe(errorType)
      }
    })

    it('should handle variable-length result data', () => {
      const testCases = [
        new Uint8Array([]), // Empty
        new Uint8Array([1]), // Single byte
        new Uint8Array([1, 2, 3, 4, 5]), // Small data
        new Uint8Array(Array.from({ length: 100 }, (_, i) => i % 256)), // Large data
      ]

      for (const resultData of testCases) {
        const digest: WorkDigest = {
          serviceIndex: 1n,
          codeHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          payloadHash:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          gasLimit: 1000000n,
          result: resultData,
          gasUsed: 500000n,
          importCount: 10n,
          extrinsicCount: 5n,
          extrinsicSize: 1024n,
          exportCount: 3n,
        }

        const encoded = encodeWorkDigest(digest)
        const { value: decoded } = decodeWorkDigest(encoded)

        expect(decoded.result).toEqual(resultData)
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve work digests through encode/decode cycle', () => {
      const testCases: WorkDigest[] = [
        {
          serviceIndex: 1n,
          codeHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          payloadHash:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          gasLimit: 1000000n,
          result: new Uint8Array([1, 2, 3, 4, 5]),
          gasUsed: 500000n,
          importCount: 10n,
          extrinsicCount: 5n,
          extrinsicSize: 1024n,
          exportCount: 3n,
        },
        {
          serviceIndex: 0n,
          codeHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          payloadHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          gasLimit: 0n,
          result: WorkError.PANIC,
          gasUsed: 0n,
          importCount: 0n,
          extrinsicCount: 0n,
          extrinsicSize: 0n,
          exportCount: 0n,
        },
        {
          serviceIndex: 0xffffffffn,
          codeHash:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          payloadHash:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          gasLimit: 0xffffffffffffffffn,
          result: new Uint8Array([255, 255, 255, 255]),
          gasUsed: 0xffffffffffffffffn,
          importCount: 0xffffffffffffffffn,
          extrinsicCount: 0xffffffffffffffffn,
          extrinsicSize: 0xffffffffffffffffn,
          exportCount: 0xffffffffffffffffn,
        },
      ]

      for (const digest of testCases) {
        const encoded = encodeWorkDigest(digest)
        const { value: decoded } = decodeWorkDigest(encoded)

        expect(decoded).toEqual(digest)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array(50) // Too short for complete work digest
      expect(() => decodeWorkDigest(shortData)).toThrow()
    })

    it('should handle negative service index (should be rejected)', () => {
      const digest: WorkDigest = {
        serviceIndex: -1n, // This should be rejected
        codeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        payloadHash:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        gasLimit: 1000000n,
        result: new Uint8Array([1, 2, 3, 4, 5]),
        gasUsed: 500000n,
        importCount: 10n,
        extrinsicCount: 5n,
        extrinsicSize: 1024n,
        exportCount: 3n,
      }

      // Should throw an error for negative service index
      expect(() => encodeWorkDigest(digest)).toThrow(
        'Natural number cannot be negative: -1',
      )
    })

    it('should handle negative gas limit (should be rejected)', () => {
      const digest: WorkDigest = {
        serviceIndex: 1n,
        codeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        payloadHash:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        gasLimit: -1n, // This should be rejected
        result: new Uint8Array([1, 2, 3, 4, 5]),
        gasUsed: 500000n,
        importCount: 10n,
        extrinsicCount: 5n,
        extrinsicSize: 1024n,
        exportCount: 3n,
      }

      // Should throw an error for negative gas limit
      expect(() => encodeWorkDigest(digest)).toThrow(
        'Natural number cannot be negative: -1',
      )
    })
  })
})
