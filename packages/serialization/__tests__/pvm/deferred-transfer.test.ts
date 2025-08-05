import { describe, expect, it } from 'vitest'
import {
  decodeDeferredTransfer,
  encodeDeferredTransfer,
} from '../../src/pvm/deferred-transfer'
import type { DeferredTransfer } from '../../src/types'

describe('Deferred Transfer Serialization', () => {
  describe('Deferred Transfer Encoding', () => {
    it('should encode deferred transfer with simple values', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array([1, 2, 3, 4, 5]),
        gas: 50000n,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should encode deferred transfer with large values', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 0xffffffffn,
        destination: 0xffffffffn,
        amount: 0xffffffffffffffffn,
        memo: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        gas: 0xffffffffffffffffn,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle empty memo', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array(0),
        gas: 50000n,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle large memo', () => {
      const largeMemo = new Uint8Array(1000).fill(1)
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: largeMemo,
        gas: 50000n,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle zero values', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 0n,
        destination: 0n,
        amount: 0n,
        memo: new Uint8Array([1, 2, 3]),
        gas: 0n,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)

      expect(encoded.length).toBeGreaterThan(0)
    })
  })

  describe('Deferred Transfer Decoding', () => {
    it('should decode deferred transfer with simple values', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array([1, 2, 3, 4, 5]),
        gas: 50000n,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)
      const { value: decoded } = decodeDeferredTransfer(encoded)

      expect(decoded).toEqual(deferredTransfer)
    })

    it('should decode deferred transfer with large values', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 0xffffffffn,
        destination: 0xffffffffn,
        amount: 0xffffffffffffffffn,
        memo: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        gas: 0xffffffffffffffffn,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)
      const { value: decoded } = decodeDeferredTransfer(encoded)

      expect(decoded).toEqual(deferredTransfer)
    })

    it('should handle empty memo', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array(0),
        gas: 50000n,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)
      const { value: decoded } = decodeDeferredTransfer(encoded)

      expect(decoded).toEqual(deferredTransfer)
    })

    it('should handle large memo', () => {
      const largeMemo = new Uint8Array(1000).fill(1)
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: largeMemo,
        gas: 50000n,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)
      const { value: decoded } = decodeDeferredTransfer(encoded)

      expect(decoded).toEqual(deferredTransfer)
    })

    it('should handle zero values', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 0n,
        destination: 0n,
        amount: 0n,
        memo: new Uint8Array([1, 2, 3]),
        gas: 0n,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)
      const { value: decoded } = decodeDeferredTransfer(encoded)

      expect(decoded).toEqual(deferredTransfer)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper deferred transfer formula', () => {
      // Test the formula: encode[X](dxX ∈ defxfer) ≡ encode{encode[4](dxX_source), encode[4](dxX_dest), encode[8](dxX_amount), dxX_memo, encode[8](dxX_gas)}
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array([1, 2, 3, 4, 5]),
        gas: 50000n,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)

      // Verify the structure by decoding
      const { value: decoded } = decodeDeferredTransfer(encoded)
      expect(decoded).toEqual(deferredTransfer)
    })

    it('should handle maximum values for all fields', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 0xffffffffn, // Max 32-bit value
        destination: 0xffffffffn, // Max 32-bit value
        amount: 0xffffffffffffffffn, // Max 64-bit value
        memo: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        gas: 0xffffffffffffffffn, // Max 64-bit value
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)
      const { value: decoded } = decodeDeferredTransfer(encoded)

      expect(decoded).toEqual(deferredTransfer)
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve deferred transfers through encode/decode cycle', () => {
      const testCases: DeferredTransfer[] = [
        {
          source: 1234n,
          destination: 5678n,
          amount: 1000000n,
          memo: new Uint8Array([1, 2, 3, 4, 5]),
          gas: 50000n,
        },
        {
          source: 0xffffffffn,
          destination: 0xffffffffn,
          amount: 0xffffffffffffffffn,
          memo: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
          gas: 0xffffffffffffffffn,
        },
        {
          source: 0n,
          destination: 0n,
          amount: 0n,
          memo: new Uint8Array(0),
          gas: 0n,
        },
      ]

      for (const deferredTransfer of testCases) {
        const encoded = encodeDeferredTransfer(deferredTransfer)
        const { value: decoded } = decodeDeferredTransfer(encoded)

        expect(decoded).toEqual(deferredTransfer)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array(20) // Too short for complete deferred transfer
      expect(() => decodeDeferredTransfer(shortData)).toThrow(
        'Insufficient data',
      )
    })

    it('should handle negative source (should be rejected)', () => {
      const deferredTransfer: DeferredTransfer = {
        source: -1n as bigint, // Force negative value
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array([1, 2, 3, 4, 5]),
        gas: 50000n,
      }

      expect(() => encodeDeferredTransfer(deferredTransfer)).toThrow(
        'Natural number cannot be negative',
      )
    })

    it('should handle negative destination (should be rejected)', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: -1n as bigint, // Force negative value
        amount: 1000000n,
        memo: new Uint8Array([1, 2, 3, 4, 5]),
        gas: 50000n,
      }

      expect(() => encodeDeferredTransfer(deferredTransfer)).toThrow(
        'Natural number cannot be negative',
      )
    })

    it('should handle negative amount (should be rejected)', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: -1n as bigint, // Force negative value
        memo: new Uint8Array([1, 2, 3, 4, 5]),
        gas: 50000n,
      }

      expect(() => encodeDeferredTransfer(deferredTransfer)).toThrow(
        'Natural number cannot be negative',
      )
    })

    it('should handle negative gas (should be rejected)', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array([1, 2, 3, 4, 5]),
        gas: -1n as bigint, // Force negative value
      }

      expect(() => encodeDeferredTransfer(deferredTransfer)).toThrow(
        'Natural number cannot be negative',
      )
    })

    it('should handle very large memo', () => {
      const veryLargeMemo = new Uint8Array(10000).fill(1)
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: veryLargeMemo,
        gas: 50000n,
      }

      const encoded = encodeDeferredTransfer(deferredTransfer)
      const { value: decoded } = decodeDeferredTransfer(encoded)

      expect(decoded).toEqual(deferredTransfer)
    })
  })
})
