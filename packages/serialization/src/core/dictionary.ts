/**
 * Dictionary Serialization
 *
 * Implements dictionary encoding from Gray Paper Appendix D.1
 * encode(d ∈ dictionary{K,V}) ≡ encode(var{⟨⟨encode(k), encode(d[k])⟩⟩})
 */

import type { Uint8Array } from '../types'
import { decodeVariableLength, encodeVariableLength } from './discriminator'

/**
 * Dictionary entry with key-value pair
 */
export interface DictionaryEntry {
  key: Uint8Array
  value: Uint8Array
}

/**
 * Encode dictionary using Gray Paper dictionary encoding
 *
 * Formula from Gray Paper:
 * encode(d ∈ dictionary{K,V}) ≡ encode(var{⟨⟨encode(k), encode(d[k])⟩⟩})
 *
 * This orders pairs by key and encodes as variable-length sequence
 *
 * @param entries - Array of key-value pairs to encode
 * @returns Encoded octet sequence
 */
export function encodeDictionary(entries: DictionaryEntry[]): Uint8Array {
  // Sort entries by key (lexicographic order)
  const sortedEntries = [...entries].sort((a, b) => {
    const keyA = bytesToHex(a.key)
    const keyB = bytesToHex(b.key)
    return keyA.localeCompare(keyB)
  })

  // Encode each entry as ⟨encode(k), encode(d[k])⟩
  const encodedPairs: Uint8Array[] = sortedEntries.map(({ key, value }) => {
    // Concatenate key and value: ⟨encode(k), encode(d[k])⟩
    const pairData = new Uint8Array(key.length + value.length)
    pairData.set(key, 0)
    pairData.set(value, key.length)

    return pairData
  })

  // Concatenate all pairs into a sequence
  const concatenatedPairs = new Uint8Array(
    encodedPairs.reduce((sum, pair) => sum + pair.length, 0),
  )
  let offset = 0
  for (const pair of encodedPairs) {
    concatenatedPairs.set(pair, offset)
    offset += pair.length
  }

  // Encode as variable-length sequence: var{⟨⟨encode(k), encode(d[k])⟩⟩}
  return encodeVariableLength(concatenatedPairs)
}

/**
 * Decode dictionary using Gray Paper dictionary encoding
 *
 * Formula from Gray Paper:
 * encode(d ∈ dictionary{K,V}) ≡ encode(var{⟨⟨encode(k), encode(d[k])⟩⟩})
 *
 * @param data - Octet sequence to decode
 * @param keyLength - Fixed length of keys
 * @param valueLength - Fixed length of values (or -1 for variable length)
 * @returns Decoded dictionary and remaining data
 */
export function decodeDictionary(
  data: Uint8Array,
  keyLength: number,
  valueLength: number = -1,
): { value: DictionaryEntry[]; remaining: Uint8Array } {
  // Decode variable-length sequence: var{⟨⟨encode(k), encode(d[k])⟩⟩}
  const { value: concatenatedPairs, remaining } = decodeVariableLength(data)

  // If no data, return empty dictionary
  if (concatenatedPairs.length === 0) {
    return { value: [], remaining }
  }

  const result: DictionaryEntry[] = []
  let currentData = concatenatedPairs

  // Decode pairs until no data remains
  while (currentData.length >= keyLength) {
    try {
      // Extract key
      const key = currentData.slice(0, keyLength)
      currentData = currentData.slice(keyLength)

      // Extract value
      let value: Uint8Array
      if (valueLength === -1) {
        // Variable length value - take remaining data
        value = currentData
        currentData = new Uint8Array(0)
      } else if (currentData.length >= valueLength) {
        // Fixed length value
        value = currentData.slice(0, valueLength)
        currentData = currentData.slice(valueLength)
      } else {
        // Not enough data for value
        break
      }

      result.push({ key, value })
    } catch (error) {
      // If we can't decode more pairs, we're done
      break
    }
  }

  return { value: result, remaining }
}

/**
 * Helper function to convert Uint8Array to hex for comparison
 */
function bytesToHex(Uint8Array: Uint8Array): string {
  return Array.from(Uint8Array, byte => byte.toString(16).padStart(2, '0')).join('')
}
