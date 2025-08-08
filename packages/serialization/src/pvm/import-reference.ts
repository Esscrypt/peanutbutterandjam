/**
 * Import reference serialization
 *
 * Implements Gray Paper import reference serialization
 * Reference: graypaper/text/import_reference.tex
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import type { ImportReference, Uint8Array } from '../types'

/**
 * Encode import reference
 *
 * @param importRef - Import reference to encode
 * @returns Encoded octet sequence
 */
export function encodeImportReference(
  importRef: ImportReference,
): Uint8Array {
  const parts: Uint8Array[] = []

  // Hash (32 bytes)
  parts.push(hexToBytes(importRef.hash))

  // Index (8 bytes)
  parts.push(encodeNatural(importRef.index))

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
  value: ImportReference
  remaining: Uint8Array
} {
  // Hash (32 bytes)
  const hash = bytesToHex(data.slice(0, 32))
  const remaining = data.slice(32)

  // Index (8 bytes)
  const index = BigInt(
    `0x${Array.from(remaining.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )

  return {
    value: {
      hash,
      index,
    },
    remaining: remaining.slice(8),
  }
}
