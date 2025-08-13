/**
 * Simple Number Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Serialization Codec
 * Formula (Equation 14-16):
 *
 * encode(x ∈ blob) ≡ x
 *
 * The serialization of an octet-sequence is itself. This implements simple
 * hex encoding for natural numbers to match the format used in JAM test vectors.
 * This is a direct identity encoding for blob sequences.
 */

import type { Natural } from '@pbnj/types'

/**
 * Encode natural number using simple hex encoding
 *
 * @param value - Natural number to encode
 * @returns Encoded octet sequence
 */
export function encodeSimpleNatural(value: Natural): Uint8Array {
  if (value < 0n) throw new Error(`Natural number cannot be negative: ${value}`)

  // Convert to hex string and pad to even length
  const hexStr = value.toString(16)
  const paddedHex = hexStr.length % 2 === 0 ? hexStr : `0${hexStr}`

  // Convert hex string to Uint8Array
  const result = new Uint8Array(paddedHex.length / 2)
  for (let i = 0; i < result.length; i++) {
    result[i] = Number.parseInt(paddedHex.substring(i * 2, i * 2 + 2), 16)
  }

  return result
}

/**
 * Decode natural number using simple hex encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded natural number and remaining data
 */
export function decodeSimpleNatural(data: Uint8Array): {
  value: Natural
  remaining: Uint8Array
} {
  if (data.length === 0)
    throw new Error('Cannot decode simple natural number from empty data')

  // Convert Uint8Array back to hex string (big-endian)
  let hexStr = ''
  for (let i = 0; i < data.length; i++) {
    hexStr += data[i].toString(16).padStart(2, '0')
  }

  // Parse hex string to BigInt
  const value = BigInt(`0x${hexStr}`)

  return { value, remaining: data.slice(data.length) }
}

/**
 * Get the encoded length of a simple natural number
 */
export function getSimpleNaturalEncodedLength(value: Natural): number {
  if (value === 0n) return 1
  const hexStr = value.toString(16)
  return Math.ceil(hexStr.length / 2)
}
