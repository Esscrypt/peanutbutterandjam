/**
 * Set Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Serialization Codec
 * Formula (Equation 95-97):
 *
 * encode({a, b, c, ...}) ≡ encode(a) ∥ encode(b) ∥ encode(c) ∥ ...
 * where a < b < c < ...
 *
 * For any values which are sets and don't already have a defined encoding,
 * we define the serialization of a set as the serialization of the set's
 * elements in proper order.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Set encoding is similar to sequence encoding but with automatic ordering.
 * This ensures sets have deterministic serialization regardless of insertion order.
 *
 * Key differences from sequences:
 * - Automatic sorting: elements are ordered before encoding
 * - No duplicates: sets inherently contain unique elements
 * - Order-independent: {A, B} == {B, A} after serialization
 *
 * Process:
 * 1. Extract all elements from set
 * 2. Sort elements using their encoded representations
 * 3. Concatenate sorted encoded elements
 *
 * Example: {hash2, hash1} where hash1 < hash2 lexicographically
 * - Ordered: [hash1, hash2]
 * - Encoded: encode(hash1) ∥ encode(hash2)
 *
 * This is used for validator sets, peer sets, and other collections
 * where order doesn't matter but deterministic encoding is required.
 */

/**
 * Encode set using Gray Paper set encoding
 *
 * Formula from Gray Paper:
 * encode({a,b,c,...}) ≡ encode(a) ∥ encode(b) ∥ encode(c) ∥ ...
 *
 * This orders elements and concatenates their encodings
 *
 * @param set - Set of values to encode
 * @param encoder - Function to encode individual elements
 * @returns Encoded octet sequence
 */
export function encodeSet<T>(
  set: Set<T>,
  encoder: (value: T) => Uint8Array,
): Uint8Array {
  // Convert set to array and sort elements
  const elements = Array.from(set).sort((a, b) => {
    // For simple types, use string comparison
    const aStr = String(a)
    const bStr = String(b)
    return aStr.localeCompare(bStr)
  })

  // Encode each element
  const encodedElements = elements.map(encoder)

  // Concatenate all encodings
  const totalLength = encodedElements.reduce(
    (sum, element) => sum + element.length,
    0,
  )
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const element of encodedElements) {
    result.set(element, offset)
    offset += element.length
  }

  return result
}

/**
 * Decode set using Gray Paper set encoding
 *
 * @param data - Octet sequence to decode
 * @param decoder - Function to decode individual elements
 * @param elementCount - Number of elements to decode (if known)
 * @returns Decoded set and remaining data
 */
export function decodeSet<T>(
  data: Uint8Array,
  decoder: (data: Uint8Array) => { value: T; remaining: Uint8Array },
  elementCount?: number,
): { value: Set<T>; remaining: Uint8Array } {
  const set = new Set<T>()
  let currentData = data

  if (elementCount !== undefined) {
    // Decode specific number of elements
    for (let i = 0; i < elementCount; i++) {
      if (currentData.length === 0) {
        throw new Error(
          `Insufficient data for set decoding (expected ${elementCount} elements, got ${i})`,
        )
      }

      const { value, remaining } = decoder(currentData)
      set.add(value)
      currentData = remaining
    }
  } else {
    // Decode all available elements
    while (currentData.length > 0) {
      const { value, remaining } = decoder(currentData)
      set.add(value)
      currentData = remaining
    }
  }

  return { value: set, remaining: currentData }
}

/**
 * Encode set with length prefix
 *
 * @param set - Set of values to encode
 * @param encoder - Function to encode individual elements
 * @returns Encoded octet sequence with length prefix
 */
export function encodeSetWithLength<T>(
  set: Set<T>,
  encoder: (value: T) => Uint8Array,
): Uint8Array {
  const encoded = encodeSet(set, encoder)
  const length = set.size

  // Encode length as natural number
  const encodedLength = encodeNatural(BigInt(length))

  const result = new Uint8Array(encodedLength.length + encoded.length)
  result.set(encodedLength, 0)
  result.set(encoded, encodedLength.length)

  return result
}

/**
 * Decode set with length prefix
 *
 * @param data - Octet sequence to decode
 * @param decoder - Function to decode individual elements
 * @returns Decoded set and remaining data
 */
export function decodeSetWithLength<T>(
  data: Uint8Array,
  decoder: (data: Uint8Array) => { value: T; remaining: Uint8Array },
): { value: Set<T>; remaining: Uint8Array } {
  // First decode the length
  const { value: length, remaining: lengthRemaining } = decodeNatural(data)
  const elementCount = Number(length)

  if (elementCount < 0 || elementCount > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid set length: ${length}`)
  }

  // Then decode the set
  const { value, remaining } = decodeSet(lengthRemaining, decoder, elementCount)

  return { value, remaining }
}

// Import required functions
import { decodeNatural, encodeNatural } from './natural-number'
