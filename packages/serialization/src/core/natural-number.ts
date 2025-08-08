/**
 * Natural Number Serialization
 *
 * Implements fnencode: Nbits(64) → blob[1:9] from Gray Paper Appendix D.1
 * Variable-length encoding for natural numbers up to 2^64-1
 */

import type { Natural, Uint8Array } from '@pbnj/types'
import { GRAY_PAPER_CONSTANTS } from '@pbnj/types'

/**
 * Encode natural number using Gray Paper variable-length encoding
 *
 * Formula from Gray Paper:
 * encode(x) ≡ ⟨0⟩ when x = 0
 * encode(x) ≡ ⟨2^8-2^(8-l) + ⌊x/2^(8l)⌋⟩ ∥ encode[l](x mod 2^(8l)) when 2^(7l) ≤ x < 2^(7(l+1))
 * encode(x) ≡ ⟨2^8-1⟩ ∥ encode[8](x) when x < 2^64
 *
 * @param value - Natural number to encode (0 to 2^64-1)
 * @returns Encoded octet sequence (1-9 Uint8Array)
 */
export function encodeNatural(value: Natural): Uint8Array {
  if (value < 0n) throw new Error(`Natural number cannot be negative: ${value}`)
  if (value > 2n ** 64n - 1n)
    throw new Error('Natural number exceeds maximum value')

  const length = getNaturalEncodedLength(value)

  // Case 1: x = 0 (1 byte)
  if (value === 0n) return new Uint8Array([0])

  // Case 2: Simple encoding for values 1-127 (1 byte)
  if (length === 1) return new Uint8Array([Number(value)])

  // Case 3: Large number encoding (9 Uint8Array) - prefix 0xff
  if (length === 9) {
    const result = new Uint8Array(9)
    result[0] = 0xff // 2^8-1
    // encode[8](x) - little-endian encoding
    const valueStr = value.toString(16).padStart(16, '0')
    for (let i = 0; i < 8; i++) {
      const Uint8Arraytr = valueStr.slice((7 - i) * 2, (8 - i) * 2)
      result[1 + i] = Number.parseInt(Uint8Arraytr, 16)
    }
    return result
  }

  // Case 4: Variable-length encoding (2-8 Uint8Array)
  // Find the minimal l such that 2^(7l) ≤ x < 2^(7(l+1))
  let l = 1
  while (value >= 1n << BigInt(7 * (l + 1))) {
    l++
  }

  // Calculate prefix: 2^8-2^(8-l) + ⌊x/2^(8l)⌋
  const prefix = (1n << 8n) - (1n << BigInt(8 - l)) + (value >> BigInt(8 * l))

  // Calculate suffix: x mod 2^(8l)
  const suffix = value & ((1n << BigInt(8 * l)) - 1n)

  // Create result array
  const result = new Uint8Array(1 + l)
  result[0] = Number(prefix)

  // encode[l](suffix) - little-endian encoding
  const suffixStr = suffix.toString(16).padStart(l * 2, '0')
  for (let i = 0; i < l; i++) {
    const Uint8Arraytr = suffixStr.slice((l - 1 - i) * 2, (l - i) * 2)
    result[1 + i] = Number.parseInt(Uint8Arraytr, 16)
  }

  return result
}

/**
 * Decode natural number using Gray Paper variable-length encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded natural number and remaining data
 */
export function decodeNatural(data: Uint8Array): {
  value: Natural
  remaining: Uint8Array
} {
  if (data.length === 0)
    throw new Error('Cannot decode natural number from empty data')

  const first = data[0]

  // Case 1: x = 0
  if (first === 0) return { value: 0n, remaining: data.slice(1) }

  // Case 2: Simple encoding for values 1-127
  if (first <= 127) return { value: BigInt(first), remaining: data.slice(1) }

  // Case 3: Large number encoding (9 Uint8Array) - prefix 0xff
  if (first === 0xff) {
    if (data.length < 9)
      throw new Error('Insufficient data for large number encoding')
    let value = 0n
    // decode[8](x) - little-endian decoding
    for (let i = 0; i < 8; i++) {
      value |= BigInt(data[1 + i]) << BigInt(8 * i)
    }
    return { value, remaining: data.slice(9) }
  }

  // Case 4: Variable-length encoding
  // Determine l by finding which range the prefix falls into
  // The prefix is 2^8-2^(8-l) + ⌊x/2^(8l)⌋
  // We need to find l such that 2^(7l) ≤ x < 2^(7(l+1))

  let l = 1
  // Check each possible l value
  for (let testL = 1; testL <= 7; testL++) {
    const minPrefix = (1n << 8n) - (1n << BigInt(8 - testL))
    const maxPrefix =
      (1n << 8n) -
      (1n << BigInt(8 - testL)) +
      ((1n << BigInt(7 * (testL + 1))) >> BigInt(8 * testL)) -
      1n

    if (BigInt(first) >= minPrefix && BigInt(first) <= maxPrefix) {
      l = testL
      break
    }
  }

  if (data.length < 1 + l)
    throw new Error('Insufficient data for variable-length natural')

  // Extract the high bits from the prefix
  const prefix = BigInt(first)
  const minPrefix = (1n << 8n) - (1n << BigInt(8 - l))
  const highBits = (prefix - minPrefix) << BigInt(8 * l)

  // Extract the low bits from the suffix
  let lowBits = 0n
  for (let i = 0; i < l; i++) {
    lowBits |= BigInt(data[1 + i]) << BigInt(8 * i)
  }

  const value = highBits | lowBits
  return { value, remaining: data.slice(1 + l) }
}

/**
 * Get the encoded length of a natural number without encoding it
 *
 * @param value - Natural number
 * @returns Expected encoded length in Uint8Array
 */
export function getNaturalEncodedLength(value: Natural): number {
  if (value === 0n) return 1

  // Simple encoding for values 1-127
  if (value <= 127n) return 1

  // Large number encoding for values >= 2^56
  if (value >= 2n ** 56n) return 9

  // Find l such that 2^(7l) ≤ value < 2^(7(l+1))
  for (let l = 1; l <= 7; l++) {
    const lowerBound = 1n << BigInt(7 * l)
    const upperBound = 1n << BigInt(7 * (l + 1))

    if (value >= lowerBound && value < upperBound) {
      return 1 + l
    }
  }

  return 9 // Fallback to large number encoding
}
