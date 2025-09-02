/**
 * Compact Number Serialization
 *
 * *** DO NOT REMOVE - IMPLEMENTATION NOTE ***
 * This implements SCALE-like compact encoding for natural numbers.
 * While not explicitly in the Gray Paper serialization section, this
 * encoding format is used in JAM test vectors and follows the general
 * principle of efficient variable-length encoding from the Gray Paper.
 *
 * Based on Gray Paper's general serialization principles (Appendix D.1)
 * but with SCALE codec compatibility for test vector compliance.
 */

/**
 * Encode natural number using SCALE-like compact encoding
 *
 * Mode 0: single-byte (0-63)
 * Mode 1: two-byte (64-16383)
 * Mode 2: four-byte (16384-1073741823)
 * Mode 3: big-integer (>= 1073741824)
 *
 * @param value - Natural number to encode
 * @returns Encoded octet sequence
 */
export function encodeCompactNatural(value: bigint): Uint8Array {
  if (value < 0n) throw new Error(`Natural number cannot be negative: ${value}`)

  // Mode 0: single-byte (0-63)
  if (value <= 63n) {
    return new Uint8Array([Number(value)])
  }

  // Mode 1: two-byte (64-16383)
  if (value <= 16383n) {
    const result = new Uint8Array(2)
    result[0] = Number((value >> 6n) & 0x3fn) | 0x40
    result[1] = Number(value & 0x3fn)
    return result
  }

  // Mode 2: four-byte (16384-1073741823)
  if (value <= 1073741823n) {
    const result = new Uint8Array(4)
    result[0] = Number((value >> 30n) & 0x3n) | 0x80
    result[1] = Number((value >> 22n) & 0xffn)
    result[2] = Number((value >> 14n) & 0xffn)
    result[3] = Number((value >> 6n) & 0xffn)
    return result
  }

  // Mode 3: big-integer (>= 1073741824)
  const length = getCompactLength(value)
  const result = new Uint8Array(1 + length)
  result[0] = (length << 2) | 0x03

  // Write the value in little-endian
  for (let i = 0; i < length; i++) {
    result[1 + i] = Number((value >> BigInt(8 * i)) & 0xffn)
  }

  return result
}

/**
 * Decode natural number using SCALE-like compact encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded natural number and remaining data
 */
export function decodeCompactNatural(data: Uint8Array): {
  value: bigint
  remaining: Uint8Array
} {
  if (data.length === 0)
    throw new Error('Cannot decode compact natural number from empty data')

  const first = data[0]

  // Mode 0: single-byte (0-63)
  if ((first & 0x80) === 0) {
    return { value: BigInt(first), remaining: data.slice(1) }
  }

  // Mode 1: two-byte (64-16383)
  if ((first & 0xc0) === 0x40) {
    if (data.length < 2)
      throw new Error('Insufficient data for two-byte compact natural')
    const value = (BigInt(first & 0x3f) << 6n) | BigInt(data[1])
    return { value, remaining: data.slice(2) }
  }

  // Mode 2: four-byte (16384-1073741823)
  if ((first & 0xe0) === 0x80) {
    if (data.length < 4)
      throw new Error('Insufficient data for four-byte compact natural')
    let value = BigInt(first & 0x03) << 30n
    value |= BigInt(data[1]) << 22n
    value |= BigInt(data[2]) << 14n
    value |= BigInt(data[3]) << 6n
    return { value, remaining: data.slice(4) }
  }

  // Mode 3: big-integer (>= 1073741824)
  const length = first >> 2
  if (data.length < 1 + length)
    throw new Error('Insufficient data for big-integer compact natural')

  let value = 0n
  for (let i = 0; i < length; i++) {
    value |= BigInt(data[1 + i]) << BigInt(8 * i)
  }

  return { value, remaining: data.slice(1 + length) }
}

/**
 * Get the length needed to encode a value in big-integer mode
 */
function getCompactLength(value: bigint): number {
  let length = 4
  while (value >= 1n << BigInt(8 * length)) {
    length++
  }
  return length
}

/**
 * Get the encoded length of a compact natural number
 */
export function getCompactNaturalEncodedLength(value: bigint): number {
  if (value <= 63n) return 1
  if (value <= 16383n) return 2
  if (value <= 1073741823n) return 4
  return 1 + getCompactLength(value)
}
