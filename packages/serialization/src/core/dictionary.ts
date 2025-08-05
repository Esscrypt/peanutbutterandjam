/**
 * Dictionary Serialization
 *
 * Implements dictionary encoding from Gray Paper Appendix D.1
 * encode(d ∈ dictionary{K,V}) ≡ encode(var{⟨⟨encode(k), encode(d[k])⟩⟩})
 */

import type { OctetSequence } from '../types'
import { decodeVariableLength, encodeVariableLength } from './discriminator'

/**
 * Dictionary entry with key-value pair
 */
export interface DictionaryEntry<K, V> {
  key: K
  value: V
}

/**
 * Encode dictionary using Gray Paper dictionary encoding
 *
 * Formula from Gray Paper:
 * encode(d ∈ dictionary{K,V}) ≡ encode(var{⟨⟨encode(k), encode(d[k])⟩⟩})
 *
 * This orders pairs by key and encodes as variable-length sequence
 *
 * @param dictionary - Dictionary object to encode
 * @param keyEncoder - Function to encode keys
 * @param valueEncoder - Function to encode values
 * @returns Encoded octet sequence
 */
export function encodeDictionary<K, V>(
  dictionary: Record<string, V>,
  keyEncoder: (key: K) => OctetSequence,
  valueEncoder: (value: V) => OctetSequence,
): OctetSequence {
  // Convert dictionary to array of entries
  const entries: DictionaryEntry<K, V>[] = Object.entries(dictionary).map(
    ([key, value]) => ({
      key: key as K,
      value,
    }),
  )

  // Sort entries by key (lexicographic order for strings)
  entries.sort((a, b) => {
    const keyA = String(a.key)
    const keyB = String(b.key)
    return keyA.localeCompare(keyB)
  })

  // Encode each entry as ⟨encode(k), encode(d[k])⟩
  const encodedPairs: OctetSequence[] = entries.map((entry) => {
    const encodedKey = keyEncoder(entry.key)
    const encodedValue = valueEncoder(entry.value)

    // Concatenate key and value: ⟨encode(k), encode(d[k])⟩
    const pairData = new Uint8Array(encodedKey.length + encodedValue.length)
    pairData.set(encodedKey, 0)
    pairData.set(encodedValue, encodedKey.length)

    return pairData
  })

  // Encode as variable-length sequence: var{⟨⟨encode(k), encode(d[k])⟩⟩}
  const concatenatedPairs = new Uint8Array(
    encodedPairs.reduce((sum, pair) => sum + pair.length, 0),
  )
  let offset = 0
  for (const pair of encodedPairs) {
    concatenatedPairs.set(pair, offset)
    offset += pair.length
  }

  return encodeVariableLength(concatenatedPairs)
}

/**
 * Decode dictionary using Gray Paper dictionary encoding
 *
 * Formula from Gray Paper:
 * encode(d ∈ dictionary{K,V}) ≡ encode(var{⟨⟨encode(k), encode(d[k])⟩⟩})
 *
 * @param data - Octet sequence to decode
 * @param keyDecoder - Function to decode keys
 * @param valueDecoder - Function to decode values
 * @returns Decoded dictionary and remaining data
 */
export function decodeDictionary<K, V>(
  data: OctetSequence,
  keyDecoder: (data: OctetSequence) => { value: K; remaining: OctetSequence },
  valueDecoder: (data: OctetSequence) => { value: V; remaining: OctetSequence },
): { value: Record<string, V>; remaining: OctetSequence } {
  // Decode variable-length sequence: var{⟨⟨encode(k), encode(d[k])⟩⟩}
  const { value: concatenatedPairs, remaining } = decodeVariableLength(data)

  // If no data, return empty dictionary
  if (concatenatedPairs.length === 0) {
    return { value: {}, remaining }
  }

  // Decode each pair from the concatenated data
  const dictionary: Record<string, V> = {}
  let currentData = concatenatedPairs

  while (currentData.length > 0) {
    // Decode key: ⟨encode(k)
    const { value: key, remaining: keyRemaining } = keyDecoder(currentData)

    // Decode value: encode(d[k])⟩
    const { value, remaining: valueRemaining } = valueDecoder(keyRemaining)

    // Add to dictionary
    dictionary[String(key)] = value
    currentData = valueRemaining
  }

  return { value: dictionary, remaining }
}

/**
 * Encode dictionary with length prefix
 *
 * @param dictionary - Dictionary object to encode
 * @param keyEncoder - Function to encode keys
 * @param valueEncoder - Function to encode values
 * @returns Encoded octet sequence with length prefix
 */
export function encodeDictionaryWithLength<K, V>(
  dictionary: Record<string, V>,
  keyEncoder: (key: K) => OctetSequence,
  valueEncoder: (value: V) => OctetSequence,
): OctetSequence {
  const encoded = encodeDictionary(dictionary, keyEncoder, valueEncoder)
  const length = Object.keys(dictionary).length

  // Encode length as natural number
  const encodedLength = encodeNatural(BigInt(length))

  const result = new Uint8Array(encodedLength.length + encoded.length)
  result.set(encodedLength, 0)
  result.set(encoded, encodedLength.length)

  return result
}

/**
 * Decode dictionary with length prefix
 *
 * @param data - Octet sequence to decode
 * @param keyDecoder - Function to decode keys
 * @param valueDecoder - Function to decode values
 * @returns Decoded dictionary and remaining data
 */
export function decodeDictionaryWithLength<K, V>(
  data: OctetSequence,
  keyDecoder: (data: OctetSequence) => { value: K; remaining: OctetSequence },
  valueDecoder: (data: OctetSequence) => { value: V; remaining: OctetSequence },
): { value: Record<string, V>; remaining: OctetSequence } {
  // First decode the length
  const { value: length, remaining: lengthRemaining } = decodeNatural(data)
  const entryCount = Number(length)

  if (entryCount < 0 || entryCount > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid dictionary length: ${length}`)
  }

  // Then decode the dictionary
  const { value, remaining } = decodeDictionary(
    lengthRemaining,
    keyDecoder,
    valueDecoder,
  )

  return { value, remaining }
}

// Import required functions
import { decodeNatural, encodeNatural } from './natural-number'
