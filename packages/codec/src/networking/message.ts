/**
 * JAMNP-S Networking Message Codec
 *
 * Implements JAMNP-S message encoding/decoding according to the specification.
 *
 * JAMNP-S Message Format:
 * [4-byte size buffer (little-endian)][kind byte][message content]
 *
 * The size includes both the kind byte and message content.
 * Size is encoded as a 32-bit unsigned integer in little-endian format.
 *
 * Reference: JIP-3 and JAMNP-S specification
 */

import type { DecodingResult, Safe, StreamKind } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'

/**
 * Encoded networking message structure
 */
export interface EncodedNetworkingMessage {
  /** Complete encoded message including size prefix */
  encoded: Uint8Array
  /** Size of the message (kind byte + content) */
  messageSize: number
}

/**
 * Decoded networking message structure
 */
export interface DecodedNetworkingMessage {
  /** Protocol kind byte (StreamKind) */
  kindByte: StreamKind
  /** Message content (without kind byte) */
  messageContent: Uint8Array
  /** Remaining data after parsing this message */
  remaining: Uint8Array
  /** Total bytes consumed (size prefix + kind byte + content) */
  consumed: number
}

/**
 * Encode a networking message according to JAMNP-S specification
 *
 * Format: [4-byte size (little-endian)][kind byte][message content]
 *
 * @param kindByte - Protocol identifier (StreamKind)
 * @param messageContent - Message payload (without kind byte)
 * @returns Encoded message with size prefix
 */
export function encodeNetworkingMessage(
  kindByte: StreamKind,
  messageContent: Uint8Array,
): Safe<EncodedNetworkingMessage> {
  // Create message with kind byte: [kind byte][message content]
  const messageWithKind = new Uint8Array(1 + messageContent.length)
  messageWithKind[0] = kindByte
  messageWithKind.set(messageContent, 1)

  // Encode size as 4-byte little-endian (32-bit unsigned integer)
  const [sizeEncodeError, encodedSize] = encodeFixedLength(
    BigInt(messageWithKind.length),
    4n,
  )
  if (sizeEncodeError) {
    return safeError(
      new Error(`Failed to encode message size: ${sizeEncodeError.message}`),
    )
  }

  // Combine: [size][kind byte][message content]
  const encoded = new Uint8Array(encodedSize.length + messageWithKind.length)
  encoded.set(encodedSize, 0)
  encoded.set(messageWithKind, encodedSize.length)

  return safeResult({
    encoded,
    messageSize: messageWithKind.length,
  })
}

/**
 * Decode a networking message according to JAMNP-S specification
 *
 * Format: [4-byte size (little-endian)][kind byte][message content]
 *
 * @param data - Raw octet sequence to decode
 * @returns Decoded message with kind byte and content
 */
export function decodeNetworkingMessage(
  data: Uint8Array,
): Safe<DecodingResult<DecodedNetworkingMessage>> {
  // Minimum size: 4 bytes (size) + 1 byte (kind byte) = 5 bytes
  if (data.length < 5) {
    return safeError(
      new Error(
        `Insufficient data for JAMNP-S message (need at least 5 bytes, got ${data.length})`,
      ),
    )
  }

  // Decode size (first 4 bytes, little-endian)
  const [sizeDecodeError, sizeResult] = decodeFixedLength(data, 4n)
  if (sizeDecodeError) {
    return safeError(
      new Error(`Failed to decode message size: ${sizeDecodeError.message}`),
    )
  }

  const messageSize = Number(sizeResult.value)
  const remainingAfterSize = sizeResult.remaining

  // Validate message size is reasonable (not negative, not too large)
  if (messageSize < 1) {
    return safeError(
      new Error(`Invalid message size: ${messageSize} (must be at least 1)`),
    )
  }

  // Check if we have enough data for the complete message
  if (remainingAfterSize.length < messageSize) {
    return safeError(
      new Error(
        `Insufficient data for message content (need ${messageSize} bytes, got ${remainingAfterSize.length})`,
      ),
    )
  }

  // Extract message content (includes kind byte)
  const messageWithKind = remainingAfterSize.slice(0, messageSize)

  // Extract kind byte (first byte of message content)
  const kindByte = messageWithKind[0] as StreamKind

  // Extract actual message content (remaining bytes after kind byte)
  const messageContent = messageWithKind.slice(1)

  // Calculate remaining data after this message
  const remaining = remainingAfterSize.slice(messageSize)

  // Calculate total bytes consumed: 4 (size) + messageSize
  const consumed = 4 + messageSize

  return safeResult({
    value: {
      kindByte,
      messageContent,
      remaining,
      consumed,
    },
    remaining,
    consumed,
  })
}
