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

import { bytesToHex, hexToBytes } from '@pbnj/core'
import type { ImportSegment } from '@pbnj/types'
import { decodeNatural, encodeNatural } from '../core/natural-number'

/**
 * Encode import reference
 *
 * @param importRef - Import reference to encode
 * @returns Encoded octet sequence
 */
export function encodeImportReference(importRef: ImportSegment): Uint8Array {
  const parts: Uint8Array[] = []

  // Tree root (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(importRef.hash))

  // Index (variable length natural number)
  parts.push(encodeNatural(BigInt(importRef.index)))

  // Concatenate all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

/**
 * Decode import reference
 *
 * @param data - Octet sequence to decode
 * @returns Decoded import reference and remaining data
 */
export function decodeImportReference(data: Uint8Array): {
  value: ImportSegment
  remaining: Uint8Array
} {
  // Tree root (32 bytes)
  const treeRoot = bytesToHex(data.slice(0, 32))
  const remaining = data.slice(32)

  // Index (variable length natural number)
  const { value: index, remaining: indexRemaining } = decodeNatural(remaining)

  return {
    value: {
      hash: treeRoot,
      index: Number(index),
    },
    remaining: indexRemaining,
  }
}
