/**
 * Fixed-Length Integer Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Serialization Codec
 * Formula (Equation 102-109):
 *
 * fnencode[l ∈ N]: Nbits(8l) → blob[l]
 * x ↦ {
 *   ⟨⟩                                      when l = 0
 *   ⟨x mod 256⟩ ∥ encode[l-1](⌊x/256⌋)     otherwise
 * }
 *
 * Values are encoded in regular little-endian fashion. This is utilized
 * for almost all integer encoding across the protocol.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * This is the standard fixed-width integer encoding used throughout JAM.
 * Unlike variable-length encoding, this always uses exactly l bytes.
 *
 * Key characteristics:
 * - Little-endian byte order (least significant byte first)
 * - Recursive definition: encode least significant byte, then recurse
 * - Used for timestamps, indices, gas limits, etc. where size is known
 * - More efficient than variable-length for numbers that consistently use full width
 *
 * Example: encode[4](0x12345678) = [0x78, 0x56, 0x34, 0x12]
 *
 * The l parameter is constrained to {1, 2, 4, 8, 16, 32} bytes to match
 * common integer sizes and memory alignment requirements.
 */

import type { DecodingResult, FixedLengthSize, Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'

/**
 * Encode natural number using fixed-length little-endian encoding
 *
 * Formula from Gray Paper:
 * encode[l](x) ≡ ⟨⟩ when l = 0
 * encode[l](x) ≡ ⟨x mod 256⟩ ∥ encode[l-1](⌊x/256⌋) otherwise
 *
 * @param value - Natural number to encode
 * @param length - Fixed length in Uint8Array (1, 2, 4, or 8)
 * @returns Encoded octet sequence of specified length
 */
export function encodeFixedLength(
  value: bigint,
  length: FixedLengthSize,
): Safe<Uint8Array> {
  // Validate input
  if (value < 0n) {
    throw new Error(`Natural number cannot be negative: ${value}`)
  }

  const lengthNum = Number(length)
  const maxValue = 2n ** (8n * BigInt(lengthNum)) - 1n
  if (value > maxValue) {
    throw new Error(
      `Value ${value} exceeds maximum for ${lengthNum}-byte encoding: ${maxValue}`,
    )
  }

  const result = new Uint8Array(lengthNum)

  // Little-endian encoding
  for (let i = 0; i < lengthNum; i++) {
    result[i] = Number((value >> (8n * BigInt(i))) & 0xffn)
  }

  return safeResult(result)
}

/**
 * Decode natural number from fixed-length little-endian encoding
 *
 * @param data - Octet sequence to decode
 * @param length - Expected length in Uint8Array
 * @returns Decoded natural number and remaining data
 */
export function decodeFixedLength(
  data: Uint8Array,
  length: FixedLengthSize,
): Safe<DecodingResult<bigint>> {
  const lengthNum = Number(length)
  if (data.length < lengthNum) {
    return safeError(
      new Error(
        `Insufficient data for ${lengthNum}-byte decoding (got ${data.length} Uint8Array)`,
      ),
    )
  }

  let value = 0n

  // Little-endian decoding
  for (let i = 0; i < lengthNum; i++) {
    value |= BigInt(data[i]) << BigInt(8 * i)
  }

  return safeResult({
    value,
    remaining: data.slice(lengthNum),
    consumed: lengthNum,
  })
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
  tuple: readonly bigint[],
  length: FixedLengthSize,
): Safe<Uint8Array> {
  const lengthNum = Number(length)
  const totalLength = tuple.length * lengthNum
  const result = new Uint8Array(totalLength)

  for (let i = 0; i < tuple.length; i++) {
    const [error, element] = encodeFixedLength(tuple[i], length)
    if (error) {
      return safeError(error)
    }
    result.set(element, i * lengthNum)
  }

  return safeResult(result)
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
): Safe<DecodingResult<bigint[]>> {
  const lengthNum = Number(length)
  const totalLength = count * lengthNum

  if (data.length < totalLength) {
    return safeError(
      new Error(
        `Insufficient data for tuple decoding (expected ${totalLength} Uint8Array, got ${data.length})`,
      ),
    )
  }

  const result: bigint[] = []

  for (let i = 0; i < count; i++) {
    const elementData = data.slice(i * lengthNum, (i + 1) * lengthNum)
    const [error, result2] = decodeFixedLength(elementData, length)
    if (error) {
      return safeError(error)
    }
    result.push(result2.value)
  }

  return safeResult({
    value: result,
    remaining: data.slice(totalLength),
    consumed: totalLength,
  })
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
  sequence: bigint[],
  length: FixedLengthSize,
): Safe<Uint8Array> {
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
): Safe<DecodingResult<bigint[]>> {
  return decodeFixedLengthTuple(data, length, count)
}

/**
 * Convenience functions for common fixed lengths
 */

/**
 * Encode 8-bit unsigned integer
 */
export function encodeUint8(value: bigint): Safe<Uint8Array> {
  return encodeFixedLength(value, 1n)
}

/**
 * Decode 8-bit unsigned integer
 */
export function decodeUint8(data: Uint8Array): Safe<DecodingResult<bigint>> {
  return decodeFixedLength(data, 1n)
}

/**
 * Encode 16-bit unsigned integer
 */
export function encodeUint16(value: bigint): Safe<Uint8Array> {
  return encodeFixedLength(value, 2n)
}

/**
 * Decode 16-bit unsigned integer
 */
export function decodeUint16(data: Uint8Array): Safe<DecodingResult<bigint>> {
  return decodeFixedLength(data, 2n)
}

/**
 * Encode 32-bit unsigned integer
 */
export function encodeUint32(value: bigint): Safe<Uint8Array> {
  return encodeFixedLength(value, 4n)
}

/**
 * Decode 32-bit unsigned integer
 */
export function decodeUint32(data: Uint8Array): Safe<{
  value: bigint
  remaining: Uint8Array
}> {
  return decodeFixedLength(data, 4n)
}

/**
 * Encode 64-bit unsigned integer
 */
export function encodeUint64(value: bigint): Safe<Uint8Array> {
  return encodeFixedLength(value, 8n)
}

/**
 * Decode 64-bit unsigned integer
 */
export function decodeUint64(data: Uint8Array): Safe<DecodingResult<bigint>> {
  return decodeFixedLength(data, 8n)
}

/**
 * Encode 128-bit unsigned integer
 */
export function encodeUint128(value: bigint): Safe<Uint8Array> {
  return encodeFixedLength(value, 16n)
}

/**
 * Decode 128-bit unsigned integer
 */
export function decodeUint128(data: Uint8Array): Safe<DecodingResult<bigint>> {
  return decodeFixedLength(data, 16n)
}

/**
 * Encode 256-bit unsigned integer
 */
export function encodeUint256(value: bigint): Safe<Uint8Array> {
  return encodeFixedLength(value, 32n)
}

/**
 * Decode 256-bit unsigned integer
 */
export function decodeUint256(data: Uint8Array): Safe<DecodingResult<bigint>> {
  return decodeFixedLength(data, 32n)
}
