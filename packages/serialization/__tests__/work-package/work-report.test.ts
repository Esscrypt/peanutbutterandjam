import { describe, expect, it } from 'vitest'
import { WorkError } from '../../src/types'
import {
  decodeWorkReport,
  encodeWorkReport,
  type WorkReport,
} from '../../src/work-package/work-report'

describe('Work Report Serialization', () => {
  describe('Work Report Encoding', () => {
    it('should encode complete work report', () => {
      const report: WorkReport = {
        availabilitySpecification: {
          packageHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          bundleLength: 1000n,
          erasureRoot:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          segmentRoot:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          segmentCount: 256n,
        },
        context: {
          anchorHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          anchorPostState:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          anchorAccountLog: new Uint8Array([1, 2, 3, 4, 5]),
          lookupAnchorHash:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          lookupAnchorTime: 1234567890n,
          prerequisites: new Uint8Array([6, 7, 8, 9, 10]),
        },
        core: new Uint8Array([11, 12, 13, 14, 15]),
        authorizer:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        authGasUsed: 500000n,
        authTrace: new Uint8Array([16, 17, 18, 19, 20]),
        stateRootLookup: new Uint8Array([21, 22, 23, 24, 25]),
        digests: [
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
            serviceIndex: 2n,
            codeHash:
              '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            payloadHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            gasLimit: 2000000n,
            result: WorkError.PANIC,
            gasUsed: 0n,
            importCount: 0n,
            extrinsicCount: 0n,
            extrinsicSize: 0n,
            exportCount: 0n,
          },
        ],
      }

      const encoded = encodeWorkReport(report)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle empty work report', () => {
      const report: WorkReport = {
        availabilitySpecification: {
          packageHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          bundleLength: 0n,
          erasureRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          segmentRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          segmentCount: 0n,
        },
        context: {
          anchorHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          anchorPostState:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          anchorAccountLog: new Uint8Array([]),
          lookupAnchorHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          lookupAnchorTime: 0n,
          prerequisites: new Uint8Array([]),
        },
        core: new Uint8Array([]),
        authorizer:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        authGasUsed: 0n,
        authTrace: new Uint8Array([]),
        stateRootLookup: new Uint8Array([]),
        digests: [],
      }

      const encoded = encodeWorkReport(report)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle large work report', () => {
      const report: WorkReport = {
        availabilitySpecification: {
          packageHash:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          bundleLength: 0xffffffffn,
          erasureRoot:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          segmentRoot:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          segmentCount: 0xffffn,
        },
        context: {
          anchorHash:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          anchorPostState:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          anchorAccountLog: new Uint8Array(
            Array.from({ length: 100 }, (_, i) => i % 256),
          ),
          lookupAnchorHash:
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          lookupAnchorTime: 0xffffffffn,
          prerequisites: new Uint8Array(
            Array.from({ length: 100 }, (_, i) => i % 256),
          ),
        },
        core: new Uint8Array(Array.from({ length: 100 }, (_, i) => i % 256)),
        authorizer:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        authGasUsed: 0xffffffffffffffffn,
        authTrace: new Uint8Array(
          Array.from({ length: 100 }, (_, i) => i % 256),
        ),
        stateRootLookup: new Uint8Array(
          Array.from({ length: 100 }, (_, i) => i % 256),
        ),
        digests: [
          {
            serviceIndex: 0xffffffffn,
            codeHash:
              '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            payloadHash:
              '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            gasLimit: 0xffffffffffffffffn,
            result: new Uint8Array(
              Array.from({ length: 100 }, (_, i) => i % 256),
            ),
            gasUsed: 0xffffffffffffffffn,
            importCount: 0xffffffffffffffffn,
            extrinsicCount: 0xffffffffffffffffn,
            extrinsicSize: 0xffffffffffffffffn,
            exportCount: 0xffffffffffffffffn,
          },
        ],
      }

      const encoded = encodeWorkReport(report)

      expect(encoded.length).toBeGreaterThan(0)
    })
  })

  describe('Work Report Decoding', () => {
    it('should decode complete work report', () => {
      const report: WorkReport = {
        availabilitySpecification: {
          packageHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          bundleLength: 1000n,
          erasureRoot:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          segmentRoot:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          segmentCount: 256n,
        },
        context: {
          anchorHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          anchorPostState:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          anchorAccountLog: new Uint8Array([1, 2, 3, 4, 5]),
          lookupAnchorHash:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          lookupAnchorTime: 1234567890n,
          prerequisites: new Uint8Array([6, 7, 8, 9, 10]),
        },
        core: new Uint8Array([11, 12, 13, 14, 15]),
        authorizer:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        authGasUsed: 500000n,
        authTrace: new Uint8Array([16, 17, 18, 19, 20]),
        stateRootLookup: new Uint8Array([21, 22, 23, 24, 25]),
        digests: [
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
        ],
      }

      const encoded = encodeWorkReport(report)
      const { value: decoded } = decodeWorkReport(encoded)

      expect(decoded).toEqual(report)
    })

    it('should handle empty work report', () => {
      const report: WorkReport = {
        availabilitySpecification: {
          packageHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          bundleLength: 0n,
          erasureRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          segmentRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          segmentCount: 0n,
        },
        context: {
          anchorHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          anchorPostState:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          anchorAccountLog: new Uint8Array([]),
          lookupAnchorHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          lookupAnchorTime: 0n,
          prerequisites: new Uint8Array([]),
        },
        core: new Uint8Array([]),
        authorizer:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        authGasUsed: 0n,
        authTrace: new Uint8Array([]),
        stateRootLookup: new Uint8Array([]),
        digests: [],
      }

      const encoded = encodeWorkReport(report)
      const { value: decoded } = decodeWorkReport(encoded)

      expect(decoded).toEqual(report)
    })

    it('should handle work report with multiple digests', () => {
      const report: WorkReport = {
        availabilitySpecification: {
          packageHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          bundleLength: 1000n,
          erasureRoot:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          segmentRoot:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          segmentCount: 256n,
        },
        context: {
          anchorHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          anchorPostState:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          anchorAccountLog: new Uint8Array([1, 2, 3, 4, 5]),
          lookupAnchorHash:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          lookupAnchorTime: 1234567890n,
          prerequisites: new Uint8Array([6, 7, 8, 9, 10]),
        },
        core: new Uint8Array([11, 12, 13, 14, 15]),
        authorizer:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        authGasUsed: 500000n,
        authTrace: new Uint8Array([16, 17, 18, 19, 20]),
        stateRootLookup: new Uint8Array([21, 22, 23, 24, 25]),
        digests: [
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
            serviceIndex: 2n,
            codeHash:
              '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            payloadHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            gasLimit: 2000000n,
            result: WorkError.PANIC,
            gasUsed: 0n,
            importCount: 0n,
            extrinsicCount: 0n,
            extrinsicSize: 0n,
            exportCount: 0n,
          },
          {
            serviceIndex: 3n,
            codeHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            payloadHash:
              '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            gasLimit: 3000000n,
            result: new Uint8Array([6, 7, 8, 9, 10]),
            gasUsed: 1500000n,
            importCount: 20n,
            extrinsicCount: 10n,
            extrinsicSize: 2048n,
            exportCount: 6n,
          },
        ],
      }

      const encoded = encodeWorkReport(report)
      const { value: decoded } = decodeWorkReport(encoded)

      expect(decoded).toEqual(report)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper work report formula', () => {
      // Test the formula: encode(wrX ∈ workreport) ≡ wrX_wr_avspec ∥ wrX_wr_context ∥ wrX_wr_core ∥ wrX_wr_authorizer ∥ wrX_wr_authgasused ∥ var{wrX_wr_authtrace} ∥ var{wrX_wr_srlookup} ∥ var{wrX_wr_digests}
      const report: WorkReport = {
        availabilitySpecification: {
          packageHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          bundleLength: 1000n,
          erasureRoot:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          segmentRoot:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          segmentCount: 256n,
        },
        context: {
          anchorHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          anchorPostState:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          anchorAccountLog: new Uint8Array([1, 2, 3, 4, 5]),
          lookupAnchorHash:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          lookupAnchorTime: 1234567890n,
          prerequisites: new Uint8Array([6, 7, 8, 9, 10]),
        },
        core: new Uint8Array([11, 12, 13, 14, 15]),
        authorizer:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        authGasUsed: 500000n,
        authTrace: new Uint8Array([16, 17, 18, 19, 20]),
        stateRootLookup: new Uint8Array([21, 22, 23, 24, 25]),
        digests: [
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
        ],
      }

      const encoded = encodeWorkReport(report)

      // Verify the structure by decoding
      const { value: decoded } = decodeWorkReport(encoded)
      expect(decoded).toEqual(report)
    })

    it('should handle variable-length octet sequences', () => {
      const testCases = [
        new Uint8Array([]), // Empty
        new Uint8Array([1]), // Single byte
        new Uint8Array([1, 2, 3, 4, 5]), // Small data
        new Uint8Array(Array.from({ length: 100 }, (_, i) => i % 256)), // Large data
      ]

      for (const testData of testCases) {
        const report: WorkReport = {
          availabilitySpecification: {
            packageHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            bundleLength: 1000n,
            erasureRoot:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            segmentRoot:
              '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            segmentCount: 256n,
          },
          context: {
            anchorHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            anchorPostState:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            anchorAccountLog: new Uint8Array([1, 2, 3, 4, 5]),
            lookupAnchorHash:
              '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            lookupAnchorTime: 1234567890n,
            prerequisites: new Uint8Array([6, 7, 8, 9, 10]),
          },
          core: testData,
          authorizer:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          authGasUsed: 500000n,
          authTrace: testData,
          stateRootLookup: testData,
          digests: [],
        }

        const encoded = encodeWorkReport(report)
        const { value: decoded } = decodeWorkReport(encoded)

        expect(decoded.core).toEqual(testData)
        expect(decoded.authTrace).toEqual(testData)
        expect(decoded.stateRootLookup).toEqual(testData)
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve work reports through encode/decode cycle', () => {
      const testCases: WorkReport[] = [
        {
          availabilitySpecification: {
            packageHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            bundleLength: 1000n,
            erasureRoot:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            segmentRoot:
              '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            segmentCount: 256n,
          },
          context: {
            anchorHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            anchorPostState:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            anchorAccountLog: new Uint8Array([1, 2, 3, 4, 5]),
            lookupAnchorHash:
              '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            lookupAnchorTime: 1234567890n,
            prerequisites: new Uint8Array([6, 7, 8, 9, 10]),
          },
          core: new Uint8Array([11, 12, 13, 14, 15]),
          authorizer:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          authGasUsed: 500000n,
          authTrace: new Uint8Array([16, 17, 18, 19, 20]),
          stateRootLookup: new Uint8Array([21, 22, 23, 24, 25]),
          digests: [
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
          ],
        },
        {
          availabilitySpecification: {
            packageHash:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            bundleLength: 0n,
            erasureRoot:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            segmentRoot:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            segmentCount: 0n,
          },
          context: {
            anchorHash:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            anchorPostState:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            anchorAccountLog: new Uint8Array([]),
            lookupAnchorHash:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            lookupAnchorTime: 0n,
            prerequisites: new Uint8Array([]),
          },
          core: new Uint8Array([]),
          authorizer:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          authGasUsed: 0n,
          authTrace: new Uint8Array([]),
          stateRootLookup: new Uint8Array([]),
          digests: [],
        },
      ]

      for (const report of testCases) {
        const encoded = encodeWorkReport(report)
        const { value: decoded } = decodeWorkReport(encoded)

        expect(decoded).toEqual(report)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array(50) // Too short for complete work report
      expect(() => decodeWorkReport(shortData)).toThrow()
    })

    it('should handle negative auth gas used (should be rejected)', () => {
      const report: WorkReport = {
        availabilitySpecification: {
          packageHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          bundleLength: 1000n,
          erasureRoot:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          segmentRoot:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          segmentCount: 256n,
        },
        context: {
          anchorHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          anchorPostState:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          anchorAccountLog: new Uint8Array([1, 2, 3, 4, 5]),
          lookupAnchorHash:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          lookupAnchorTime: 1234567890n,
          prerequisites: new Uint8Array([6, 7, 8, 9, 10]),
        },
        core: new Uint8Array([11, 12, 13, 14, 15]),
        authorizer:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        authGasUsed: -1n, // This should be rejected
        authTrace: new Uint8Array([16, 17, 18, 19, 20]),
        stateRootLookup: new Uint8Array([21, 22, 23, 24, 25]),
        digests: [],
      }

      // Should throw an error for negative auth gas used
      expect(() => encodeWorkReport(report)).toThrow(
        'Natural number cannot be negative: -1',
      )
    })
  })
})
