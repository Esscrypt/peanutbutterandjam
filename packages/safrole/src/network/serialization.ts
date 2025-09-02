/**
 * Safrole Network Message Serialization
 *
 * Implements Gray Paper-compliant message passing according to serialization.tex
 * Reference: graypaper/text/serialization.tex
 */

import type { Safe } from '@pbnj/core'
import { logger, safeError, safeResult } from '@pbnj/core'
import {
  decodeNatural,
  encodeNatural,
  encodeUint8Array,
} from '@pbnj/serialization'
import { MessageType, type NetworkMessage, type Sequence } from '@pbnj/types'

/**
 * Encode network message for transmission using Gray Paper serialization
 *
 * Gray Paper compliant encoding:
 * - Natural number encoding for lengths and type discriminators
 * - Sequence encoding for concatenating message components
 * - Variable-length encoding with discriminators
 */
export function encodeMessage(message: NetworkMessage): Safe<Uint8Array> {
  const encoder = new TextEncoder()

  // Encode components using Gray Paper natural number encoding
  const idBytes = encoder.encode(message.id)
  const [error, idLength] = encodeNatural(BigInt(idBytes.length))
  if (error) {
    return safeError(error)
  }
  const [error2, messageType] = encodeNatural(BigInt(message.type))
  if (error2) {
    return safeError(error2)
  }
  const [error3, payloadLength] = encodeNatural(BigInt(message.payload.length))
  if (error3) {
    return safeError(error3)
  }
  const [error4, timestamp] = encodeNatural(BigInt(message.timestamp))
  if (error4) {
    return safeError(error4)
  }

  // Handle optional signature with discriminator (Gray Paper §D.1)
  const [error5, hasSignature] = message.signature
    ? encodeNatural(1n)
    : encodeNatural(0n)
  if (error5) {
    return safeError(error5)
  }

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

  return encodeUint8Array(components as Sequence<Uint8Array>)
}

/**
 * Decode network message from transmission using Gray Paper serialization
 */
export function decodeMessage(data: Uint8Array): Safe<NetworkMessage> {
  const decoder = new TextDecoder()
  let remaining = data

  // Decode components in the same order as encoding using Gray Paper natural number decoding
  const [error, result] = decodeNatural(remaining)
  if (error) {
    return safeError(error)
  }
  const idLength = result.value
  const afterIdLength = result.remaining
  remaining = afterIdLength

  // Extract ID bytes
  const idBytes = remaining.slice(0, Number(idLength))
  remaining = remaining.slice(Number(idLength))
  const id = decoder.decode(idBytes)

  // Decode message type
  const [error2, result2] = decodeNatural(remaining)
  if (error2) {
    return safeError(error2)
  }
  const messageType = result2.value
  const afterMessageType = result2.remaining
  remaining = afterMessageType

  // Decode payload length
  const [error3, result3] = decodeNatural(remaining)
  if (error3) {
    return safeError(error3)
  }
  const payloadLength = result3.value
  const afterPayloadLength = result3.remaining
  remaining = afterPayloadLength

  // Extract payload
  const payload = remaining.slice(0, Number(payloadLength))
  remaining = remaining.slice(Number(payloadLength))

  // Decode timestamp
  const [error5, result5] = decodeNatural(remaining)
  if (error5) {
    return safeError(error5)
  }
  const timestamp = result5.value
  const afterTimestamp = result5.remaining
  remaining = afterTimestamp

  // Decode signature discriminator
  const [error6, result6] = decodeNatural(remaining)
  if (error6) {
    return safeError(error6)
  }
  const hasSignature = result6.value
  const afterSignature = result6.remaining
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

  return safeResult(message)
}

/**
 * Serialize message payload using Gray Paper natural number encoding for length
 */
export function serializePayload(data: unknown): Safe<Uint8Array> {
  const encoder = new TextEncoder()
  const serialized = encoder.encode(JSON.stringify(data))

  // Use Gray Paper natural number encoding for length prefix
  const [error, length] = encodeNatural(BigInt(serialized.length))
  if (error) {
    return safeError(error)
  }
  const result = new Uint8Array(Number(length) + serialized.length)
  result.set(length, 0)
  result.set(serialized, Number(length))

  return safeResult(result)
}

/**
 * Deserialize message payload using Gray Paper natural number decoding for length
 */
export function deserializePayload(payload: Uint8Array): Safe<unknown> {
  // Decode length using Gray Paper natural number decoding
  const [error, result] = decodeNatural(payload)
  if (error) {
    return safeError(error)
  }

  if (result.remaining.length < Number(result.value)) {
    return safeError(new Error('Insufficient payload data'))
  }

  const decoder = new TextDecoder()
  const payloadStr = decoder.decode(
    result.remaining.slice(0, Number(result.value)),
  )
  const deserialized = JSON.parse(payloadStr)

  logger.debug('Deserialized message payload', {
    payloadSize: payload.length,
    dataType: typeof deserialized,
  })

  return safeResult(deserialized)
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
