/**
 * Erasure Coding Tests
 *
 * Tests for the JAM protocol erasure coding implementation
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  BLOB_ERASURE_CODING_PARAMS,
  JAMErasureCoder,
  SEGMENT_ERASURE_CODING_PARAMS,
} from '../index'

beforeAll(() => {
  logger.init()
})

describe('JAM Erasure Coder', () => {
  describe('Basic Encoding and Decoding', () => {
    it('should encode and decode small data correctly', () => {
      const coder = new JAMErasureCoder()
      const originalData = new TextEncoder().encode('Hello, JAM Protocol!')

      // Pad to multiple of 684 Uint8Array
      const paddedLength = Math.ceil(originalData.length / 684) * 684
      const paddedData = new Uint8Array(paddedLength)
      paddedData.set(originalData)

      const encoded = coder.encode(paddedData)
      const decoded = coder.decode(encoded)

      // Remove padding
      const unpaddedDecoded = decoded.slice(0, originalData.length)

      expect(unpaddedDecoded).toEqual(originalData)
    })

    it('should encode and decode large data correctly', () => {
      const coder = new JAMErasureCoder()
      const originalData = new Uint8Array(2048) // Multiple of 684
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = i % 256
      }

      const encoded = coder.encode(originalData)
      const decoded = coder.decode(encoded)

      expect(decoded).toEqual(originalData)
    })
  })

  describe('Parameter Validation', () => {
    it('should validate encoding parameters', () => {
      const coder = new JAMErasureCoder()
      const data = new Uint8Array(684)

      // Valid parameters
      expect(() => coder.encode(data, 342, 1023)).not.toThrow()

      // Invalid parameters
      expect(() => coder.encode(data, 0, 1023)).toThrow()
      expect(() => coder.encode(data, 342, 0)).toThrow()
      expect(() => coder.encode(data, 1023, 1023)).toThrow() // k >= n
    })

    it('should validate decoding parameters', () => {
      const coder = new JAMErasureCoder()
      const data = new Uint8Array(684)
      const encoded = coder.encode(data)

      // Valid parameters
      expect(() => coder.decode(encoded, 342)).not.toThrow()

      // Invalid parameters
      expect(() => coder.decode(encoded, 0)).toThrow()
    })
  })

  describe('Blob Encoding', () => {
    it('should use correct parameters for blob encoding', () => {
      const coder = new JAMErasureCoder(BLOB_ERASURE_CODING_PARAMS)
      const params = coder.getParams()

      expect(params.k).toBe(342)
      expect(params.n).toBe(1023)
      expect(params.fieldSize).toBe(65536)
    })

    it('should encode blob data correctly', () => {
      const coder = new JAMErasureCoder(BLOB_ERASURE_CODING_PARAMS)
      const originalData = new Uint8Array(1368) // 2 * 684 Uint8Array
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = i % 256
      }

      const encoded = coder.encode(originalData)
      const decoded = coder.decode(encoded)

      expect(decoded).toEqual(originalData)
      expect(encoded.shards.length).toBe(1023)
      expect(encoded.k).toBe(342)
      expect(encoded.n).toBe(1023)
    })
  })

  describe('Segment Encoding', () => {
    it('should use correct parameters for segment encoding', () => {
      const coder = new JAMErasureCoder(SEGMENT_ERASURE_CODING_PARAMS)
      const params = coder.getParams()

      expect(params.k).toBe(6)
      expect(params.n).toBe(1023)
      expect(params.fieldSize).toBe(65536)
    })

    it('should encode segment data correctly', () => {
      const coder = new JAMErasureCoder(SEGMENT_ERASURE_CODING_PARAMS)
      const originalData = new Uint8Array(4104) // 6 * 684 Uint8Array
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = i % 256
      }

      const encoded = coder.encode(originalData)
      const decoded = coder.decode(encoded)

      expect(decoded).toEqual(originalData)
      expect(encoded.shards.length).toBe(1023)
      expect(encoded.k).toBe(6)
      expect(encoded.n).toBe(1023)
    })
  })

  describe('Data Integrity', () => {
    it('should maintain data integrity through encoding/decoding', () => {
      const coder = new JAMErasureCoder()
      const originalData = new Uint8Array(684)

      // Fill with pattern
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = (i * 7) % 256
      }

      const encoded = coder.encode(originalData)
      const decoded = coder.decode(encoded)

      expect(decoded).toEqual(originalData)
    })

    it('should handle edge case data sizes', () => {
      const coder = new JAMErasureCoder()

      // Test with exactly 684 Uint8Array
      const data684 = new Uint8Array(684)
      for (let i = 0; i < data684.length; i++) {
        data684[i] = i % 256
      }

      const encoded684 = coder.encode(data684)
      const decoded684 = coder.decode(encoded684)
      expect(decoded684).toEqual(data684)

      // Test with 1 byte (should be padded)
      const data1 = new Uint8Array([42])
      const encoded1 = coder.encode(data1)
      const decoded1 = coder.decode(encoded1)
      expect(decoded1.slice(0, 1)).toEqual(data1)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid input data', () => {
      const coder = new JAMErasureCoder()

      // Empty data
      expect(() => coder.encode(new Uint8Array(0))).toThrow()

      // Null data
      expect(() => coder.encode(null as unknown as Uint8Array)).toThrow()
    })

    it('should handle invalid encoded data', () => {
      const coder = new JAMErasureCoder()

      // Invalid encoded data structure
      expect(() =>
        coder.decode({
          originalLength: 0,
          k: 342,
          n: 1023,
          shards: [],
          indices: [],
        }),
      ).toThrow()
    })
  })
})
