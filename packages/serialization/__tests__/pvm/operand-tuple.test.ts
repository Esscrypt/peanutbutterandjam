import { describe, expect, it } from 'vitest'
import {
  decodeOperandTuple,
  encodeOperandTuple,
} from '../../src/pvm/operand-tuple'
import type { OperandTuple } from '../../src/types'
import { WorkError } from '../../src/types'

describe('Operand Tuple Serialization', () => {
  describe('Operand Tuple Encoding', () => {
    it('should encode operand tuple with blob result', () => {
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

      const encoded = encodeOperandTuple(operandTuple)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should encode operand tuple with error result', () => {
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

      const encoded = encodeOperandTuple(operandTuple)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle large gas limit', () => {
      const operandTuple: OperandTuple = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        segmentRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        authorizer:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        payloadHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        gasLimit: 0xffffffffffffffffn,
        result: new Uint8Array([1, 2, 3, 4, 5]),
        authTrace: new Uint8Array([6, 7, 8, 9, 10]),
      }

      const encoded = encodeOperandTuple(operandTuple)

      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle empty auth trace', () => {
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

      const encoded = encodeOperandTuple(operandTuple)

      expect(encoded.length).toBeGreaterThan(0)
    })
  })

  describe('Operand Tuple Decoding', () => {
    it('should decode operand tuple with blob result', () => {
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

      const encoded = encodeOperandTuple(operandTuple)
      const { value: decoded } = decodeOperandTuple(encoded)

      expect(decoded).toEqual(operandTuple)
    })

    it('should decode operand tuple with error result', () => {
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

      const encoded = encodeOperandTuple(operandTuple)
      const { value: decoded } = decodeOperandTuple(encoded)

      expect(decoded).toEqual(operandTuple)
    })

    it('should handle large gas limit', () => {
      const operandTuple: OperandTuple = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        segmentRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        authorizer:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        payloadHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        gasLimit: 0xffffffffffffffffn,
        result: new Uint8Array([1, 2, 3, 4, 5]),
        authTrace: new Uint8Array([6, 7, 8, 9, 10]),
      }

      const encoded = encodeOperandTuple(operandTuple)
      const { value: decoded } = decodeOperandTuple(encoded)

      expect(decoded).toEqual(operandTuple)
    })

    it('should handle empty auth trace', () => {
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

      const encoded = encodeOperandTuple(operandTuple)
      const { value: decoded } = decodeOperandTuple(encoded)

      expect(decoded).toEqual(operandTuple)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper operand tuple formula', () => {
      // Test the formula: encode[U](otX ∈ operandtuple) ≡ encode{otX_packagehash, otX_segroot, otX_authorizer, otX_payloadhash, otX_gaslimit, encoderesult(otX_result), var{otX_authtrace}}
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

      const encoded = encodeOperandTuple(operandTuple)

      // Verify the structure by decoding
      const { value: decoded } = decodeOperandTuple(encoded)
      expect(decoded).toEqual(operandTuple)
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

        const encoded = encodeOperandTuple(operandTuple)
        const { value: decoded } = decodeOperandTuple(encoded)

        expect(decoded.result).toBe(errorType)
      }
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve operand tuples through encode/decode cycle', () => {
      const testCases: OperandTuple[] = [
        {
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
        {
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
      ]

      for (const operandTuple of testCases) {
        const encoded = encodeOperandTuple(operandTuple)
        const { value: decoded } = decodeOperandTuple(encoded)

        expect(decoded).toEqual(operandTuple)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array(50) // Too short for complete operand tuple
      expect(() => decodeOperandTuple(shortData)).toThrow('Insufficient data')
    })

    it('should handle zero gas limit', () => {
      const operandTuple: OperandTuple = {
        packageHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        segmentRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        authorizer:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        payloadHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        gasLimit: 0n,
        result: new Uint8Array([1, 2, 3, 4, 5]),
        authTrace: new Uint8Array([6, 7, 8, 9, 10]),
      }

      const encoded = encodeOperandTuple(operandTuple)
      const { value: decoded } = decodeOperandTuple(encoded)

      expect(decoded).toEqual(operandTuple)
    })

    it('should handle large auth trace', () => {
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

      const encoded = encodeOperandTuple(operandTuple)
      const { value: decoded } = decodeOperandTuple(encoded)

      expect(decoded).toEqual(operandTuple)
    })
  })
})
