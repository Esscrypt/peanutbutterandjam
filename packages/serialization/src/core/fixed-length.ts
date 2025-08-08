/**
 * Fixed-Length Integer Serialization
 *
 * Implements fnencode[l]: Nbits(8l) → blob[l] from Gray Paper Appendix D.1
 * Little-endian encoding for fixed-length integers
 */

import type { FixedLengthSize, Natural, Uint8Array } from '@pbnj/types'

/**
 * Encode natural number using fixed-length little-endian encoding
 *
 * Formula from Gray Paper:
 * encode[l](x) ≡ ⟨⟩ when l = 0
 * encode[l](x) ≡ ⟨x mod 256⟩ ∥ encode[l-1](⌊x/256⌋) otherwise
 *
 * @param value - Natural number to encode
 * @param length - Fixed length in bytes (1, 2, 4, or 8)
 * @returns Encoded octet sequence of specified length
 */
export function encodeFixedLength(
  value: Natural,
  length: FixedLengthSize,
): Uint8Array {
  // Validate input
  if (value < 0n) {
    throw new Error(`Natural number cannot be negative: ${value}`)
  }

  const maxValue = 2n ** (8n * BigInt(length)) - 1n
  if (value > maxValue) {
    throw new Error(
      `Value ${value} exceeds maximum for ${length}-byte encoding: ${maxValue}`,
    )
  }

  const result = new Uint8Array(length)

  // Little-endian encoding
  for (let i = 0; i < length; i++) {
    result[i] = Number((value >> BigInt(8 * i)) & 0xffn)
  }

  return result
}

/**
 * Decode natural number from fixed-length little-endian encoding
 *
 * @param data - Octet sequence to decode
 * @param length - Expected length in bytes
 * @returns Decoded natural number and remaining data
 */
export function decodeFixedLength(
  data: Uint8Array,
  length: FixedLengthSize,
): { value: Natural; remaining: Uint8Array } {
  if (data.length < length) {
    throw new Error(
      `Insufficient data for ${length}-byte decoding (got ${data.length} bytes)`,
    )
  }

  let value = 0n

  // Little-endian decoding
  for (let i = 0; i < length; i++) {
    value |= BigInt(data[i]) << BigInt(8 * i)
  }

  return {
    value,
    remaining: data.slice(length),
  }
}

/**
 * Encode tuple using fixed-length encoding
 *
 * Formula from Gray Paper:
 * encode[l](a,b,...) ≡ encode[l](⟨a,b,...⟩)
 * encode[l](⟨a,b,...⟩) ≡ encode[l](a) ∥ encode[l](b) ∥ ...
 *
 * @param tuple - Tuple of natural numbers
 * @param length - Fixed length for each element
 * @returns Encoded octet sequence
 */
export function encodeFixedLengthTuple(
  tuple: readonly Natural[],
  length: FixedLengthSize,
): Uint8Array {
  const totalLength = tuple.length * length
  const result = new Uint8Array(totalLength)

  for (let i = 0; i < tuple.length; i++) {
    const element = encodeFixedLength(tuple[i], length)
    result.set(element, i * length)
  }

  return result
}

/**
 * Decode tuple from fixed-length encoding
 *
 * @param data - Octet sequence to decode
 * @param length - Fixed length for each element
 * @param count - Number of elements to decode
 * @returns Decoded tuple and remaining data
 */
export function decodeFixedLengthTuple(
  data: Uint8Array,
  length: FixedLengthSize,
  count: number,
): { value: Natural[]; remaining: Uint8Array } {
  const totalLength = count * length

  if (data.length < totalLength) {
    throw new Error(
      `Insufficient data for tuple decoding (expected ${totalLength} bytes, got ${data.length})`,
    )
  }

  const result: Natural[] = []

  for (let i = 0; i < count; i++) {
    const elementData = data.slice(i * length, (i + 1) * length)
    const { value } = decodeFixedLength(elementData, length)
    result.push(value)
  }

  return {
    value: result,
    remaining: data.slice(totalLength),
  }
}

/**
 * Encode sequence using fixed-length encoding
 *
 * Formula from Gray Paper:
 * encode[l](⟨i₀,i₁,...⟩) ≡ encode[l](i₀) ∥ encode[l](i₁) ∥ ...
 *
 * @param sequence - Sequence of natural numbers
 * @param length - Fixed length for each element
 * @returns Encoded octet sequence
 */
export function encodeFixedLengthSequence(
  sequence: Natural[],
  length: FixedLengthSize,
): Uint8Array {
  return encodeFixedLengthTuple(sequence, length)
}

/**
 * Decode sequence from fixed-length encoding
 *
 * @param data - Octet sequence to decode
 * @param length - Fixed length for each element
 * @param count - Number of elements to decode
 * @returns Decoded sequence and remaining data
 */
export function decodeFixedLengthSequence(
  data: Uint8Array,
  length: FixedLengthSize,
  count: number,
): { value: Natural[]; remaining: Uint8Array } {
  return decodeFixedLengthTuple(data, length, count)
}

/**
 * Convenience functions for common fixed lengths
 */

/**
 * Encode 8-bit unsigned integer
 */
export function encodeUint8(value: Natural): Uint8Array {
  return encodeFixedLength(value, 1)
}

/**
 * Decode 8-bit unsigned integer
 */
export function decodeUint8(data: Uint8Array): {
  value: Natural
  remaining: Uint8Array
} {
  return decodeFixedLength(data, 1)
}

/**
 * Encode 16-bit unsigned integer
 */
export function encodeUint16(value: Natural): Uint8Array {
  return encodeFixedLength(value, 2)
}

/**
 * Decode 16-bit unsigned integer
 */
export function decodeUint16(data: Uint8Array): {
  value: Natural
  remaining: Uint8Array
} {
  return decodeFixedLength(data, 2)
}

/**
 * Encode 32-bit unsigned integer
 */
export function encodeUint32(value: Natural): Uint8Array {
  return encodeFixedLength(value, 4)
}

/**
 * Decode 32-bit unsigned integer
 */
export function decodeUint32(data: Uint8Array): {
  value: Natural
  remaining: Uint8Array
} {
  return decodeFixedLength(data, 4)
}

/**
 * Encode 64-bit unsigned integer
 */
export function encodeUint64(value: Natural): Uint8Array {
  return encodeFixedLength(value, 8)
}

/**
 * Decode 64-bit unsigned integer
 */
export function decodeUint64(data: Uint8Array): {
  value: Natural
  remaining: Uint8Array
} {
  return decodeFixedLength(data, 8)
}

/**
 * Encode 128-bit unsigned integer
 */
export function encodeUint128(value: Natural): Uint8Array {
  return encodeFixedLength(value, 16)
}

/**
 * Decode 128-bit unsigned integer
 */
export function decodeUint128(data: Uint8Array): {
  value: Natural
  remaining: Uint8Array
} {
  return decodeFixedLength(data, 16)
}

/**
 * Encode 256-bit unsigned integer
 */
export function encodeUint256(value: Natural): Uint8Array {
  return encodeFixedLength(value, 32)
}

/**
 * Decode 256-bit unsigned integer
 */
export function decodeUint256(data: Uint8Array): {
  value: Natural
  remaining: Uint8Array
} {
  return decodeFixedLength(data, 32)
}
