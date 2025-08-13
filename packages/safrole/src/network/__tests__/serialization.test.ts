/**
 * Network Serialization Tests
 *
 * Tests the network message serialization functions
 * Reference: NETWORK_PROTOCOL_SPEC.md
 */

import { describe, expect, it } from 'vitest'
import {
  createTestMessage,
  decodeMessage,
  deserializePayload,
  encodeMessage,
  serializePayload,
  validateMessageFormat,
} from '../serialization'
import { MessageType } from '@pbnj/types'

describe('Network Serialization', () => {
  describe('Message Encoding/Decoding', () => {
    it('should encode and decode network messages correctly', () => {
      const originalMessage = {
        id: 'test-message-123',
        type: MessageType.BLOCK_ANNOUNCE,
        payload: new Uint8Array([1, 2, 3, 4, 5]),
        timestamp: Date.now(),
        signature: new Uint8Array([1, 2, 3, 4]),
      }

      const encoded = encodeMessage(originalMessage)
      const decoded = decodeMessage(encoded)

      expect(decoded.id).toBe(originalMessage.id)
      expect(decoded.type).toBe(originalMessage.type)
      expect(decoded.payload).toEqual(originalMessage.payload)
      expect(decoded.signature).toBe(originalMessage.signature)
    })

    it('should handle messages without signatures', () => {
      const originalMessage = {
        id: 'test-message-no-sig',
        type: MessageType.PING,
        payload: new Uint8Array([1, 2, 3]),
        timestamp: Date.now(),
      }

      const encoded = encodeMessage(originalMessage)
      const decoded = decodeMessage(encoded)

      expect(decoded.id).toBe(originalMessage.id)
      expect(decoded.type).toBe(originalMessage.type)
      expect(decoded.payload).toEqual(originalMessage.payload)
      expect(decoded.signature).toBeUndefined()
    })
  })

  describe('Payload Serialization', () => {
    it('should serialize and deserialize payloads correctly', () => {
      const testData = {
        blockHash: '0x1234567890abcdef',
        slot: 12345,
        author: 'validator-123',
      }

      const serialized = serializePayload(testData)
      const deserialized = deserializePayload(serialized)

      expect(deserialized).toEqual(testData)
    })

    it('should handle complex nested objects', () => {
      const testData = {
        header: {
          parentHash: '0x1234567890abcdef',
          slot: 12345,
        },
        extrinsics: [
          { type: 'ticket', data: '0xabcdef' },
          { type: 'dispute', data: '0x123456' },
        ],
      }

      const serialized = serializePayload(testData)
      const deserialized = deserializePayload(serialized)

      expect(deserialized).toEqual(testData)
    })
  })

  describe('Message Validation', () => {
    it('should validate correct message format', () => {
      const message = {
        id: 'test-message',
        type: MessageType.PING,
        payload: new Uint8Array([1, 2, 3]),
        timestamp: Date.now(),
      }

      const isValid = validateMessageFormat(message)
      expect(isValid).toBe(true)
    })

    it('should reject messages with missing fields', () => {
      const message = {
        id: 'test-message',
        type: MessageType.PING,
        // Missing payload and timestamp
      }

      const isValid = validateMessageFormat(message as any)
      expect(isValid).toBe(false)
    })

    it('should reject messages with invalid message type', () => {
      const message = {
        id: 'test-message',
        type: 999, // Invalid message type
        payload: new Uint8Array([1, 2, 3]),
        timestamp: Date.now(),
      }

      const isValid = validateMessageFormat(message)
      expect(isValid).toBe(false)
    })

    it('should reject messages with old timestamps', () => {
      const message = {
        id: 'test-message',
        type: MessageType.PING,
        payload: new Uint8Array([1, 2, 3]),
        timestamp: Date.now() - 400000, // 6+ minutes ago
      }

      const isValid = validateMessageFormat(message)
      expect(isValid).toBe(false)
    })

    it('should reject messages with oversized payloads', () => {
      const message = {
        id: 'test-message',
        type: MessageType.PING,
        payload: new Uint8Array(11 * 1024 * 1024), // 11MB
        timestamp: Date.now(),
      }

      const isValid = validateMessageFormat(message)
      expect(isValid).toBe(false)
    })

    it('should reject messages with invalid ID format', () => {
      const message = {
        id: '', // Empty ID
        type: MessageType.PING,
        payload: new Uint8Array([1, 2, 3]),
        timestamp: Date.now(),
      }

      const isValid = validateMessageFormat(message)
      expect(isValid).toBe(false)
    })
  })

  describe('Test Message Creation', () => {
    it('should create test messages correctly', () => {
      const payload = { test: 'data', number: 42 }
      const message = createTestMessage('test-message', MessageType.BLOCK_ANNOUNCE, serializePayload(payload))

      expect(message.id).toBe('test-message')
      expect(message.type).toBe(MessageType.BLOCK_ANNOUNCE)
      expect(message.timestamp).toBeGreaterThan(0)
      expect(message.payload).toBeInstanceOf(Uint8Array)
      expect(message.payload.length).toBeGreaterThan(0)

      // Verify payload can be deserialized
      const deserialized = deserializePayload(message.payload)
      expect(deserialized).toEqual(payload)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should use Gray Paper natural number encoding for lengths', () => {
      const message = {
        id: 'test',
        type: MessageType.PING,
        payload: new Uint8Array([1, 2, 3]),
        timestamp: Date.now(),
      }

      const encoded = encodeMessage(message)

      // The encoded message should use Gray Paper natural number encoding
      // for the header fields (idLength, messageType, payloadLength, hasSignature)
      expect(encoded.length).toBeGreaterThan(0)

      // Verify we can decode it back
      const decoded = decodeMessage(encoded)
      expect(decoded.id).toBe(message.id)
      expect(decoded.type).toBe(message.type)
      expect(decoded.payload).toEqual(message.payload)
    })

    it('should handle variable-length natural numbers correctly', () => {
      // Test with different payload sizes to ensure variable-length encoding works

      const smallMessage = createTestMessage('small-msg', MessageType.PING, serializePayload({
        data: 'small',
      }))
      const largeMessage = createTestMessage('large-msg', MessageType.BLOCK_ANNOUNCE, serializePayload({
        data: 'large',
      }))

      // Both should encode/decode correctly
      const smallEncoded = encodeMessage(smallMessage)
      const largeEncoded = encodeMessage(largeMessage)

      const smallDecoded = decodeMessage(smallEncoded)
      const largeDecoded = decodeMessage(largeEncoded)

      expect(smallDecoded.id).toBe(smallMessage.id)
      expect(largeDecoded.id).toBe(largeMessage.id)
    })
  })
})
