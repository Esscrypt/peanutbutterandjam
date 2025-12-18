/**
 * Sequence Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Serialization Codec
 * Formula (Equation 42-44):
 *
 * Sequence serialization for any T which is a subset of the domain of fnencode:
 * encode([i₀, i₁, ...]) ≡ encode(i₀) ∥ encode(i₁) ∥ ...
 *
 * We simply concatenate the serializations of each element in the sequence in turn.
 * Fixed length octet sequences (e.g. hashes) have an identity serialization.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Sequence encoding is JAM's simple but powerful approach to encoding arrays.
 * It's the foundation for encoding complex structures.
 *
 * Key principles:
 * - Order matters: [A, B] ≠ [B, A]
 * - No separators: elements are directly concatenated
 * - No length prefix (unless using var{} discriminator)
 * - Identity for byte arrays: [0x01, 0x02] → 0x0102
 *
 * Examples:
 * - Hash sequence: [hash1, hash2] → hash1 ∥ hash2 (64 bytes)
 * - Number sequence: [1, 2, 3] → encode(1) ∥ encode(2) ∥ encode(3)
 * - Empty sequence: [] → ⟨⟩ (0 bytes)
 *
 * This works because individual element encoding is deterministic,
 * so deserialization can parse elements sequentially.
 */

import { concatBytes } from '@pbnjam/core'
import type {
  Decoder,
  DecodingResult,
  Encoder,
  Safe,
  Sequence,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeNatural, encodeNatural } from './natural-number'

/**
 * Encode sequence of natural numbers
 *
 * Formula from Gray Paper:
 * encode([i₀, i₁, ...]) ≡ encode(i₀) ∥ encode(i₁) ∥ ...
 *
 * @param sequence - Sequence of natural numbers to encode
 * @returns Encoded octet sequence
 */
export function encodeSequence(sequence: Sequence<bigint>): Safe<Uint8Array> {
  return encodeSequenceGeneric(sequence, encodeNatural)
}

/**
 * Encode sequence of unknown type with custom encoder
 *
 * Formula from Gray Paper:
 * encode([i₀, i₁, ...]) ≡ encode(i₀) ∥ encode(i₁) ∥ ...
 *
 *
 * @param sequence - Sequence of elements to encode
 * @param encoder - Function to encode individual elements
 * @returns Encoded octet sequence
 */
export function encodeSequenceGeneric<T>(
  sequence: T[],
  encoder: Encoder<T>,
): Safe<Uint8Array> {
  // Calculate total size needed
  let totalSize = 0
  const encodedElements: Uint8Array[] = []

  for (const element of sequence) {
    const [error, encoded] = encoder(element)
    if (error) {
      return safeError(error)
    }
    encodedElements.push(encoded)
    totalSize += encoded.length
  }

  // Concatenate all encoded elements
  const result = new Uint8Array(totalSize)
  let offset = 0

  for (const encoded of encodedElements) {
    result.set(encoded, offset)
    offset += encoded.length
  }

  return safeResult(result)
}

/**
 * Encode variable-length sequence with length prefix
 *
 * Formula from Gray Paper:
 * \var{sequence} = encode(length) ∥ encode(element₀) ∥ encode(element₁) ∥ ...
 *
 * This is used for variable-length sequences that need a length prefix.
 * The length prefix tells the decoder how many elements to expect.
 *
 * @param sequence - Sequence of elements to encode
 * @param encoder - Function to encode individual elements
 * @returns Encoded octet sequence with length prefix
 */
export function encodeVariableSequence<T>(
  sequence: T[],
  encoder: Encoder<T>,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Add length prefix
  const [lengthError, lengthEncoded] = encodeNatural(BigInt(sequence.length))
  if (lengthError) {
    return safeError(lengthError)
  }
  parts.push(lengthEncoded)

  // Encode each element
  for (const element of sequence) {
    const [error, encoded] = encoder(element)
    if (error) {
      return safeError(error)
    }
    parts.push(encoded)
  }

  return safeResult(concatBytes(parts))
}

/**
 * Decode sequence of natural numbers
 *
 * @param data - Octet sequence to decode
 * @param count - Number of elements to decode (if known)
 * @returns Decoded sequence and remaining data
 */
export function decodeSequence(
  data: Uint8Array,
  count: number,
): Safe<DecodingResult<bigint[]>> {
  return decodeSequenceGeneric(data, decodeNatural, count)
}

/**
 * Decode sequence of unknown type with custom decoder
 *
 * @deprecated THIS CONSUMES BYTES UNTIL THE END< DO NOT USE IT UNLESS YOU SPECIFY COUNT
 *
 * @param data - Octet sequence to decode
 * @param decoder - Function to decode individual elements
 * @param count - Number of elements to decode (if known)
 * @returns Decoded sequence and remaining data
 */
export function decodeSequenceGeneric<T>(
  data: Uint8Array,
  decoder: Decoder<T>,
  count: number,
): Safe<DecodingResult<T[]>> {
  const result: T[] = []
  let remaining = data

  // Decode known number of elements
  for (let i = 0; i < count; i++) {
    if (remaining.length === 0) {
      return safeError(
        new Error(
          `Insufficient data for sequence decoding (expected ${count} elements, got ${i})`,
        ),
      )
    }
    const [error, result2] = decoder(remaining)
    if (error) {
      return safeError(error)
    }
    const value = result2.value
    const nextRemaining = result2.remaining
    result.push(value)
    remaining = nextRemaining
  }

  const consumed = data.length - remaining.length

  return safeResult({
    value: result,
    remaining,
    consumed,
  })
}

/**
 * Encode sequence with length prefix
 *
 * @param sequence - Sequence of natural numbers to encode
 * @returns Encoded octet sequence with length prefix
 */
export function encodeSequenceWithLength(
  sequence: Sequence<bigint>,
): Safe<Uint8Array> {
  const [error, encodedSequence2] = encodeSequence(sequence)
  if (error) {
    return safeError(error)
  }
  const length = BigInt(sequence.length)
  const [error2, encodedLength] = encodeNatural(length)
  if (error2) {
    return safeError(error2)
  }
  const encodedLengthResult = encodedLength

  const result = new Uint8Array(
    encodedLengthResult.length + encodedSequence2.length,
  )
  result.set(encodedLengthResult, 0)
  result.set(encodedSequence2, encodedLengthResult.length)

  return safeResult(result)
}

/**
 * Decode sequence with length prefix
 *
 * @param data - Octet sequence to decode
 * @returns Decoded sequence and remaining data
 */
export function decodeSequenceWithLength(
  data: Uint8Array,
): Safe<DecodingResult<bigint[]>> {
  // First decode the length
  const [error, result] = decodeNatural(data)
  if (error) {
    return safeError(error)
  }
  const length = result.value
  const lengthRemaining = result.remaining
  const count = Number(length)

  if (count < 0 || count > Number.MAX_SAFE_INTEGER) {
    return safeError(new Error(`Invalid sequence length: ${length}`))
  }

  // Then decode the sequence
  const [error2, result2] = decodeSequence(lengthRemaining, count)
  if (error2) {
    return safeError(error2)
  }
  const value = result2.value
  const remaining = result2.remaining

  // Calculate total consumed bytes
  const consumed = data.length - remaining.length

  return safeResult({ value, remaining, consumed })
}

/**
 * Decode variable-length sequence with length prefix and custom decoder
 *
 * Formula from Gray Paper:
 * \var{sequence} = decode(length) ∥ decode(element₀) ∥ decode(element₁) ∥ ...
 *
 * This is used for variable-length sequences that need a length prefix.
 * The length prefix tells the decoder how many elements to expect.
 *
 * @param data - Octet sequence to decode
 * @param decoder - Function to decode individual elements
 * @returns Decoded sequence and remaining data
 */
export function decodeVariableSequence<T>(
  data: Uint8Array,
  decoder: Decoder<T>,
): Safe<DecodingResult<T[]>> {
  // First decode the length
  const [error, result] = decodeNatural(data)
  if (error) {
    return safeError(error)
  }
  const length = result.value
  const lengthRemaining = result.remaining
  const count = Number(length)

  if (count < 0 || count > Number.MAX_SAFE_INTEGER) {
    return safeError(new Error(`Invalid sequence length: ${length}`))
  }

  // Then decode the sequence using the custom decoder
  const [error2, result2] = decodeSequenceGeneric(
    lengthRemaining,
    decoder,
    count,
  )
  if (error2) {
    return safeError(error2)
  }
  const value = result2.value
  const remaining = result2.remaining

  // Calculate total consumed bytes
  const consumed = data.length - remaining.length

  return safeResult({ value, remaining, consumed })
}

/**
 * Encode sequence of octet sequences (identity serialization for fixed-length)
 *
 * @param sequence - Sequence of octet sequences
 * @returns Concatenated octet sequence
 */
export function encodeUint8Array(
  sequence: Sequence<Uint8Array>,
): Safe<Uint8Array> {
  // Calculate total size
  const totalSize = sequence.reduce((sum, element) => sum + element.length, 0)
  const result = new Uint8Array(totalSize)

  let offset = 0
  for (const element of sequence) {
    result.set(element, offset)
    offset += element.length
  }

  return safeResult(result)
}

/**
 * Decode sequence of octet sequences
 *
 * @param data - Octet sequence to decode
 * @param elementLength - Fixed length of each element
 * @param count - Number of elements to decode
 * @returns Decoded sequence and remaining data
 */
export function decodeUint8Array(
  data: Uint8Array,
  elementLength: number,
  count: number,
): Safe<DecodingResult<Uint8Array[]>> {
  const totalLength = elementLength * count

  if (data.length < totalLength) {
    return safeError(
      new Error(
        `Insufficient data for octet sequence decoding (expected ${totalLength} Uint8Array, got ${data.length})`,
      ),
    )
  }

  const result: Uint8Array[] = []

  for (let i = 0; i < count; i++) {
    const start = i * elementLength
    const end = start + elementLength
    const element = data.slice(start, end)
    result.push(element)
  }

  return safeResult({
    value: result,
    remaining: data.slice(totalLength),
    consumed: totalLength,
  })
}
