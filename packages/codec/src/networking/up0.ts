/**
 * UP0 Block Announcement Protocol Codec
 *
 * Implements encoding/decoding for UP0 block announcement protocol messages.
 *
 * Format specifications:
 * - Final = Header Hash ++ Slot
 * - Leaf = Header Hash ++ Slot
 * - Handshake = Final ++ len++[Leaf]
 * - Announcement = Header ++ Final
 *
 * Where:
 * - Header Hash = [u8; 32]
 * - Slot = u32 (4 bytes, little-endian)
 * - len++[Leaf] = variable-length sequence with natural number length prefix
 * - Header = As in Gray Paper (encoded using encodeHeader/decodeHeader)
 */

import type { DecodingResult, Safe } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import {
  decodeVariableSequence,
  encodeVariableSequence,
} from '../core/sequence'

/**
 * Final block structure (Header Hash + Slot)
 */
export interface Final {
  /** Header hash (32 bytes) */
  headerHash: Uint8Array
  /** Slot (u32) */
  slot: bigint
}

/**
 * Leaf structure (Header Hash + Slot) - same as Final
 */
export interface Leaf {
  /** Header hash (32 bytes) */
  headerHash: Uint8Array
  /** Slot (u32) */
  slot: bigint
}

/**
 * Handshake structure
 */
export interface Handshake {
  /** Final block */
  final: Final
  /** Array of leaves */
  leaves: Leaf[]
}

/**
 * Encode Final (Header Hash ++ Slot)
 *
 * @param final - Final block structure
 * @returns Encoded octet sequence
 */
export function encodeFinal(final: Final): Safe<Uint8Array> {
  // Validate header hash is 32 bytes
  if (final.headerHash.length !== 32) {
    return safeError(
      new Error(
        `Invalid header hash length: expected 32 bytes, got ${final.headerHash.length}`,
      ),
    )
  }

  // Encode slot as u32 (4 bytes, little-endian)
  const [slotError, encodedSlot] = encodeFixedLength(final.slot, 4n)
  if (slotError) {
    return safeError(slotError)
  }

  // Combine: [headerHash (32 bytes)][slot (4 bytes)]
  const encoded = new Uint8Array(32 + 4)
  encoded.set(final.headerHash, 0)
  encoded.set(encodedSlot, 32)

  return safeResult(encoded)
}

/**
 * Decode Final (Header Hash ++ Slot)
 *
 * @param data - Octet sequence to decode
 * @returns Decoded Final and remaining data
 */
export function decodeFinal(data: Uint8Array): Safe<DecodingResult<Final>> {
  // Need at least 36 bytes (32 hash + 4 slot)
  if (data.length < 36) {
    return safeError(
      new Error(
        `Insufficient data for Final (need 36 bytes, got ${data.length})`,
      ),
    )
  }

  // Extract header hash (first 32 bytes)
  const headerHash = data.slice(0, 32)

  // Decode slot (bytes 32-35, u32, little-endian)
  const slotData = data.slice(32, 36)
  const [slotError, slotResult] = decodeFixedLength(slotData, 4n)
  if (slotError) {
    return safeError(slotError)
  }

  const remaining = data.slice(36)

  return safeResult({
    value: {
      headerHash,
      slot: slotResult.value,
    },
    remaining,
    consumed: 36,
  })
}

/**
 * Encode Leaf (Header Hash ++ Slot) - same as Final
 *
 * @param leaf - Leaf structure
 * @returns Encoded octet sequence
 */
export function encodeLeaf(leaf: Leaf): Safe<Uint8Array> {
  return encodeFinal({ headerHash: leaf.headerHash, slot: leaf.slot })
}

/**
 * Decode Leaf (Header Hash ++ Slot) - same as Final
 *
 * @param data - Octet sequence to decode
 * @returns Decoded Leaf and remaining data
 */
export function decodeLeaf(data: Uint8Array): Safe<DecodingResult<Leaf>> {
  const [error, result] = decodeFinal(data)
  if (error) {
    return safeError(error)
  }

  return safeResult({
    value: {
      headerHash: result.value.headerHash,
      slot: result.value.slot,
    },
    remaining: result.remaining,
    consumed: result.consumed,
  })
}

/**
 * Encode Handshake (Final ++ len++[Leaf])
 *
 * @param handshake - Handshake structure
 * @returns Encoded octet sequence
 */
export function encodeHandshake(handshake: Handshake): Safe<Uint8Array> {
  // Encode Final
  const [finalError, encodedFinal] = encodeFinal(handshake.final)
  if (finalError) {
    return safeError(finalError)
  }

  // Encode leaves as variable-length sequence
  const [leavesError, encodedLeaves] = encodeVariableSequence(
    handshake.leaves,
    encodeLeaf,
  )
  if (leavesError) {
    return safeError(leavesError)
  }

  // Combine: [Final][len++[Leaf]]
  const encoded = new Uint8Array(encodedFinal.length + encodedLeaves.length)
  encoded.set(encodedFinal, 0)
  encoded.set(encodedLeaves, encodedFinal.length)

  return safeResult(encoded)
}

/**
 * Decode Handshake (Final ++ len++[Leaf])
 *
 * @param data - Octet sequence to decode
 * @returns Decoded Handshake and remaining data
 */
export function decodeHandshake(
  data: Uint8Array,
): Safe<DecodingResult<Handshake>> {
  // Decode Final
  const [finalError, finalResult] = decodeFinal(data)
  if (finalError) {
    return safeError(finalError)
  }

  // Decode leaves as variable-length sequence
  const [leavesError, leavesResult] = decodeVariableSequence(
    finalResult.remaining,
    decodeLeaf,
  )
  if (leavesError) {
    return safeError(leavesError)
  }

  const consumed = finalResult.consumed + leavesResult.consumed

  return safeResult({
    value: {
      final: finalResult.value,
      leaves: leavesResult.value,
    },
    remaining: leavesResult.remaining,
    consumed,
  })
}

/**
 * Encode Announcement (Header ++ Final)
 *
 * Note: Header encoding is handled separately using encodeHeader from block/header.ts
 * This function only encodes the Final part.
 *
 * @param final - Final block structure
 * @returns Encoded Final octet sequence
 */
export function encodeAnnouncementFinal(final: Final): Safe<Uint8Array> {
  return encodeFinal(final)
}

/**
 * Decode Announcement Final part (Header ++ Final)
 *
 * Note: Header decoding is handled separately using decodeHeader from block/header.ts
 * This function only decodes the Final part.
 *
 * @param data - Octet sequence to decode (should be the remaining data after header)
 * @returns Decoded Final and remaining data
 */
export function decodeAnnouncementFinal(
  data: Uint8Array,
): Safe<DecodingResult<Final>> {
  return decodeFinal(data)
}
