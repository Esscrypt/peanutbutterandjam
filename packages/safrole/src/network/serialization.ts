/**
 * Safrole Network Message Serialization
 *
 * Implements basic message passing according to Gray Paper
 * Reference: graypaper/text/serialization.tex
 */

import { logger } from '@pbnj/core'
import { decodeNatural, encodeNatural } from '@pbnj/serialization'
import type { NetworkMessage } from './types'
import { MessageType } from './types'

/**
 * Encode network message for transmission
 * Follows Gray Paper serialization principles
 */
export function encodeMessage(message: NetworkMessage): Uint8Array {
  try {
    // Message header using Gray Paper natural number encoding
    const idLength = encodeNatural(BigInt(message.id.length))
    const messageType = encodeNatural(BigInt(message.type))
    const payloadLength = encodeNatural(BigInt(message.payload.length))
    const hasSignature = message.signature
      ? encodeNatural(1n)
      : encodeNatural(0n)

    // Message body
    const encoder = new TextEncoder()
    const idUint8Array = encoder.encode(message.id)
    const signatureUint8Array = message.signature
      ? encoder.encode(message.signature)
      : new Uint8Array(0)

    // Concatenate all parts manually (following Gray Paper sequence principles)
    const totalLength =
      idLength.length +
      messageType.length +
      payloadLength.length +
      hasSignature.length +
      idUint8Array.length +
      message.payload.length +
      signatureUint8Array.length

    const body = new Uint8Array(totalLength)
    let offset = 0

    // Add each part sequentially
    body.set(idLength, offset)
    offset += idLength.length

    body.set(messageType, offset)
    offset += messageType.length

    body.set(payloadLength, offset)
    offset += payloadLength.length

    body.set(hasSignature, offset)
    offset += hasSignature.length

    body.set(idUint8Array, offset)
    offset += idUint8Array.length

    body.set(message.payload, offset)
    offset += message.payload.length

    body.set(signatureUint8Array, offset)

    logger.debug('Encoded network message', {
      messageId: message.id,
      messageType: MessageType[message.type],
      payloadSize: message.payload.length,
      totalSize: body.length,
      hasSignature: !!message.signature,
    })

    return body
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
 * Decode network message from transmission
 */
export function decodeMessage(data: Uint8Array): NetworkMessage {
  try {
    const decoder = new TextDecoder()

    // Decode header using Gray Paper natural number decoding
    const { value: idLength, remaining: data1 } = decodeNatural(data)
    const { value: messageType, remaining: data2 } = decodeNatural(data1)
    const { value: payloadLength, remaining: data3 } = decodeNatural(data2)
    const { value: hasSignature, remaining: data4 } = decodeNatural(data3)

    // Extract components
    const idUint8Array = data4.slice(0, Number(idLength))
    const payload = data4.slice(
      Number(idLength),
      Number(idLength) + Number(payloadLength),
    )
    const signatureUint8Array =
      hasSignature === 1n
        ? data4.slice(Number(idLength) + Number(payloadLength))
        : new Uint8Array(0)

    const id = decoder.decode(idUint8Array)
    const signature =
      hasSignature === 1n ? decoder.decode(signatureUint8Array) : undefined

    const message: NetworkMessage = {
      id,
      type: Number(messageType) as MessageType,
      payload,
      timestamp: Date.now(),
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
    // Check required fields
    if (
      !message.id ||
      !message.type ||
      !message.payload ||
      !message.timestamp
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

    // Check message ID format
    if (message.id.length === 0 || message.id.length > 256) {
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
 * Create a simple message for testing
 */
export function createTestMessage(
  type: MessageType,
  payload: unknown,
): NetworkMessage {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    payload: serializePayload(payload),
    timestamp: Date.now(),
  }
}
