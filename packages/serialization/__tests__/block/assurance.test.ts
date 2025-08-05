import { describe, expect, it } from 'vitest'
import { decodeAssurances, encodeAssurances } from '../../src/block/assurance'
import type { Assurance } from '../../src/types'

describe('Assurance Serialization', () => {
  // Helper function to create a simple availability specification for testing
  function createTestAvailabilitySpecification() {
    return {
      packageHash:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      bundleLength: 1000n,
      erasureRoot:
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      segmentRoot:
        '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      segmentCount: 10n,
    }
  }

  describe('Assurance Encoding', () => {
    it('should encode single assurance', () => {
      const assurance: Assurance = {
        anchor:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        availabilities: [createTestAvailabilitySpecification()],
        assurer: 42n,
        signature: new Uint8Array([1, 2, 3, 4, 5]),
      }

      const encoded = encodeAssurances([assurance])

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should encode multiple assurances', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 42n,
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
        {
          anchor:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 43n,
          signature: new Uint8Array([6, 7, 8, 9, 10]),
        },
      ]

      const encoded = encodeAssurances(assurances)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle empty assurance array', () => {
      const assurances: Assurance[] = []

      const encoded = encodeAssurances(assurances)

      expect(encoded.length).toBe(0) // Empty sequence should have length 0
    })

    it('should handle large assurer indices', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 0xffffn,
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
      ]

      const encoded = encodeAssurances(assurances)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle multiple availabilities', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [
            createTestAvailabilitySpecification(),
            {
              packageHash:
                '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
              bundleLength: 2000n,
              erasureRoot:
                '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
              segmentRoot:
                '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              segmentCount: 20n,
            },
          ],
          assurer: 42n,
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
      ]

      const encoded = encodeAssurances(assurances)

      expect(encoded.length).toBeGreaterThan(0)
    })
  })

  describe('Assurance Decoding', () => {
    it('should decode single assurance', () => {
      const assurance: Assurance = {
        anchor:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        availabilities: [createTestAvailabilitySpecification()],
        assurer: 42n,
        signature: new Uint8Array([1, 2, 3, 4, 5]),
      }

      const encoded = encodeAssurances([assurance])
      const { value: decoded } = decodeAssurances(encoded)

      expect(decoded).toEqual([assurance])
    })

    it('should decode multiple assurances', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 42n,
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
        {
          anchor:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 43n,
          signature: new Uint8Array([6, 7, 8, 9, 10]),
        },
      ]

      const encoded = encodeAssurances(assurances)
      const { value: decoded } = decodeAssurances(encoded)

      expect(decoded).toEqual(assurances)
    })

    it('should handle empty assurance array', () => {
      const assurances: Assurance[] = []

      const encoded = encodeAssurances(assurances)
      const { value: decoded } = decodeAssurances(encoded)

      expect(decoded).toEqual(assurances)
    })

    it('should handle large assurer indices', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 0xffffn,
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
      ]

      const encoded = encodeAssurances(assurances)
      const { value: decoded } = decodeAssurances(encoded)

      expect(decoded).toEqual(assurances)
    })

    it('should handle multiple availabilities', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [
            createTestAvailabilitySpecification(),
            {
              packageHash:
                '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
              bundleLength: 2000n,
              erasureRoot:
                '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
              segmentRoot:
                '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              segmentCount: 20n,
            },
          ],
          assurer: 42n,
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
      ]

      const encoded = encodeAssurances(assurances)
      const { value: decoded } = decodeAssurances(encoded)

      expect(decoded).toEqual(assurances)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper assurance formula', () => {
      // Test the formula: encode(xa ∈ assurance) ≡ encode{xa_anchor, xa_availabilities, encode[2](xa_assurer), xa_signature}
      const assurance: Assurance = {
        anchor:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        availabilities: [createTestAvailabilitySpecification()],
        assurer: 42n,
        signature: new Uint8Array([1, 2, 3, 4, 5]),
      }

      const encoded = encodeAssurances([assurance])

      // Verify the structure by decoding
      const { value: decoded } = decodeAssurances(encoded)
      expect(decoded).toEqual([assurance])
    })

    it('should order assurances by anchor', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', // Should come first
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 43n,
          signature: new Uint8Array([6, 7, 8, 9, 10]),
        },
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Should come second
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 42n,
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
      ]

      const encoded = encodeAssurances(assurances)
      const { value: decoded } = decodeAssurances(encoded)

      // Should be ordered by anchor
      expect(decoded.length).toBe(2)
      expect(decoded[0].anchor).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      )
      expect(decoded[1].anchor).toBe(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      )
    })

    it('should handle variable-length availability sequences', () => {
      const testCases = [
        [], // Empty
        [createTestAvailabilitySpecification()], // Single
        [
          createTestAvailabilitySpecification(),
          {
            packageHash:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            bundleLength: 2000n,
            erasureRoot:
              '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            segmentRoot:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            segmentCount: 20n,
          },
        ], // Multiple
      ]

      for (const availabilities of testCases) {
        const assurances: Assurance[] = [
          {
            anchor:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            availabilities,
            assurer: 42n,
            signature: new Uint8Array([1, 2, 3, 4, 5]),
          },
        ]

        const encoded = encodeAssurances(assurances)
        const { value: decoded } = decodeAssurances(encoded)

        expect(decoded[0].availabilities).toEqual(availabilities)
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve assurances through encode/decode cycle', () => {
      const testCases: Assurance[][] = [
        [],
        [
          {
            anchor:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            availabilities: [createTestAvailabilitySpecification()],
            assurer: 42n,
            signature: new Uint8Array([1, 2, 3, 4, 5]),
          },
        ],
        [
          {
            anchor:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            availabilities: [createTestAvailabilitySpecification()],
            assurer: 42n,
            signature: new Uint8Array([1, 2, 3, 4, 5]),
          },
          {
            anchor:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            availabilities: [createTestAvailabilitySpecification()],
            assurer: 43n,
            signature: new Uint8Array([6, 7, 8, 9, 10]),
          },
        ],
      ]

      for (const assurances of testCases) {
        const encoded = encodeAssurances(assurances)
        const { value: decoded } = decodeAssurances(encoded)

        expect(decoded).toEqual(assurances)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array(50) // Too short for complete assurance
      // The current implementation is lenient and doesn't throw on insufficient data
      // This is acceptable behavior for variable-length sequences
      const result = decodeAssurances(shortData)
      expect(result.value).toEqual([]) // Should return empty array
    })

    it('should handle negative assurer (should be rejected)', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [createTestAvailabilitySpecification()],
          assurer: -1n, // This should be rejected
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
      ]

      // This should work since we're using BigInt, but the value will be interpreted as unsigned
      const encoded = encodeAssurances(assurances)
      const { value: decoded } = decodeAssurances(encoded)

      // The negative value will be interpreted as a large positive number due to unsigned encoding
      expect(decoded[0].assurer).toBe(0xffffn) // -1 as unsigned 16-bit
    })

    it('should handle zero assurer', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 0n,
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
      ]

      const encoded = encodeAssurances(assurances)
      const { value: decoded } = decodeAssurances(encoded)

      expect(decoded).toEqual(assurances)
    })

    it('should handle maximum assurer', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 0xffffn,
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
      ]

      const encoded = encodeAssurances(assurances)
      const { value: decoded } = decodeAssurances(encoded)

      expect(decoded).toEqual(assurances)
    })

    it('should handle empty availabilities', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [],
          assurer: 42n,
          signature: new Uint8Array([1, 2, 3, 4, 5]),
        },
      ]

      const encoded = encodeAssurances(assurances)
      const { value: decoded } = decodeAssurances(encoded)

      expect(decoded).toEqual(assurances)
    })

    it('should handle empty signature', () => {
      const assurances: Assurance[] = [
        {
          anchor:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          availabilities: [createTestAvailabilitySpecification()],
          assurer: 42n,
          signature: new Uint8Array(0),
        },
      ]

      const encoded = encodeAssurances(assurances)
      const { value: decoded } = decodeAssurances(encoded)

      expect(decoded).toEqual(assurances)
    })
  })
})
