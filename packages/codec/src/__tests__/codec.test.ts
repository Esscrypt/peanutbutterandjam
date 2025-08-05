/**
 * Codec Tests
 *
 * Tests for the JAM protocol codec implementation
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  type Block,
  EncodingFormat,
  JAMCodec,
  type Transaction,
} from '../index'

beforeAll(() => {
  logger.init()
})

describe('JAM Codec', () => {
  const codec = new JAMCodec()

  describe('Basic Data Types', () => {
    it('should encode and decode strings', () => {
      const original = 'Hello, JAM Protocol!'
      const encoded = codec.encode(original, EncodingFormat.JSON)
      const decoded = codec.decode(encoded, EncodingFormat.JSON)

      expect(decoded).toBe(original)
    })

    it('should encode and decode numbers', () => {
      const original = 42
      const encoded = codec.encode(original, EncodingFormat.JSON)
      const decoded = codec.decode(encoded, EncodingFormat.JSON)

      expect(decoded).toBe(original)
    })

    it('should encode and decode booleans', () => {
      const original = true
      const encoded = codec.encode(original, EncodingFormat.JSON)
      const decoded = codec.decode(encoded, EncodingFormat.JSON)

      expect(decoded).toBe(original)
    })

    it('should encode and decode arrays', () => {
      const original = [1, 2, 3, 'test', true]
      const encoded = codec.encode(original, EncodingFormat.JSON)
      const decoded = codec.decode(encoded, EncodingFormat.JSON)

      expect(decoded).toEqual(original)
    })

    it('should encode and decode objects', () => {
      const original = { name: 'JAM', version: 1, active: true }
      const encoded = codec.encode(original, EncodingFormat.JSON)
      const decoded = codec.decode(encoded, EncodingFormat.JSON)

      expect(decoded).toEqual(original)
    })
  })

  describe('Encoding Formats', () => {
    const testData = { message: 'Hello JAM', number: 42, active: true }

    it('should encode and decode JSON format', () => {
      const encoded = codec.encode(testData, EncodingFormat.JSON)
      const decoded = codec.decode(encoded, EncodingFormat.JSON)

      expect(decoded).toEqual(testData)
    })

    it('should encode and decode binary format', () => {
      const encoded = codec.encode(testData, EncodingFormat.BINARY)
      const decoded = codec.decode(encoded, EncodingFormat.BINARY)

      expect(decoded).toEqual(testData)
    })

    it('should encode and decode ASN.1 format', () => {
      const encoded = codec.encode(testData, EncodingFormat.ASN1)
      const decoded = codec.decode(encoded, EncodingFormat.ASN1)

      expect(decoded).toEqual(testData)
    })
  })

  describe('Block Data', () => {
    const mockBlock: Block = {
      header: {
        number: 1,
        parentHash: '0x1234567890abcdef',
        timestamp: Date.now(),
        author: '0xabcdef1234567890',
        stateRoot: '0xabcdef1234567890',
        extrinsicsRoot: '0xabcdef1234567890',
        digest: ['0x1234567890abcdef'],
      },
      body: {
        extrinsics: [
          new Uint8Array([1, 2, 3, 4]),
          new Uint8Array([5, 6, 7, 8]),
        ],
      },
    }

    it('should encode and decode block data in JSON format', () => {
      const blockCodec = new JAMCodec<Block>()
      const encoded = blockCodec.encode(mockBlock, EncodingFormat.JSON)
      const decoded = blockCodec.decode(encoded, EncodingFormat.JSON)

      expect(decoded.header.number).toBe(mockBlock.header.number)
      expect(decoded.header.parentHash).toBe(mockBlock.header.parentHash)
      expect(decoded.body.extrinsics).toHaveLength(
        mockBlock.body.extrinsics.length,
      )
    })

    it('should encode and decode block data in binary format', () => {
      const blockCodec = new JAMCodec<Block>()
      const encoded = blockCodec.encode(mockBlock, EncodingFormat.BINARY)
      const decoded = blockCodec.decode(encoded, EncodingFormat.BINARY)

      expect(decoded.header.number).toBe(mockBlock.header.number)
      expect(decoded.header.parentHash).toBe(mockBlock.header.parentHash)
      expect(decoded.body.extrinsics).toHaveLength(
        mockBlock.body.extrinsics.length,
      )
    })
  })

  describe('Transaction Data', () => {
    const mockTransaction: Transaction = {
      hash: '0x1234567890abcdef',
      sender: '0xabcdef1234567890',
      recipient: '0xfedcba0987654321',
      amount: 1000000000000000000n,
      nonce: 1,
      signature: '0xabcdef1234567890',
      data: new Uint8Array([1, 2, 3, 4]),
    }

    it('should encode and decode transaction data in JSON format', () => {
      const transactionCodec = new JAMCodec<Transaction>()
      const encoded = transactionCodec.encode(
        mockTransaction,
        EncodingFormat.JSON,
      )
      const decoded = transactionCodec.decode(encoded, EncodingFormat.JSON)

      expect(decoded.hash).toBe(mockTransaction.hash)
      expect(decoded.sender).toBe(mockTransaction.sender)
      expect(decoded.amount).toBe(mockTransaction.amount)
      expect(decoded.nonce).toBe(mockTransaction.nonce)
    })

    it('should encode and decode transaction data in binary format', () => {
      const transactionCodec = new JAMCodec<Transaction>()
      const encoded = transactionCodec.encode(
        mockTransaction,
        EncodingFormat.BINARY,
      )
      const decoded = transactionCodec.decode(encoded, EncodingFormat.BINARY)

      expect(decoded.hash).toBe(mockTransaction.hash)
      expect(decoded.sender).toBe(mockTransaction.sender)
      expect(decoded.amount).toBe(mockTransaction.amount)
      expect(decoded.nonce).toBe(mockTransaction.nonce)
    })
  })

  describe('Validation', () => {
    it('should validate valid data', () => {
      const validData = { name: 'JAM', version: 1 }
      const validation = codec.validate(validData)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should reject null data', () => {
      const validation = codec.validate(null as unknown)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Data cannot be null or undefined')
    })

    it('should reject undefined data', () => {
      const validation = codec.validate(undefined as unknown)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Data cannot be null or undefined')
    })

    it('should warn about non-serializable values', () => {
      const dataWithFunction = {
        name: 'JAM',
        func: () => console.log('test'),
      }
      const validation = codec.validate(dataWithFunction)

      expect(validation.isValid).toBe(false)
      expect(
        validation.warnings.some((w) => w.includes('non-serializable')),
      ).toBe(true)
    })
  })

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const config = codec.getConfig()

      expect(config.defaultFormat).toBe(EncodingFormat.BINARY)
      expect(config.enableValidation).toBe(true)
      expect(config.maxDataSize).toBe(1024 * 1024 * 10) // 10MB
    })

    it('should update configuration', () => {
      const newConfig = {
        defaultFormat: EncodingFormat.JSON,
        enableValidation: false,
        maxDataSize: 1024 * 1024, // 1MB
      }

      codec.updateConfig(newConfig)
      const config = codec.getConfig()

      expect(config.defaultFormat).toBe(EncodingFormat.JSON)
      expect(config.enableValidation).toBe(false)
      expect(config.maxDataSize).toBe(1024 * 1024)
    })
  })

  describe('Error Handling', () => {
    it('should handle encoding errors gracefully', () => {
      const errorCodec = new JAMCodec()
      const invalidData = { func: () => {} }

      expect(() => {
        errorCodec.encode(invalidData, EncodingFormat.JSON)
      }).toThrow()
    })

    it('should handle decoding errors gracefully', () => {
      const invalidData = new Uint8Array([1, 2, 3, 4])

      expect(() => {
        codec.decode(invalidData, EncodingFormat.JSON)
      }).toThrow()
    })
  })
})
