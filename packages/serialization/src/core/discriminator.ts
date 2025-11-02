/**
 * Discriminator Encoding
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Serialization Codec
 * Formula (Equation 52-62):
 *
 * Length discriminator for variable-length terms:
 * var{x} ≡ ⟨len(x), x⟩ thus encode(var{x}) ≡ encode(len(x)) ∥ encode(x)
 *
 * Optional discriminator for terms in union with none:
 * maybe{x} ≡ {
 *   0       when x = none
 *   ⟨1, x⟩  otherwise
 * }
 *
 * Discriminators are encoded as a natural and are encoded immediately
 * prior to the item to determine the nature of the encoded item.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Discriminators solve the problem of encoding variable-sized or optional data.
 * They're essential for safe deserialization when you don't know sizes in advance.
 *
 * Two main types:
 *
 * 1. LENGTH DISCRIMINATOR (var{x}):
 *    - Prefixes variable-length data with its length
 *    - Example: var{"hello"} → encode(5) ∥ "hello"
 *    - Allows parser to know how many bytes to read
 *    - Used for blobs, strings, arrays of unknown size
 *
 * 2. OPTIONAL DISCRIMINATOR (maybe{x}):
 *    - Handles nullable/optional values
 *    - 0 byte = null/none, 1 byte + data = some value
 *    - Example: maybe{42} → [0x01] ∥ encode(42)
 *    - Example: maybe{null} → [0x00]
 *
 * These are crucial for complex data structures where components
 * may be missing or have variable sizes (like epoch marks in headers).
 */

import type { Decoder, Encoder, Optional, Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
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
export function encodeVariableLength(data: Uint8Array): Safe<Uint8Array> {
  const length = data.length
  const [encodedLengthError, encodedLength] = encodeNatural(BigInt(length))
  if (encodedLengthError) {
    return safeError(encodedLengthError)
  }

  const result = new Uint8Array(encodedLength.length + data.length)
  result.set(encodedLength, 0)
  result.set(data, encodedLength.length)

  return safeResult(result)
}

/**
 * Decode variable-length term with length discriminator
 *
 * @param data - Octet sequence to decode
 * @returns Decoded data and remaining octet sequence
 */
export function decodeVariableLength(data: Uint8Array): Safe<{
  value: Uint8Array
  remaining: Uint8Array
}> {
  const [error, result] = decodeNatural(data)
  if (error) {
    return safeError(error)
  }

  const length = result.value
  const lengthRemaining = result.remaining

  if (length < 0n) {
    return safeError(new Error('Variable length cannot be negative'))
  }

  const lengthNum = Number(length)
  if (lengthRemaining.length < lengthNum) {
    return safeError(
      new Error(
        `Insufficient data for variable-length decoding (expected ${lengthNum} Uint8Array, got ${lengthRemaining.length})`,
      ),
    )
  }

  const value = lengthRemaining.slice(0, lengthNum)
  const remaining = lengthRemaining.slice(lengthNum)

  return safeResult({
    value,
    remaining,
    consumed: data.length - remaining.length,
  })
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
  encoder: Encoder<T>,
): Safe<Uint8Array> {
  if (value === null || value === undefined) {
    return safeResult(new Uint8Array([0]))
  }

  const [encodedValueError, encodedValue] = encoder(value)
  if (encodedValueError) {
    return safeError(encodedValueError)
  }

  const result = new Uint8Array(1 + encodedValue.length)
  result[0] = 1
  result.set(encodedValue, 1)

  return safeResult(result)
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
  decoder: Decoder<T>,
): Safe<{
  value: Optional<T>
  remaining: Uint8Array
}> {
  if (data.length === 0) {
    return safeError(new Error('Cannot decode optional value from empty data'))
  }

  const discriminator = data[0]

  if (discriminator === 0) {
    return safeResult({
      value: null,
      remaining: data.slice(1),
    })
  }

  if (discriminator === 1) {
    const [error, result] = decoder(data.slice(1))
    if (error) {
      return safeError(error)
    }

    const value = result.value
    const remaining = result.remaining

    return safeResult({ value, remaining })
  }

  return safeError(
    new Error(`Invalid optional discriminator: ${discriminator}`),
  )
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
): Safe<Uint8Array> {
  if (discriminator < 0 || discriminator > 255) {
    return safeError(
      new Error(`Discriminator must be 0-255, got ${discriminator}`),
    )
  }

  const result = new Uint8Array(1 + data.length)
  result[0] = discriminator
  result.set(data, 1)

  return safeResult(result)
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
  decoders: Map<number, Decoder<T>>,
): Safe<{
  value: T
  remaining: Uint8Array
}> {
  if (data.length === 0) {
    return safeError(
      new Error('Cannot decode discriminated union from empty data'),
    )
  }

  const discriminator = data[0]
  const decoder = decoders.get(discriminator)

  if (!decoder) {
    return safeError(
      new Error(`No decoder found for discriminator: ${discriminator}`),
    )
  }

  const [error, result] = decoder(data.slice(1))
  if (error) {
    return safeError(error)
  }

  return safeResult({ value: result.value, remaining: result.remaining })
}
