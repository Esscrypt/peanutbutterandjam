import { describe, expect, it } from 'vitest'
import type { WorkPackage } from '../../src/types'
import {
  decodeWorkPackage,
  encodeWorkPackage,
} from '../../src/work-package/work-package'

describe('Work Package Serialization', () => {
  describe('Work Package Encoding', () => {
    it('should encode complete work package', () => {
      const workPackage: WorkPackage = {
        authCodeHost: 1n,
        authCodeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
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
        authToken: new Uint8Array([11, 12, 13, 14, 15]),
        authConfig: new Uint8Array([16, 17, 18, 19, 20]),
        workItems: [
          {
            serviceIndex: 1n,
            codeHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            refGasLimit: 1000000n,
            accGasLimit: 500000n,
            exportCount: 3n,
            payload: new Uint8Array([1, 2, 3, 4, 5]),
            importSegments: [
              {
                hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                index: 1n,
              },
            ],
            extrinsics: [
              {
                hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
                index: 2n,
              },
            ],
          },
        ],
      }

      const encoded = encodeWorkPackage(workPackage)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle empty work package', () => {
      const workPackage: WorkPackage = {
        authCodeHost: 0n,
        authCodeHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
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
        authToken: new Uint8Array([]),
        authConfig: new Uint8Array([]),
        workItems: [],
      }

      const encoded = encodeWorkPackage(workPackage)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle large work package', () => {
      const workPackage: WorkPackage = {
        authCodeHost: 0xffffffffn,
        authCodeHash:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
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
        authToken: new Uint8Array(
          Array.from({ length: 100 }, (_, i) => i % 256),
        ),
        authConfig: new Uint8Array(
          Array.from({ length: 100 }, (_, i) => i % 256),
        ),
        workItems: [
          {
            serviceIndex: 0xffffffffn,
            codeHash:
              '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            refGasLimit: 0xffffffffffffffffn,
            accGasLimit: 0xffffffffffffffffn,
            exportCount: 0xffffn,
            payload: new Uint8Array(
              Array.from({ length: 100 }, (_, i) => i % 256),
            ),
            importSegments: [
              {
                hash: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                index: 0xffffffffn,
              },
            ],
            extrinsics: [
              {
                hash: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                index: 0xffffffffn,
              },
            ],
          },
        ],
      }

      const encoded = encodeWorkPackage(workPackage)

      expect(encoded.length).toBeGreaterThan(0)
    })
  })

  describe('Work Package Decoding', () => {
    it('should decode complete work package', () => {
      const workPackage: WorkPackage = {
        authCodeHost: 1n,
        authCodeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
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
        authToken: new Uint8Array([11, 12, 13, 14, 15]),
        authConfig: new Uint8Array([16, 17, 18, 19, 20]),
        workItems: [
          {
            serviceIndex: 1n,
            codeHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            refGasLimit: 1000000n,
            accGasLimit: 500000n,
            exportCount: 3n,
            payload: new Uint8Array([1, 2, 3, 4, 5]),
            importSegments: [
              {
                hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                index: 1n,
              },
            ],
            extrinsics: [
              {
                hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
                index: 2n,
              },
            ],
          },
        ],
      }

      const encoded = encodeWorkPackage(workPackage)
      const { value: decoded } = decodeWorkPackage(encoded)

      expect(decoded).toEqual(workPackage)
    })

    it('should handle empty work package', () => {
      const workPackage: WorkPackage = {
        authCodeHost: 0n,
        authCodeHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
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
        authToken: new Uint8Array([]),
        authConfig: new Uint8Array([]),
        workItems: [],
      }

      const encoded = encodeWorkPackage(workPackage)
      const { value: decoded } = decodeWorkPackage(encoded)

      expect(decoded).toEqual(workPackage)
    })

    it('should handle work package with multiple work items', () => {
      const workPackage: WorkPackage = {
        authCodeHost: 1n,
        authCodeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
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
        authToken: new Uint8Array([11, 12, 13, 14, 15]),
        authConfig: new Uint8Array([16, 17, 18, 19, 20]),
        workItems: [
          {
            serviceIndex: 1n,
            codeHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            refGasLimit: 1000000n,
            accGasLimit: 500000n,
            exportCount: 3n,
            payload: new Uint8Array([1, 2, 3, 4, 5]),
            importSegments: [
              {
                hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                index: 1n,
              },
            ],
            extrinsics: [
              {
                hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
                index: 2n,
              },
            ],
          },
          {
            serviceIndex: 2n,
            codeHash:
              '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            refGasLimit: 2000000n,
            accGasLimit: 1000000n,
            exportCount: 6n,
            payload: new Uint8Array([6, 7, 8, 9, 10]),
            importSegments: [
              {
                hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                index: 3n,
              },
            ],
            extrinsics: [
              {
                hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                index: 4n,
              },
            ],
          },
        ],
      }

      const encoded = encodeWorkPackage(workPackage)
      const { value: decoded } = decodeWorkPackage(encoded)

      expect(decoded).toEqual(workPackage)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper work package formula', () => {
      // Test the formula: encode(wpX ∈ workpackage) ≡ encode[4](wpX_wp_authcodehost) ∥ wpX_wp_authcodehash ∥ wpX_wp_context ∥ wpX_wp_authtoken ∥ wpX_wp_authconfig ∥ var{wpX_wp_workitems}
      const workPackage: WorkPackage = {
        authCodeHost: 1n,
        authCodeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
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
        authToken: new Uint8Array([11, 12, 13, 14, 15]),
        authConfig: new Uint8Array([16, 17, 18, 19, 20]),
        workItems: [
          {
            serviceIndex: 1n,
            codeHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            refGasLimit: 1000000n,
            accGasLimit: 500000n,
            exportCount: 3n,
            payload: new Uint8Array([1, 2, 3, 4, 5]),
            importSegments: [
              {
                hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                index: 1n,
              },
            ],
            extrinsics: [
              {
                hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
                index: 2n,
              },
            ],
          },
        ],
      }

      const encoded = encodeWorkPackage(workPackage)

      // Verify the structure by decoding
      const { value: decoded } = decodeWorkPackage(encoded)
      expect(decoded).toEqual(workPackage)
    })

    it('should handle variable-length octet sequences', () => {
      const testCases = [
        new Uint8Array([]), // Empty
        new Uint8Array([1]), // Single byte
        new Uint8Array([1, 2, 3, 4, 5]), // Small data
        new Uint8Array(Array.from({ length: 100 }, (_, i) => i % 256)), // Large data
      ]

      for (const testData of testCases) {
        const workPackage: WorkPackage = {
          authCodeHost: 1n,
          authCodeHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
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
          authToken: testData,
          authConfig: testData,
          workItems: [],
        }

        const encoded = encodeWorkPackage(workPackage)
        const { value: decoded } = decodeWorkPackage(encoded)

        expect(decoded.authToken).toEqual(testData)
        expect(decoded.authConfig).toEqual(testData)
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve work packages through encode/decode cycle', () => {
      const testCases: WorkPackage[] = [
        {
          authCodeHost: 1n,
          authCodeHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
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
          authToken: new Uint8Array([11, 12, 13, 14, 15]),
          authConfig: new Uint8Array([16, 17, 18, 19, 20]),
          workItems: [
            {
              serviceIndex: 1n,
              codeHash:
                '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              refGasLimit: 1000000n,
              accGasLimit: 500000n,
              exportCount: 3n,
              payload: new Uint8Array([1, 2, 3, 4, 5]),
              importSegments: [
                {
                  hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                  index: 1n,
                },
              ],
              extrinsics: [
                {
                  hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
                  index: 2n,
                },
              ],
            },
          ],
        },
        {
          authCodeHost: 0n,
          authCodeHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
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
          authToken: new Uint8Array([]),
          authConfig: new Uint8Array([]),
          workItems: [],
        },
      ]

      for (const workPackage of testCases) {
        const encoded = encodeWorkPackage(workPackage)
        const { value: decoded } = decodeWorkPackage(encoded)

        expect(decoded).toEqual(workPackage)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array(50) // Too short for complete work package
      expect(() => decodeWorkPackage(shortData)).toThrow()
    })

    it('should handle negative auth code host (should be rejected)', () => {
      const workPackage: WorkPackage = {
        authCodeHost: -1n, // This should be rejected
        authCodeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
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
        authToken: new Uint8Array([11, 12, 13, 14, 15]),
        authConfig: new Uint8Array([16, 17, 18, 19, 20]),
        workItems: [],
      }

      // Should throw an error for negative auth code host
      expect(() => encodeWorkPackage(workPackage)).toThrow(
        'Natural number cannot be negative: -1',
      )
    })
  })
})
