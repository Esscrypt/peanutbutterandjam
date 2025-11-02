/**
 * Bit Sequence Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Serialization Codec
 * Formula (Equation 65-74):
 *
 * encode(b ∈ bitstring) ≡ {
 *   ⟨⟩                                                    when b = ⟨⟩
 *   ⟨∑ᵢ₌₀^min(8,len(b)) bᵢ · 2ⁱ⟩ ∥ encode(b[8:])         otherwise
 * }
 *
 * A sequence of bits is packed into octets in order of least significant
 * to most, and arranged into an octet stream. This avoids wasteful
 * encoding of each individual bit as an octet.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Bit sequence encoding efficiently packs boolean arrays into bytes.
 * This is 8x more space-efficient than encoding each bit as a full byte.
 *
 * Key aspects:
 * - Packing order: LEAST significant bit first (LSB)
 * - Byte filling: Fill bytes from right-to-left (bit 0 to bit 7)
 * - Recursive processing: Handle 8 bits at a time
 * - Partial bytes: Last byte may be partially filled
 *
 * Example: [true, false, true, false, false, true, false, false]
 * - Bit positions: [0, 1, 2, 3, 4, 5, 6, 7]
 * - Binary value: 00100101 (reading right-to-left)
 * - Result byte: 0x25 (37 decimal)
 *
 * This is used for validator participation sets, availability bitfields,
 * and other boolean arrays common in consensus protocols.
 */

import type { Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'

// Uint8Array is a built-in type, no need to import

/**
 * Encode bit sequence using Gray Paper bitstring encoding
 *
 * Formula from Gray Paper:
 * encode(b ∈ bitstring) ≡ ⟨∑(bᵢ·2ⁱ)⟩ ∥ encode(b[8:])
 *
 * This packs bits into octets and recursively encodes remaining bits
 *
 * @param bits - Array of boolean values representing bits
 * @returns Encoded octet sequence
 */
export function encodeBitSequence(bits: boolean[]): Safe<Uint8Array> {
  if (bits.length === 0) {
    return safeResult(new Uint8Array(0))
  }

  // Pack first 8 bits into an octet
  const octet = packBitsToOctet(bits.slice(0, 8))

  // Recursively encode remaining bits
  const remainingBits = bits.slice(8)
  const [error, remainingEncoded] = encodeBitSequence(remainingBits)
  if (error) {
    return safeError(error)
  }

  // Concatenate octet with remaining encoded bits
  const result = new Uint8Array(1 + remainingEncoded.length)
  result[0] = octet
  result.set(remainingEncoded, 1)

  return safeResult(result)
}

/**
 * Decode bit sequence using Gray Paper bitstring encoding
 *
 * @param data - Octet sequence to decode
 * @param bitCount - Number of bits to decode (if known)
 * @returns Decoded bit array and remaining data
 */
export function decodeBitSequence(
  data: Uint8Array,
  bitCount?: number,
): Safe<{ value: boolean[]; remaining: Uint8Array }> {
  if (data.length === 0) {
    return safeResult({ value: [], remaining: data })
  }

  // If bitCount is specified, decode exactly that many bits
  if (bitCount !== undefined) {
    const bits: boolean[] = []
    let remainingData = data
    let remainingBits = bitCount

    while (remainingBits > 0 && remainingData.length > 0) {
      const octet = remainingData[0]
      const octetBits = unpackOctetToBits(octet)
      const bitsToTake = Math.min(remainingBits, 8)

      bits.push(...octetBits.slice(0, bitsToTake))
      remainingBits -= bitsToTake
      remainingData = remainingData.slice(1)
    }

    return safeResult({
      value: bits,
      remaining: remainingData,
    })
  }

  // If no bitCount specified, decode all available bits (8 per octet)
  const bits: boolean[] = []
  for (let i = 0; i < data.length; i++) {
    const octetBits = unpackOctetToBits(data[i])
    bits.push(...octetBits)
  }

  return safeResult({
    value: bits,
    remaining: new Uint8Array(0),
  })
}

/**
 * Encode bit sequence with length prefix
 *
 * @param bits - Array of boolean values representing bits
 * @returns Encoded octet sequence with length prefix
 */
export function encodeBitSequenceWithLength(bits: boolean[]): Safe<Uint8Array> {
  const [error, encodedBits] = encodeBitSequence(bits)
  if (error) {
    return safeError(error)
  }
  const length = bits.length

  // Encode length as natural number
  const [error2, encodedLength] = encodeNatural(BigInt(length))
  if (error2) {
    return safeError(error2)
  }

  const result = new Uint8Array(encodedLength.length + encodedBits.length)
  result.set(encodedLength, 0)
  result.set(encodedBits, encodedLength.length)

  return safeResult(result)
}

/**
 * Decode bit sequence with length prefix
 *
 * @param data - Octet sequence to decode
 * @returns Decoded bit array and remaining data
 */
export function decodeBitSequenceWithLength(data: Uint8Array): Safe<{
  value: boolean[]
  remaining: Uint8Array
}> {
  // First decode the length
  const [error, lengthResult] = decodeNatural(data)
  if (error) {
    return safeError(error)
  }
  const length = lengthResult.value
  const lengthRemaining = lengthResult.remaining
  const bitCount = Number(length)

  if (bitCount < 0 || bitCount > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid bit sequence length: ${length}`)
  }

  // Then decode the bit sequence
  const [error2, bitSequenceResult] = decodeBitSequence(
    lengthRemaining,
    bitCount,
  )
  if (error2) {
    return safeError(error2)
  }
  const value = bitSequenceResult.value
  const remaining = bitSequenceResult.remaining

  return safeResult({ value, remaining })
}

/**
 * Pack up to 8 bits into a single octet
 *
 * @param bits - Array of up to 8 boolean values
 * @returns Octet value (0-255)
 */
function packBitsToOctet(bits: boolean[]): number {
  let octet = 0
  for (let i = 0; i < Math.min(bits.length, 8); i++) {
    if (bits[i]) {
      octet |= 1 << i
    }
  }
  return octet
}

/**
 * Unpack a single octet into 8 bits
 *
 * @param octet - Octet value (0-255)
 * @returns Array of 8 boolean values
 */
function unpackOctetToBits(octet: number): boolean[] {
  const bits: boolean[] = []
  for (let i = 0; i < 8; i++) {
    bits.push((octet & (1 << i)) !== 0)
  }
  return bits
}

// Import required functions
import { decodeNatural, encodeNatural } from './natural-number'
