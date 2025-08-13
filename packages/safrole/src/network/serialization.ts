/**
 * Safrole Network Message Serialization
 *
 * Implements Gray Paper-compliant message passing according to serialization.tex
 * Reference: graypaper/text/serialization.tex
 */

import { logger } from '@pbnj/core'
import {
  decodeNatural,
  encodeNatural,
  encodeUint8Array,
} from '@pbnj/serialization'
import { MessageType, type NetworkMessage } from '@pbnj/types'

/**
 * Encode network message for transmission using Gray Paper serialization
 *
 * Gray Paper compliant encoding:
 * - Natural number encoding for lengths and type discriminators
 * - Sequence encoding for concatenating message components
 * - Variable-length encoding with discriminators
 */
export function encodeMessage(message: NetworkMessage): Uint8Array {
  try {
    const encoder = new TextEncoder()

    // Encode components using Gray Paper natural number encoding
    const idBytes = encoder.encode(message.id)
    const idLength = encodeNatural(BigInt(idBytes.length))
    const messageType = encodeNatural(BigInt(message.type))
    const payloadLength = encodeNatural(BigInt(message.payload.length))
    const timestamp = encodeNatural(BigInt(message.timestamp))

    // Handle optional signature with discriminator (Gray Paper §D.1)
    const hasSignature = message.signature
      ? encodeNatural(1n)
      : encodeNatural(0n)
    const signatureBytes = message.signature || new Uint8Array(0)

    // Use Gray Paper sequence encoding to concatenate components
    const components = [
      idLength,
      idBytes,
      messageType,
      payloadLength,
      message.payload,
      timestamp,
      hasSignature,
      signatureBytes,
    ]

    const encoded = encodeUint8Array(components)

    logger.debug('Encoded network message', {
      messageId: message.id,
      messageType: MessageType[message.type],
      payloadSize: message.payload.length,
      totalSize: encoded.length,
      hasSignature: !!message.signature,
    })

    return encoded
  } catch (error) {
    logger.error('Failed to encode network message', {
      error: error instanceof Error ? error.message : String(error),
      messageId: message.id,
      messageType: MessageType[message.type],
    })
    throw error
  }
}

/**
 * Decode network message from transmission using Gray Paper serialization
 */
export function decodeMessage(data: Uint8Array): NetworkMessage {
  try {
    const decoder = new TextDecoder()
    let remaining = data

    // Decode components in the same order as encoding using Gray Paper natural number decoding
    const { value: idLength, remaining: afterIdLength } =
      decodeNatural(remaining)
    remaining = afterIdLength

    // Extract ID bytes
    const idBytes = remaining.slice(0, Number(idLength))
    remaining = remaining.slice(Number(idLength))
    const id = decoder.decode(idBytes)

    // Decode message type
    const { value: messageType, remaining: afterMessageType } =
      decodeNatural(remaining)
    remaining = afterMessageType

    // Decode payload length
    const { value: payloadLength, remaining: afterPayloadLength } =
      decodeNatural(remaining)
    remaining = afterPayloadLength

    // Extract payload
    const payload = remaining.slice(0, Number(payloadLength))
    remaining = remaining.slice(Number(payloadLength))

    // Decode timestamp
    const { value: timestamp, remaining: afterTimestamp } =
      decodeNatural(remaining)
    remaining = afterTimestamp

    // Decode signature discriminator
    const { value: hasSignature, remaining: afterSignature } =
      decodeNatural(remaining)
    remaining = afterSignature

    // Extract signature if present
    const signature = hasSignature === 1n ? remaining : undefined

    const message: NetworkMessage = {
      id,
      type: Number(messageType) as MessageType,
      payload,
      timestamp: Number(timestamp),
      signature,
    }

    logger.debug('Decoded network message', {
      messageId: message.id,
      messageType: MessageType[message.type],
      payloadSize: message.payload.length,
      hasSignature: !!message.signature,
    })

    return message
  } catch (error) {
    logger.error('Failed to decode network message', {
      error: error instanceof Error ? error.message : String(error),
      dataLength: data.length,
    })
    throw error
  }
}

/**
 * Serialize message payload using Gray Paper natural number encoding for length
 */
export function serializePayload(data: unknown): Uint8Array {
  try {
    const encoder = new TextEncoder()
    const serialized = encoder.encode(JSON.stringify(data))

    // Use Gray Paper natural number encoding for length prefix
    const length = encodeNatural(BigInt(serialized.length))
    const result = new Uint8Array(length.length + serialized.length)
    result.set(length, 0)
    result.set(serialized, length.length)

    logger.debug('Serialized message payload', {
      payloadSize: result.length,
      dataType: typeof data,
    })

    return result
  } catch (error) {
    logger.error('Failed to serialize payload', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Deserialize message payload using Gray Paper natural number decoding for length
 */
export function deserializePayload(payload: Uint8Array): unknown {
  try {
    // Decode length using Gray Paper natural number decoding
    const { value: length, remaining } = decodeNatural(payload)

    if (remaining.length < Number(length)) {
      throw new Error('Insufficient payload data')
    }

    const decoder = new TextDecoder()
    const payloadStr = decoder.decode(remaining.slice(0, Number(length)))
    const deserialized = JSON.parse(payloadStr)

    logger.debug('Deserialized message payload', {
      payloadSize: payload.length,
      dataType: typeof deserialized,
    })

    return deserialized
  } catch (error) {
    logger.error('Failed to deserialize payload', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Validate message format according to Gray Paper requirements
 */
export function validateMessageFormat(message: NetworkMessage): boolean {
  try {
    // Check required fields exist
    if (
      typeof message.id !== 'string' ||
      typeof message.type !== 'number' ||
      !(message.payload instanceof Uint8Array) ||
      typeof message.timestamp !== 'number'
    ) {
      return false
    }

    // Check message type is valid
    if (!Object.values(MessageType).includes(message.type)) {
      return false
    }

    // Check timestamp is reasonable (within 5 minutes)
    const now = Date.now()
    const timeDiff = Math.abs(now - message.timestamp)
    if (timeDiff > 300000) {
      // 5 minutes
      return false
    }

    // Check payload size is reasonable (max 10MB)
    if (message.payload.length > 10 * 1024 * 1024) {
      return false
    }

    // Check message ID format (according to Gray Paper natural number length constraints)
    if (message.id.length === 0 || message.id.length > 256) {
      return false
    }

    // Check signature type if present
    if (message.signature && !(message.signature instanceof Uint8Array)) {
      return false
    }

    return true
  } catch (error) {
    logger.error('Message format validation failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * Create a test message for unit testing
 */
export function createTestMessage(
  id: string,
  type: MessageType,
  payload: Uint8Array,
  signature?: Uint8Array,
): NetworkMessage {
  return {
    id,
    type,
    payload,
    timestamp: Date.now(),
    signature,
  }
}
