import { describe, expect, it } from 'vitest'
import {
  decodeAccumulateInput,
  encodeAccumulateInput,
} from '../../src/pvm/accumulate-input'
import type {
  AccumulateInput,
  DeferredTransfer,
  OperandTuple,
} from '../../src/types'
import { WorkError } from '../../src/types'

describe('Accumulate Input Serialization', () => {
  describe('Accumulate Input Encoding', () => {
    it('should encode operand tuple accumulate input', () => {
      const operandTuple: OperandTuple = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        segmentRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        authorizer:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        payloadHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        gasLimit: 1000000n,
        result: new Uint8Array([1, 2, 3, 4, 5]),
        authTrace: new Uint8Array([6, 7, 8, 9, 10]),
      }

      const accumulateInput: AccumulateInput = {
        type: 'operand',
        value: operandTuple,
      }

      const encoded = encodeAccumulateInput(accumulateInput)

      expect(encoded.length).toBeGreaterThan(0)
      expect(encoded[0]).toBe(0) // Discriminator for operand tuple
    })

    it('should encode deferred transfer accumulate input', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array([1, 2, 3, 4, 5]),
        gas: 50000n,
      }

      const accumulateInput: AccumulateInput = {
        type: 'deferred',
        value: deferredTransfer,
      }

      const encoded = encodeAccumulateInput(accumulateInput)

      expect(encoded.length).toBeGreaterThan(0)
      expect(encoded[0]).toBe(1) // Discriminator for deferred transfer
    })

    it('should handle operand tuple with error result', () => {
      const operandTuple: OperandTuple = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        segmentRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        authorizer:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        payloadHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        gasLimit: 1000000n,
        result: WorkError.PANIC,
        authTrace: new Uint8Array([6, 7, 8, 9, 10]),
      }

      const accumulateInput: AccumulateInput = {
        type: 'operand',
        value: operandTuple,
      }

      const encoded = encodeAccumulateInput(accumulateInput)

      expect(encoded.length).toBeGreaterThan(0)
      expect(encoded[0]).toBe(0) // Discriminator for operand tuple
    })

    it('should handle deferred transfer with large values', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 0xffffffffn,
        destination: 0xffffffffn,
        amount: 0xffffffffffffffffn,
        memo: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        gas: 0xffffffffffffffffn,
      }

      const accumulateInput: AccumulateInput = {
        type: 'deferred',
        value: deferredTransfer,
      }

      const encoded = encodeAccumulateInput(accumulateInput)

      expect(encoded.length).toBeGreaterThan(0)
      expect(encoded[0]).toBe(1) // Discriminator for deferred transfer
    })
  })

  describe('Accumulate Input Decoding', () => {
    it('should decode operand tuple accumulate input', () => {
      const operandTuple: OperandTuple = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        segmentRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        authorizer:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        payloadHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        gasLimit: 1000000n,
        result: new Uint8Array([1, 2, 3, 4, 5]),
        authTrace: new Uint8Array([6, 7, 8, 9, 10]),
      }

      const accumulateInput: AccumulateInput = {
        type: 'operand',
        value: operandTuple,
      }

      const encoded = encodeAccumulateInput(accumulateInput)
      const { value: decoded } = decodeAccumulateInput(encoded)

      expect(decoded).toEqual(accumulateInput)
    })

    it('should decode deferred transfer accumulate input', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array([1, 2, 3, 4, 5]),
        gas: 50000n,
      }

      const accumulateInput: AccumulateInput = {
        type: 'deferred',
        value: deferredTransfer,
      }

      const encoded = encodeAccumulateInput(accumulateInput)
      const { value: decoded } = decodeAccumulateInput(encoded)

      expect(decoded).toEqual(accumulateInput)
    })

    it('should handle operand tuple with error result', () => {
      const operandTuple: OperandTuple = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        segmentRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        authorizer:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        payloadHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        gasLimit: 1000000n,
        result: WorkError.PANIC,
        authTrace: new Uint8Array([6, 7, 8, 9, 10]),
      }

      const accumulateInput: AccumulateInput = {
        type: 'operand',
        value: operandTuple,
      }

      const encoded = encodeAccumulateInput(accumulateInput)
      const { value: decoded } = decodeAccumulateInput(encoded)

      expect(decoded).toEqual(accumulateInput)
    })

    it('should handle deferred transfer with large values', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 0xffffffffn,
        destination: 0xffffffffn,
        amount: 0xffffffffffffffffn,
        memo: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        gas: 0xffffffffffffffffn,
      }

      const accumulateInput: AccumulateInput = {
        type: 'deferred',
        value: deferredTransfer,
      }

      const encoded = encodeAccumulateInput(accumulateInput)
      const { value: decoded } = decodeAccumulateInput(encoded)

      expect(decoded).toEqual(accumulateInput)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper accumulate input formula for operand tuple', () => {
      // Test the formula: encode{0, encode[U]{o}} for operand tuple
      const operandTuple: OperandTuple = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        segmentRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        authorizer:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        payloadHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        gasLimit: 1000000n,
        result: new Uint8Array([1, 2, 3, 4, 5]),
        authTrace: new Uint8Array([6, 7, 8, 9, 10]),
      }

      const accumulateInput: AccumulateInput = {
        type: 'operand',
        value: operandTuple,
      }

      const encoded = encodeAccumulateInput(accumulateInput)

      // Verify discriminator
      expect(encoded[0]).toBe(0)

      // Verify the structure by decoding
      const { value: decoded } = decodeAccumulateInput(encoded)
      expect(decoded).toEqual(accumulateInput)
    })

    it('should follow Gray Paper accumulate input formula for deferred transfer', () => {
      // Test the formula: encode{1, encode[X]{o}} for deferred transfer
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array([1, 2, 3, 4, 5]),
        gas: 50000n,
      }

      const accumulateInput: AccumulateInput = {
        type: 'deferred',
        value: deferredTransfer,
      }

      const encoded = encodeAccumulateInput(accumulateInput)

      // Verify discriminator
      expect(encoded[0]).toBe(1)

      // Verify the structure by decoding
      const { value: decoded } = decodeAccumulateInput(encoded)
      expect(decoded).toEqual(accumulateInput)
    })

    it('should handle all work error types in operand tuples', () => {
      const errorTypes = [
        WorkError.INFINITY,
        WorkError.PANIC,
        WorkError.BAD_EXPORTS,
        WorkError.OVERSIZE,
        WorkError.BAD,
        WorkError.BIG,
      ]

      for (const errorType of errorTypes) {
        const operandTuple: OperandTuple = {
          packageHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          segmentRoot:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          authorizer:
            '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          payloadHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          gasLimit: 1000000n,
          result: errorType,
          authTrace: new Uint8Array([6, 7, 8, 9, 10]),
        }

        const accumulateInput: AccumulateInput = {
          type: 'operand',
          value: operandTuple,
        }

        const encoded = encodeAccumulateInput(accumulateInput)
        const { value: decoded } = decodeAccumulateInput(encoded)

        expect(decoded.type).toBe('operand')
        expect((decoded.value as OperandTuple).result).toBe(errorType)
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve accumulate inputs through encode/decode cycle', () => {
      const testCases: AccumulateInput[] = [
        {
          type: 'operand',
          value: {
            packageHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            segmentRoot:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            authorizer:
              '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            payloadHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            gasLimit: 1000000n,
            result: new Uint8Array([1, 2, 3, 4, 5]),
            authTrace: new Uint8Array([6, 7, 8, 9, 10]),
          },
        },
        {
          type: 'deferred',
          value: {
            source: 1234n,
            destination: 5678n,
            amount: 1000000n,
            memo: new Uint8Array([1, 2, 3, 4, 5]),
            gas: 50000n,
          },
        },
        {
          type: 'operand',
          value: {
            packageHash:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            segmentRoot:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            authorizer:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            payloadHash:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            gasLimit: 0xffffffffffffffffn,
            result: WorkError.PANIC,
            authTrace: new Uint8Array(0),
          },
        },
        {
          type: 'deferred',
          value: {
            source: 0xffffffffn,
            destination: 0xffffffffn,
            amount: 0xffffffffffffffffn,
            memo: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
            gas: 0xffffffffffffffffn,
          },
        },
      ]

      for (const accumulateInput of testCases) {
        const encoded = encodeAccumulateInput(accumulateInput)
        const { value: decoded } = decodeAccumulateInput(encoded)

        expect(decoded).toEqual(accumulateInput)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array(0) // Empty data
      expect(() => decodeAccumulateInput(shortData)).toThrow(
        'Insufficient data',
      )
    })

    it('should handle invalid discriminator', () => {
      const invalidData = new Uint8Array([2, 1, 2, 3, 4, 5]) // Invalid discriminator 2
      expect(() => decodeAccumulateInput(invalidData)).toThrow(
        'Invalid accumulate input discriminator: 2',
      )
    })

    it('should handle operand tuple with empty auth trace', () => {
      const operandTuple: OperandTuple = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        segmentRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        authorizer:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        payloadHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        gasLimit: 1000000n,
        result: new Uint8Array([1, 2, 3, 4, 5]),
        authTrace: new Uint8Array(0),
      }

      const accumulateInput: AccumulateInput = {
        type: 'operand',
        value: operandTuple,
      }

      const encoded = encodeAccumulateInput(accumulateInput)
      const { value: decoded } = decodeAccumulateInput(encoded)

      expect(decoded).toEqual(accumulateInput)
    })

    it('should handle deferred transfer with empty memo', () => {
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: new Uint8Array(0),
        gas: 50000n,
      }

      const accumulateInput: AccumulateInput = {
        type: 'deferred',
        value: deferredTransfer,
      }

      const encoded = encodeAccumulateInput(accumulateInput)
      const { value: decoded } = decodeAccumulateInput(encoded)

      expect(decoded).toEqual(accumulateInput)
    })

    it('should handle operand tuple with large auth trace', () => {
      const largeAuthTrace = new Uint8Array(1000).fill(1)
      const operandTuple: OperandTuple = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        segmentRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        authorizer:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        payloadHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        gasLimit: 1000000n,
        result: new Uint8Array([1, 2, 3, 4, 5]),
        authTrace: largeAuthTrace,
      }

      const accumulateInput: AccumulateInput = {
        type: 'operand',
        value: operandTuple,
      }

      const encoded = encodeAccumulateInput(accumulateInput)
      const { value: decoded } = decodeAccumulateInput(encoded)

      expect(decoded).toEqual(accumulateInput)
    })

    it('should handle deferred transfer with large memo', () => {
      const largeMemo = new Uint8Array(1000).fill(1)
      const deferredTransfer: DeferredTransfer = {
        source: 1234n,
        destination: 5678n,
        amount: 1000000n,
        memo: largeMemo,
        gas: 50000n,
      }

      const accumulateInput: AccumulateInput = {
        type: 'deferred',
        value: deferredTransfer,
      }

      const encoded = encodeAccumulateInput(accumulateInput)
      const { value: decoded } = decodeAccumulateInput(encoded)

      expect(decoded).toEqual(accumulateInput)
    })
  })
})
