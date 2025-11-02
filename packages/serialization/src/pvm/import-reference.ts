/**
 * Import reference serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 305-311):
 *
 * encodeImportRef(⟨h ∈ hash ∪ hash^⊞, i ∈ Nbits(15)⟩) ≡ {
 *   ⟨h, encode[2](i)⟩              when h ∈ hash
 *   ⟨r, encode[2](i + 2^15)⟩       when ∃r ∈ hash, h = r^⊞
 * }
 *
 * Import references specify segments of work package data to be imported
 * into the current work item execution context. The encoding distinguishes
 * between regular hashes and refined hashes (hash^⊞) using the index offset.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Import references allow work items to access data from other work items
 * or external sources. They use hash-based addressing for integrity.
 *
 * Import Reference structure:
 * - **Hash**: Either regular hash or refined hash (hash^⊞)
 * - **Index** (2 bytes): Segment index within the referenced data
 *
 * Encoding scheme:
 * - **Regular hash**: index stored as-is (0-32767)
 * - **Refined hash**: index + 2^15 (32768-65535) to distinguish type
 *
 * Key concepts:
 * - **Content addressing**: Data identified by cryptographic hash
 * - **Segmentation**: Large data split into indexed segments
 * - **Type distinction**: Regular vs refined hashes have different semantics
 * - **Import resolution**: PVM resolves hash to actual data during execution
 *
 * Example:
 * - Regular: hash=0xABC..., index=5 → encode as ⟨0xABC..., 0x0005⟩
 * - Refined: hash=0xDEF...^⊞, index=5 → encode as ⟨0xDEF..., 0x8005⟩
 *
 * This enables efficient data sharing between work items while maintaining
 * type safety and integrity through cryptographic commitments.
 */

import { bytesToHex, concatBytes, type Hex, hexToBytes } from '@pbnj/core'
import type { DecodingResult, ImportSegment, Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'

/**
 * Refined Import Segment - extends ImportSegment for complete Gray Paper compliance
 *
 * This interface captures the full semantics of Gray Paper import references,
 * including the distinction between regular and refined hashes.
 */
export interface RefinedImportSegment extends ImportSegment {
  /** Whether this is a refined hash (hash^⊞) or regular hash */
  isRefined?: boolean
}

/**
 * Encode import reference according to Gray Paper specification.
 *
 * Gray Paper Equation 305-311 (label: encodeImportRef):
 * encodeImportRef{⟨h ∈ hash ∪ hash^⊞, i ∈ Nbits(15)⟩} ≡ {
 *   ⟨h, encode[2]{i}⟩              when h ∈ hash
 *   ⟨r, encode[2]{i + 2^15}⟩       when ∃r ∈ hash, h = r^⊞
 * }
 *
 * Import references specify segments of work package data to be imported
 * into the current work item execution context. The encoding distinguishes
 * between regular hashes and refined hashes using index bit manipulation.
 *
 * Field encoding per Gray Paper:
 * 1. h: 32-byte hash (either regular hash or base of refined hash)
 * 2. encode[2]{index}: 2-byte fixed-length segment index with type encoding:
 *    - Regular hash: i (0-32767, bit 15 = 0)
 *    - Refined hash: i + 2^15 (32768-65535, bit 15 = 1)
 *
 * Type distinction semantics:
 * - Regular hash (h ∈ hash): Direct content reference
 * - Refined hash (h = r^⊞): Processed/refined content reference
 * - Index range: 0-32767 (15 bits) per type
 * - Bit 15 acts as type discriminator
 *
 * Import resolution process:
 * 1. Extract hash and check bit 15 of index
 * 2. If bit 15 = 0: regular hash lookup
 * 3. If bit 15 = 1: refined hash lookup (subtract 2^15 for real index)
 * 4. Resolve hash to data segment using PVM's import mechanism
 *
 * ✅ CORRECT: Uses 32-byte hash for content addressing
 * ✅ CORRECT: Uses encode[2] for 2-byte fixed-length index
 * ✅ CORRECT: Implements type discrimination via index bit manipulation
 * ✅ CORRECT: Supports both regular and refined hash types
 *
 * @param importRef - Import reference to encode
 * @returns Encoded octet sequence
 */
export function encodeImportReference(
  importRef: ImportSegment | RefinedImportSegment,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // h: 32-byte hash (either regular hash or base hash for refined)
  parts.push(hexToBytes(importRef.treeRoot))

  // encode[2]{index}: 2-byte fixed-length index with type encoding
  // Determine if this is a refined hash
  const isRefinedHash = 'isRefined' in importRef ? importRef.isRefined : false

  // Validate input index range (must fit in 15 bits per type)
  const inputIndex = Number(importRef.index)
  if (inputIndex < 0 || inputIndex > 32767) {
    return safeError(
      new Error(
        `Invalid import reference index: ${inputIndex}. Must be 0-32767 for each hash type`,
      ),
    )
  }

  // Apply Gray Paper type encoding based on hash type
  let encodedIndex: number
  if (isRefinedHash) {
    // Refined hash (h = r^⊞): encode as i + 2^15 (set bit 15)
    encodedIndex = inputIndex + 32768
  } else {
    // Regular hash (h ∈ hash): encode as i (bit 15 remains 0)
    encodedIndex = inputIndex
  }

  // Final validation: encoded index must fit in 16 bits
  if (encodedIndex < 0 || encodedIndex > 65535) {
    return safeError(
      new Error(
        `Invalid encoded index: ${encodedIndex}. Implementation error.`,
      ),
    )
  }

  const [error, indexEncoded] = encodeFixedLength(BigInt(encodedIndex), 2n)
  if (error) {
    return safeError(error)
  }
  parts.push(indexEncoded)

  return safeResult(concatBytes(parts))
}

/**
 * Decode import reference according to Gray Paper specification.
 *
 * Gray Paper Equation 305-311 (label: decodeImportRef):
 * Inverse of encodeImportRef{⟨h ∈ hash ∪ hash^⊞, i ∈ Nbits(15)⟩} ≡ {
 *   ⟨h, decode[2]{encoded_index}⟩
 *   where real_index = encoded_index & 0x7FFF (clear bit 15)
 *   and is_refined = (encoded_index & 0x8000) != 0 (check bit 15)
 * }
 *
 * Decodes import reference from octet sequence back to structured data.
 * Must exactly reverse the encoding process including type discrimination.
 *
 * Field decoding per Gray Paper:
 * 1. h: 32-byte hash (either regular hash or base of refined hash)
 * 2. decode[2]{index}: 2-byte fixed-length index with type decoding:
 *    - If bit 15 = 0: regular hash, use index as-is
 *    - If bit 15 = 1: refined hash, subtract 2^15 for real index
 *
 * Type reconstruction:
 * - Extract encoded index from 2-byte field
 * - Check bit 15 to determine hash type
 * - Mask out bit 15 to get real segment index (0-32767)
 * - Return hash and real index (type info implicit in bit pattern)
 *
 * ✅ CORRECT: Uses 32-byte hash decoding
 * ✅ CORRECT: Uses decode[2] for 2-byte fixed-length index
 * ✅ CORRECT: Implements type discrimination via bit manipulation
 * ✅ CORRECT: Maintains round-trip compatibility with encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded import reference and remaining data
 */
export function decodeImportReference(
  data: Uint8Array,
): Safe<DecodingResult<RefinedImportSegment>> {
  if (data.length < 34) {
    return safeError(
      new Error('Insufficient data for import reference decoding'),
    )
  }

  // h: 32-byte hash (either regular hash or base hash for refined)
  const hash = bytesToHex(data.slice(0, 32))
  const currentData = data.slice(32)

  // decode[2]{index}: 2-byte fixed-length index with type decoding
  const [error, indexResult] = decodeFixedLength(currentData, 2n)
  if (error) {
    return safeError(error)
  }

  const encodedIndex = Number(indexResult.value)
  const remainingData = indexResult.remaining

  // Validate encoded index range
  if (encodedIndex < 0 || encodedIndex > 65535) {
    return safeError(
      new Error(`Invalid encoded index: ${encodedIndex}. Must be 0-65535.`),
    )
  }

  // Extract type information and real index from encoded value per Gray Paper
  const isRefinedHash = (encodedIndex & 0x8000) !== 0 // Check bit 15
  const realIndex = encodedIndex & 0x7fff // Clear bit 15 to get real index (0-32767)

  // Additional validation: real index must be in valid range
  if (realIndex < 0 || realIndex > 32767) {
    return safeError(
      new Error(`Invalid real index: ${realIndex}. Must be 0-32767.`),
    )
  }

  return safeResult({
    value: {
      treeRoot: hash,
      index: realIndex,
      isRefined: isRefinedHash,
    },
    remaining: remainingData,
    consumed: data.length - remainingData.length,
  })
}

/**
 * Create a regular (non-refined) import reference.
 *
 * Convenience function for creating regular hash import references
 * without needing to specify the isRefined flag.
 *
 * @param hash - 32-byte content hash
 * @param index - Segment index (0-32767)
 * @returns Regular import reference
 */
export function createRegularImportReference(
  hash: Hex,
  index: bigint,
): ImportSegment {
  return { treeRoot: hash, index: Number(index) }
}

/**
 * Create a refined hash import reference.
 *
 * Convenience function for creating refined hash import references
 * with the isRefined flag set to true.
 *
 * @param hash - 32-byte base hash (before refinement)
 * @param index - Segment index (0-32767)
 * @returns Refined import reference
 */
export function createRefinedImportReference(
  hash: Hex,
  index: bigint,
): RefinedImportSegment {
  return { treeRoot: hash, index: Number(index), isRefined: true }
}

/**
 * Check if an import reference is a refined hash.
 *
 * @param importRef - Import reference to check
 * @returns True if this is a refined hash reference
 */
export function isRefinedImportReference(
  importRef: ImportSegment | RefinedImportSegment,
): importRef is RefinedImportSegment {
  return 'isRefined' in importRef && importRef.isRefined === true
}

/**
 * Get the hash type description for logging/debugging.
 *
 * @param importRef - Import reference to describe
 * @returns Human-readable hash type description
 */
export function getImportReferenceType(
  importRef: ImportSegment | RefinedImportSegment,
): string {
  return isRefinedImportReference(importRef)
    ? 'refined hash (hash^⊞)'
    : 'regular hash'
}
