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

import type { Decoder, Encoder, Natural, Sequence } from '@pbnj/types'
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
export function encodeSequence(sequence: Sequence<Natural>): Uint8Array {
  return encodeSequenceGeneric(sequence, encodeNatural)
}

/**
 * Encode sequence of unknown type with custom encoder
 *
 * Formula from Gray Paper:
 * encode([i₀, i₁, ...]) ≡ encode(i₀) ∥ encode(i₁) ∥ ...
 *
 * @param sequence - Sequence of elements to encode
 * @param encoder - Function to encode individual elements
 * @returns Encoded octet sequence
 */
export function encodeSequenceGeneric<T>(
  sequence: T[],
  encoder: Encoder<T>,
): Uint8Array {
  // Calculate total size needed
  let totalSize = 0
  const encodedElements: Uint8Array[] = []

  for (const element of sequence) {
    const encoded = encoder(element)
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

  return result
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
  count?: number,
): { value: Natural[]; remaining: Uint8Array } {
  return decodeSequenceGeneric(data, decodeNatural, count)
}

/**
 * Decode sequence of unknown type with custom decoder
 *
 * @param data - Octet sequence to decode
 * @param decoder - Function to decode individual elements
 * @param count - Number of elements to decode (if known)
 * @returns Decoded sequence and remaining data
 */
export function decodeSequenceGeneric<T>(
  data: Uint8Array,
  decoder: Decoder<T>,
  count?: number,
): { value: T[]; remaining: Uint8Array } {
  const result: T[] = []
  let remaining = data

  if (count !== undefined) {
    // Decode known number of elements
    for (let i = 0; i < count; i++) {
      if (remaining.length === 0) {
        throw new Error(
          `Insufficient data for sequence decoding (expected ${count} elements, got ${i})`,
        )
      }
      const { value, remaining: nextRemaining } = decoder(remaining)
      result.push(value)
      remaining = nextRemaining
    }
  } else {
    // Decode until no more data
    while (remaining.length > 0) {
      try {
        const { value, remaining: nextRemaining } = decoder(remaining)
        result.push(value)
        remaining = nextRemaining
      } catch {
        // Stop decoding if we can't decode more elements
        break
      }
    }
  }

  return {
    value: result,
    remaining,
  }
}

/**
 * Encode sequence with length prefix
 *
 * @param sequence - Sequence of natural numbers to encode
 * @returns Encoded octet sequence with length prefix
 */
export function encodeSequenceWithLength(
  sequence: Sequence<Natural>,
): Uint8Array {
  const encodedSequence = encodeSequence(sequence)
  const length = BigInt(sequence.length)
  const encodedLength = encodeNatural(length)

  const result = new Uint8Array(encodedLength.length + encodedSequence.length)
  result.set(encodedLength, 0)
  result.set(encodedSequence, encodedLength.length)

  return result
}

/**
 * Decode sequence with length prefix
 *
 * @param data - Octet sequence to decode
 * @returns Decoded sequence and remaining data
 */
export function decodeSequenceWithLength(data: Uint8Array): {
  value: Natural[]
  remaining: Uint8Array
} {
  // First decode the length
  const { value: length, remaining: lengthRemaining } = decodeNatural(data)
  const count = Number(length)

  if (count < 0 || count > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid sequence length: ${length}`)
  }

  // Then decode the sequence
  const { value, remaining } = decodeSequence(lengthRemaining, count)

  return { value, remaining }
}

/**
 * Encode sequence of octet sequences (identity serialization for fixed-length)
 *
 * @param sequence - Sequence of octet sequences
 * @returns Concatenated octet sequence
 */
export function encodeUint8Array(sequence: Sequence<Uint8Array>): Uint8Array {
  // Calculate total size
  const totalSize = sequence.reduce((sum, element) => sum + element.length, 0)
  const result = new Uint8Array(totalSize)

  let offset = 0
  for (const element of sequence) {
    result.set(element, offset)
    offset += element.length
  }

  return result
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
): { value: Uint8Array[]; remaining: Uint8Array } {
  const totalLength = elementLength * count

  if (data.length < totalLength) {
    throw new Error(
      `Insufficient data for octet sequence decoding (expected ${totalLength} Uint8Array, got ${data.length})`,
    )
  }

  const result: Uint8Array[] = []

  for (let i = 0; i < count; i++) {
    const start = i * elementLength
    const end = start + elementLength
    const element = data.slice(start, end)
    result.push(element)
  }

  return {
    value: result,
    remaining: data.slice(totalLength),
  }
}
