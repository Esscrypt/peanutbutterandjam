/**
 * Discriminator Encoding
 *
 * Implements discriminator encoding from Gray Paper Appendix D.1
 * var{x} ≡ ⟨len(x), x⟩ and maybe{x} ≡ 0 when x = none, ⟨1, x⟩ otherwise
 */

import type { Uint8Array, Optional } from '../types'
import { decodeNatural, encodeNatural } from './natural-number'

/**
 * Encode variable-length term with length discriminator
 *
 * Formula from Gray Paper:
 * encode(var{x}) ≡ encode(len(x)) ∥ encode(x)
 *
 * @param data - Variable-length data to encode
 * @returns Encoded octet sequence with length prefix
 */
export function encodeVariableLength(data: Uint8Array): Uint8Array {
  const length = data.length
  const encodedLength = encodeNatural(BigInt(length))

  const result = new Uint8Array(encodedLength.length + data.length)
  result.set(encodedLength, 0)
  result.set(data, encodedLength.length)

  return result
}

/**
 * Decode variable-length term with length discriminator
 *
 * @param data - Octet sequence to decode
 * @returns Decoded data and remaining octet sequence
 */
export function decodeVariableLength(data: Uint8Array): {
  value: Uint8Array
  remaining: Uint8Array
} {
  const { value: length, remaining: lengthRemaining } = decodeNatural(data)

  if (length < 0n) {
    throw new Error('Variable length cannot be negative')
  }

  const lengthNum = Number(length)
  if (lengthRemaining.length < lengthNum) {
    throw new Error(
      `Insufficient data for variable-length decoding (expected ${lengthNum} bytes, got ${lengthRemaining.length})`,
    )
  }

  const value = lengthRemaining.slice(0, lengthNum)
  const remaining = lengthRemaining.slice(lengthNum)

  return { value, remaining }
}

/**
 * Encode optional value
 *
 * Formula from Gray Paper:
 * encode(maybe{x}) ≡ 0 when x = none, ⟨1, x⟩ otherwise
 *
 * @param value - Optional value to encode
 * @param encoder - Function to encode the value when present
 * @returns Encoded octet sequence
 */
export function encodeOptional<T>(
  value: Optional<T>,
  encoder: (value: T) => Uint8Array,
): Uint8Array {
  if (value === null || value === undefined) {
    return new Uint8Array([0])
  }

  const encodedValue = encoder(value)
  const result = new Uint8Array(1 + encodedValue.length)
  result[0] = 1
  result.set(encodedValue, 1)

  return result
}

/**
 * Decode optional value
 *
 * @param data - Octet sequence to decode
 * @param decoder - Function to decode the value when present
 * @returns Decoded optional value and remaining octet sequence
 */
export function decodeOptional<T>(
  data: Uint8Array,
  decoder: (data: Uint8Array) => { value: T; remaining: Uint8Array },
): {
  value: Optional<T>
  remaining: Uint8Array
} {
  if (data.length === 0) {
    throw new Error('Cannot decode optional value from empty data')
  }

  const discriminator = data[0]

  if (discriminator === 0) {
    return {
      value: null,
      remaining: data.slice(1),
    }
  }

  if (discriminator === 1) {
    const { value, remaining } = decoder(data.slice(1))
    return { value, remaining }
  }

  throw new Error(`Invalid optional discriminator: ${discriminator}`)
}

/**
 * Encode discriminated union
 *
 * @param discriminator - Discriminator value (0-255)
 * @param data - Data to encode
 * @returns Encoded octet sequence
 */
export function encodeDiscriminatedUnion(
  discriminator: number,
  data: Uint8Array,
): Uint8Array {
  if (discriminator < 0 || discriminator > 255) {
    throw new Error(`Discriminator must be 0-255, got ${discriminator}`)
  }

  const result = new Uint8Array(1 + data.length)
  result[0] = discriminator
  result.set(data, 1)

  return result
}

/**
 * Decode discriminated union
 *
 * @param data - Octet sequence to decode
 * @param decoders - Map of discriminator values to decoder functions
 * @returns Decoded value and remaining octet sequence
 */
export function decodeDiscriminatedUnion<T>(
  data: Uint8Array,
  decoders: Map<
    number,
    (data: Uint8Array) => { value: T; remaining: Uint8Array }
  >,
): {
  value: T
  remaining: Uint8Array
} {
  if (data.length === 0) {
    throw new Error('Cannot decode discriminated union from empty data')
  }

  const discriminator = data[0]
  const decoder = decoders.get(discriminator)

  if (!decoder) {
    throw new Error(`No decoder found for discriminator: ${discriminator}`)
  }

  return decoder(data.slice(1))
}
