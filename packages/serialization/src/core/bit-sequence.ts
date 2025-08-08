/**
 * Bit Sequence Serialization
 *
 * Implements bitstring encoding from Gray Paper Appendix D.1
 * encode(b ∈ bitstring) ≡ ⟨∑(bᵢ·2ⁱ)⟩ ∥ encode(b[8:])
 */

import type { Uint8Array } from '../types'

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
export function encodeBitSequence(bits: boolean[]): Uint8Array {
  if (bits.length === 0) {
    return new Uint8Array(0)
  }

  // Pack first 8 bits into an octet
  const octet = packBitsToOctet(bits.slice(0, 8))

  // Recursively encode remaining bits
  const remainingBits = bits.slice(8)
  const remainingEncoded = encodeBitSequence(remainingBits)

  // Concatenate octet with remaining encoded bits
  const result = new Uint8Array(1 + remainingEncoded.length)
  result[0] = octet
  result.set(remainingEncoded, 1)

  return result
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
): { value: boolean[]; remaining: Uint8Array } {
  if (data.length === 0) {
    return { value: [], remaining: data }
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

    return {
      value: bits,
      remaining: remainingData,
    }
  }

  // If no bitCount specified, decode all available bits (8 per octet)
  const bits: boolean[] = []
  for (let i = 0; i < data.length; i++) {
    const octetBits = unpackOctetToBits(data[i])
    bits.push(...octetBits)
  }

  return {
    value: bits,
    remaining: new Uint8Array(0),
  }
}

/**
 * Encode bit sequence with length prefix
 *
 * @param bits - Array of boolean values representing bits
 * @returns Encoded octet sequence with length prefix
 */
export function encodeBitSequenceWithLength(bits: boolean[]): Uint8Array {
  const encodedBits = encodeBitSequence(bits)
  const length = bits.length

  // Encode length as natural number
  const encodedLength = encodeNatural(BigInt(length))

  const result = new Uint8Array(encodedLength.length + encodedBits.length)
  result.set(encodedLength, 0)
  result.set(encodedBits, encodedLength.length)

  return result
}

/**
 * Decode bit sequence with length prefix
 *
 * @param data - Octet sequence to decode
 * @returns Decoded bit array and remaining data
 */
export function decodeBitSequenceWithLength(data: Uint8Array): {
  value: boolean[]
  remaining: Uint8Array
} {
  // First decode the length
  const { value: length, remaining: lengthRemaining } = decodeNatural(data)
  const bitCount = Number(length)

  if (bitCount < 0 || bitCount > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid bit sequence length: ${length}`)
  }

  // Then decode the bit sequence
  const { value, remaining } = decodeBitSequence(lengthRemaining, bitCount)

  return { value, remaining }
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
