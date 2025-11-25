/**
 * Dictionary Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Serialization Codec
 * Formula (Equation 78-91):
 *
 * ∀ K, V: encode(d ∈ dictionary{K,V}) ≡
 *   encode(var{⟨orderby{k}{⟨encode(k), encode(d[k])⟩ | k ∈ keys(d)}⟩})
 *
 * Small dictionaries are encoded as a sequence of pairs ordered by the key.
 * In general, dictionaries are placed in the Merkle trie directly, but
 * small dictionaries may reasonably be encoded as shown above.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Dictionary encoding provides a deterministic way to serialize key-value maps.
 * The key insight is ordering: deterministic encoding requires consistent order.
 *
 * Process:
 * 1. Extract all key-value pairs from dictionary
 * 2. Sort pairs by key in lexicographic order
 * 3. Encode each key and value separately
 * 4. Concatenate all encoded pairs
 * 5. Wrap with variable-length discriminator
 *
 * Example: {B: "world", A: "hello"}
 * - Ordered: [(A, "hello"), (B, "world")]
 * - Encoded: var{encode(A) ∥ encode("hello") ∥ encode(B) ∥ encode("world")}
 *
 * This is used for small dictionaries that need to be embedded in other
 * structures. Large dictionaries use the Merkle trie for efficiency.
 */

import { bytesToHex } from '@pbnj/core'
import type { DecodingResult, Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { decodeVariableLength, encodeVariableLength } from './discriminator'
import { decodeNatural } from './natural-number'

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
export function encodeDictionary(entries: DictionaryEntry[]): Safe<Uint8Array> {
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
  valueLength: number,
): Safe<DecodingResult<DictionaryEntry[]>> {
  // Decode variable-length sequence: var{⟨⟨encode(k), encode(d[k])⟩⟩}
  // Gray Paper: var{x} = encode{len(x)} || encode{x}
  // So we decode the length prefix first, then process exactly that many bytes
  const [error, concatenatedPairsResult] = decodeVariableLength(data)
  if (error) {
    return safeError(error)
  }
  const concatenatedPairs = concatenatedPairsResult.value
  const remaining = concatenatedPairsResult.remaining

  // If no data, return empty dictionary
  if (concatenatedPairs.length === 0) {
    return safeResult({
      value: [],
      remaining,
      consumed: data.length - remaining.length,
    })
  }

  const result: DictionaryEntry[] = []
  let currentData = concatenatedPairs
  const totalPairsLength = concatenatedPairs.length
  let processedLength = 0

  // Decode pairs until we've processed all bytes in concatenatedPairs
  // We know the exact length from the var{} prefix, so we stop when processedLength >= totalPairsLength
  while (processedLength < totalPairsLength) {
    try {
      // Extract key
      let key: Uint8Array
      let keyConsumed: number
      if (keyLength === -1) {
        // Variable length key - decode length prefix to find where key ends
        // Keep the length prefix in the key (for nested decoding)
        const [keyLenError, keyLenResult] = decodeNatural(currentData)
        if (keyLenError) {
          break
        }
        const keyLen = Number(keyLenResult.value)
        const keyOffset = keyLenResult.consumed
        if (currentData.length < keyOffset + keyLen) {
          break
        }
        // Include length prefix in key (matches encoding where key includes length prefix)
        key = currentData.slice(0, keyOffset + keyLen)
        keyConsumed = keyOffset + keyLen
        currentData = currentData.slice(keyConsumed)
      } else {
        // Fixed length key
        if (currentData.length < keyLength) {
          break
        }
        key = currentData.slice(0, keyLength)
        keyConsumed = keyLength
        currentData = currentData.slice(keyConsumed)
      }

      // Extract value
      // Value length must be specified - variable-length values should be handled at a higher level
      if (currentData.length < valueLength) {
        // Not enough data for value
        break
      }
      const value = currentData.slice(0, valueLength)
      const valueConsumed = valueLength
      currentData = currentData.slice(valueLength)

      result.push({ key, value })
      
      // Update processed length
      const pairLength = keyConsumed + valueConsumed
      processedLength += pairLength
      
      // Check if we've processed all bytes
      if (processedLength >= totalPairsLength) {
        break
      }
    } catch (_error) {
      // If we can't decode more pairs, we're done
      break
    }
  }

  return safeResult({
    value: result,
    remaining,
    consumed: data.length - remaining.length,
  })
}
