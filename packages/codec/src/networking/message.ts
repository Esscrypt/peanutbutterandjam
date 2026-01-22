/**
 * JAMNP-S Networking Message Codec
 *
 * Implements JAMNP-S message encoding/decoding according to the specification.
 *
 * JAMNP-S Message Format:
 * [1-byte kind][4-byte size buffer (little-endian)][message content]
 *
 * The kind byte comes first and sets the stream kind.
 * The size is for the message content ONLY (does NOT include the kind byte).
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
  /** Message content (without kind byte) */
  messageContent: Uint8Array
  /** Remaining data after parsing this message */
  remaining: Uint8Array
  /** Total bytes consumed (size prefix + kind byte + content) */
  consumed: number
}

export interface DecodedNetworkingMessageWithKind
  extends DecodedNetworkingMessage {
  /** Kind byte */
  kindByte: StreamKind
}

/**
 * Encode a networking message according to JAMNP-S specification
 *
 * Format: [1-byte kind][4-byte size (little-endian)][message content]
 * Note: Size is for message content ONLY, not including the kind byte.
 *
 * @param kindByte - Protocol identifier (StreamKind)
 * @param messageContent - Message payload (without kind byte)
 * @returns Encoded message with kind byte and size prefix
 */
export function encodeNetworkingMessage(
  kindByte: StreamKind,
  messageContent: Uint8Array,
): Safe<EncodedNetworkingMessage> {
  // Encode size as 4-byte little-endian (size is for message content ONLY)
  const [sizeEncodeError, encodedSize] = encodeFixedLength(
    BigInt(messageContent.length),
    4n,
  )
  if (sizeEncodeError) {
    return safeError(
      new Error(`Failed to encode message size: ${sizeEncodeError.message}`),
    )
  }

  // Combine: [kind byte][size][message content]
  const encoded = new Uint8Array(1 + 4 + messageContent.length)
  encoded[0] = kindByte // 1 byte: kind (first)
  encoded.set(encodedSize, 1) // 4 bytes: size
  encoded.set(messageContent, 5) // message content

  return safeResult({
    encoded,
    messageSize: messageContent.length, // Size of message content only
  })
}

/**
 * Decode a networking message according to JAMNP-S specification
 *
 * Format: [4-byte size (little-endian)][message content]
 * Note: Size is for message content ONLY, not including the kind byte.
 * The kind byte is provided separately.
 *
 * @param data - Raw octet sequence to decode (without kind byte)
 * @returns Decoded message with content
 */
export function decodeNetworkingMessage(
  data: Uint8Array,
): Safe<DecodingResult<DecodedNetworkingMessage>> {
  const [sizeDecodeError, sizeResult] = decodeFixedLength(data, 4n)
  if (sizeDecodeError) {
    return safeError(
      new Error(`Failed to decode message size: ${sizeDecodeError.message}`),
    )
  }

  const messageContentSize = Number(sizeResult.value)

  // Validate message size is reasonable (not negative)
  if (messageContentSize < 0) {
    return safeError(
      new Error(`Invalid message size: ${messageContentSize} (must be >= 0)`),
    )
  }

  // Check if we have enough data: 4 (size) + messageContentSize
  const totalBytesNeeded = 4 + messageContentSize
  if (data.length < totalBytesNeeded) {
    return safeError(
      new Error(
        `Insufficient data for message (need ${totalBytesNeeded} bytes, got ${data.length})`,
      ),
    )
  }

  // Extract message content (bytes after size)
  const messageContent = data.slice(4, 4 + messageContentSize)

  // Calculate remaining data after this message
  const remaining = data.slice(totalBytesNeeded)

  // Calculate total bytes consumed: 4 (size) + messageContentSize
  const consumed = totalBytesNeeded

  return safeResult({
    value: {
      messageContent,
      remaining,
      consumed,
    },
    remaining,
    consumed,
  })
}

/**
 * Decode a networking message with kind byte according to JAMNP-S specification
 *
 * Format: [1-byte kind][4-byte size (little-endian)][message content]
 * Note: Size is for message content ONLY, not including the kind byte.
 * The kind byte is parsed from the first byte of the data.
 *
 * @param data - Raw octet sequence to decode: [kind][size][content]
 * @returns Decoded message with kind byte and content
 */
export function decodeNetworkingMessageWithKind(
  data: Uint8Array,
): Safe<DecodingResult<DecodedNetworkingMessageWithKind>> {
  // Minimum size: 1 byte (kind) + 4 bytes (size) = 5 bytes
  if (data.length < 5) {
    return safeError(
      new Error(
        `Insufficient data for JAMNP-S message with kind (need at least 5 bytes, got ${data.length})`,
      ),
    )
  }

  // Extract kind byte (first byte)
  const kindByte = data[0] as StreamKind

  // Decode the rest of the message (size + content) starting from byte 1
  const messageData = data.slice(1)
  const [decodeError, decodeResult] = decodeNetworkingMessage(messageData)
  if (decodeError) {
    return safeError(decodeError)
  }

  // Calculate total bytes consumed: 1 (kind) + decodeResult.consumed
  const totalConsumed = 1 + decodeResult.consumed

  return safeResult({
    value: {
      kindByte,
      ...decodeResult.value,
      consumed: totalConsumed, // Update consumed to include kind byte
    },
    remaining: decodeResult.remaining,
    consumed: totalConsumed,
  })
}
