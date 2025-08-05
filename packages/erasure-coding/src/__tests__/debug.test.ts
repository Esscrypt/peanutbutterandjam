/**
 * Debug Tests for Erasure Coding
 *
 * Tests to debug and fix Reed-Solomon implementation issues
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { GF2_16, JAMErasureCoder, PolynomialOps, ReedSolomon } from '../index'

beforeAll(() => {
  logger.init()
})

describe('Debug Tests', () => {
  describe('Finite Field Operations', () => {
    it('should perform basic finite field operations correctly', () => {
      const field = new GF2_16()

      // Test basic operations
      expect(field.add(1, 2)).toBe(3)
      expect(field.multiply(2, 3)).toBe(6)
      expect(field.divide(6, 2)).toBe(3)
      expect(field.inverse(2)).toBeGreaterThan(0)
    })

    it('should handle field arithmetic correctly', () => {
      const field = new GF2_16()

      // Test that multiplication and division are inverses
      const a = 42
      const b = 17
      const product = field.multiply(a, b)
      const quotient = field.divide(product, b)
      expect(quotient).toBe(a)
    })
  })

  describe('Polynomial Operations', () => {
    it('should perform polynomial arithmetic correctly', () => {
      const field = new GF2_16()
      const poly = new PolynomialOps(field)

      // Test polynomial addition (in GF(2^16), addition is XOR)
      const a = [1, 2, 3]
      const b = [4, 5, 6]
      const sum = poly.add(a, b)
      expect(sum).toEqual([5, 7, 5]) // 1^4=5, 2^5=7, 3^6=5

      // Test polynomial evaluation (in GF(2^16))
      const result = poly.evaluate([1, 2, 3], 2)
      // In GF(2^16): 1 + 2*2 + 3*2^2 = 1 + 4 + 12 = 1 ^ 4 ^ 12 = 9
      expect(result).toBe(9)
    })

    it('should interpolate polynomials correctly', () => {
      const field = new GF2_16()
      const poly = new PolynomialOps(field)

      // Test interpolation with simple points
      const points = [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
      ]

      const interpolated = poly.interpolate(points)
      expect(interpolated.length).toBeGreaterThan(0)

      // Verify the polynomial passes through the points
      for (const point of points) {
        const evaluated = poly.evaluate(interpolated, point.x)
        expect(evaluated).toBe(point.y)
      }
    })
  })

  describe('Reed-Solomon Algorithm', () => {
    it('should encode and decode simple data correctly', () => {
      const field = new GF2_16()
      const poly = new PolynomialOps(field)
      const rs = new ReedSolomon(field, poly)

      // Test with small k and n
      const k = 3
      const n = 5
      const data = [1, 2, 3]

      console.log('Original data:', data)

      const encoded = rs.encode(data, k, n)
      console.log('Encoded data:', encoded)
      expect(encoded.length).toBe(n)

      // Decode using first k elements
      const decoded = rs.decode(encoded.slice(0, k), k, n)
      console.log('Decoded data:', decoded)
      expect(decoded).toEqual(data)
    })

    it('should debug Reed-Solomon step by step', () => {
      const field = new GF2_16()
      const poly = new PolynomialOps(field)
      const rs = new ReedSolomon(field, poly)

      const k = 3
      const n = 5
      const data = [1, 2, 3]

      console.log('=== Reed-Solomon Debug ===')
      console.log('Original data:', data)

      // Test validator index conversion
      for (let i = 0; i < k; i++) {
        const fieldElement = rs['validatorIndexToFieldElement'](i)
        console.log(`Validator ${i} -> Field element: ${fieldElement}`)
      }

      // Test encoding
      const encoded = rs.encode(data, k, n)
      console.log('Encoded data:', encoded)

      // Test decoding
      const decoded = rs.decode(encoded.slice(0, k), k, n)
      console.log('Decoded data:', decoded)
    })

    it('should handle systematic encoding correctly', () => {
      const field = new GF2_16()
      const poly = new PolynomialOps(field)
      const rs = new ReedSolomon(field, poly)

      const k = 3
      const n = 5
      const data = [1, 2, 3]

      const systematic = rs.systematicEncode(data, k, n)
      expect(systematic.length).toBe(n)

      // First k elements should be the original data
      expect(systematic.slice(0, k)).toEqual(data)
    })
  })

  describe('Core Encoding/Decoding', () => {
    it('should handle simple data correctly', () => {
      const coder = new JAMErasureCoder({ k: 3, n: 5 })
      const data = new Uint8Array([1, 2, 3, 4, 5, 6]) // 6 bytes

      // For testing, we'll use a simpler approach
      // Create data that's exactly 684 bytes (342 words * 2 bytes per word)
      const paddedData = new Uint8Array(684)
      paddedData.set(data)

      const encoded = coder.encode(paddedData, 3, 5)
      expect(encoded.shards.length).toBe(5)
      expect(encoded.k).toBe(3)
      expect(encoded.n).toBe(5)

      const decoded = coder.decode(encoded, 3)
      // The decoded data should be the full 684 bytes, so we need to extract the original 6 bytes
      expect(decoded.slice(0, data.length)).toEqual(data)
    })

    it('should debug the encoding process step by step', () => {
      const coder = new JAMErasureCoder({ k: 3, n: 5 })
      const data = new Uint8Array([1, 2, 3, 4, 5, 6])

      console.log('Original data:', Array.from(data))

      // Pad data
      const paddedData = coder['padData'](data)
      console.log('Padded data length:', paddedData.length)

      // Convert to words
      const words = coder['dataToWords'](paddedData)
      console.log('Words:', words)

      // Split into chunks
      const chunks = coder['splitIntoChunks'](words, 3)
      console.log('Chunks:', chunks)

      // This should help identify where the issue is
      expect(chunks.length).toBeGreaterThan(0)
    })
  })
})
