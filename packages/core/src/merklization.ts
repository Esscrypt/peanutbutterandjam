/**
 * Gray Paper Merklization Implementation
 *
 * Implements the binary Patricia Merkle Trie as specified in the Gray Paper
 * Reference: Gray Paper merklization.tex section D
 */

import { type Safe, safeError, safeResult } from './safe'
import { blake2bHash, bytesToHex, hexToBytes } from './utils/crypto'
import { validateHexString } from './utils/validation'

/**
 * Type for key-value pairs in the trie
 */
export interface KeyValuePair {
  key: Uint8Array // 31-byte key (Gray Paper specification)
  value: Uint8Array // Arbitrary length value
}

/**
 * Type for trie input (hex strings)
 */
export interface TrieInput {
  [key: string]: string // hex key -> hex value mapping
}

/**
 * Create a leaf hash according to Python implementation
 * @param key - State key (31 or 32 bytes)
 * @param value - Value Uint8Array
 * @returns Leaf hash as Buffer
 */
function createLeafHash(key: Uint8Array, value: Uint8Array): Buffer {
  const result = new Uint8Array(64)

  if (value.length <= 32) {
    // Your Python implementation: head = 0b10000000 | len(v)
    // This sets bit 7 to 1 and bits 0-6 to the length
    result[0] = 0b10000000 | value.length

    // Python implementation: k[:-1] - use first 31 bytes of key
    // If key is 32 bytes, truncate to 31 bytes. If already 31 bytes, use as-is.
    const keyToUse = key.length === 32 ? key.slice(0, 31) : key
    result.set(keyToUse, 1)

    // Python implementation: v + ((32 - len(v)) * b'\0')
    // Copy the value and pad with zeros
    result.set(value, 32)
    // Pad with zeros (already done by Uint8Array initialization)
  } else {
    // Your Python implementation: head = 0b11000000
    // This sets bits 7-6 to 1,1 and bits 0-5 to 0,0,0,0,0,0
    result[0] = 0b11000000

    // Python implementation: k[:-1] - use first 31 bytes of key
    // If key is 32 bytes, truncate to 31 bytes. If already 31 bytes, use as-is.
    const keyToUse = key.length === 32 ? key.slice(0, 31) : key
    result.set(keyToUse, 1)

    // Python implementation: hash(v)
    // Hash the value and copy
    const [valueHashError, valueHash] = blake2bHash(value)
    if (valueHashError) {
      throw valueHashError
    }
    const hashUint8Array = hexToBytes(valueHash)
    result.set(hashUint8Array, 32)
  }

  return Buffer.from(result)
}

/**
 * Check if a bit is set at position i in a key
 * @param key - 31-byte state key
 * @param i - Bit position
 * @returns True if bit is set
 */
function bit(key: Uint8Array, i: number): boolean {
  // Python implementation: (k[i >> 3] & (1 << (7 - i & 7))) != 0
  // This uses most significant bit first
  return (key[i >> 3] & (1 << (7 - (i & 7)))) !== 0
}

/**
 * Create branch hash according to Python implementation
 * @param left - Left child hash (32 bytes)
 * @param right - Right child hash (32 bytes)
 * @returns Branch encoding (64 bytes)
 */
function createBranchHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length !== 32 || right.length !== 32) {
    throw new Error('Branch children must be 32 bytes each')
  }

  const result = new Uint8Array(64)

  // Python implementation: head = l[0] & 0x7f
  // This sets the first bit to 0 and keeps bits 1-6 from left[0]
  result[0] = left[0] & 0x7f

  // Copy the remaining 31 bytes from left
  result.set(left.slice(1), 1)

  // Copy the full right hash (32 bytes)
  result.set(right, 32)

  return result
}

/**
 * Merklize a dictionary of key-value pairs according to Python implementation
 * @param keyValuePairs - Array of key-value pairs
 * @param i - Bit position (default 0)
 * @returns Safe result containing the merkle root hash
 */
export function merklize(
  keyValuePairs: KeyValuePair[],
  i = 0,
): Safe<Uint8Array> {
  try {
    if (keyValuePairs.length === 0) {
      // Python: return 32 * b'\0'
      return safeResult(new Uint8Array(32))
    }

    if (keyValuePairs.length === 1) {
      // Python: encoded = leaf(*kvs[0])
      const kvp = keyValuePairs[0]
      const leafHash = createLeafHash(kvp.key, kvp.value)
      const [hashError, hash] = blake2bHash(leafHash)
      if (hashError) {
        return safeError(hashError)
      }
      return safeResult(hexToBytes(hash))
    }

    // Python: split by bit(k, i) and recurse with i + 1
    const left: KeyValuePair[] = []
    const right: KeyValuePair[] = []

    for (const kvp of keyValuePairs) {
      if (bit(kvp.key, i)) {
        right.push(kvp)
      } else {
        left.push(kvp)
      }
    }

    // Python: encoded = branch(merkle(l, i + 1), merkle(r, i + 1))
    const [leftError, leftHash] = merklize(left, i + 1)
    if (leftError) {
      return safeError(leftError)
    }

    const [rightError, rightHash] = merklize(right, i + 1)
    if (rightError) {
      return safeError(rightError)
    }

    // Python: return hash(encoded)
    const branchHash = createBranchHash(leftHash, rightHash)
    const [hashError, hash] = blake2bHash(branchHash)
    if (hashError) {
      return safeError(hashError)
    }

    return safeResult(hexToBytes(hash))
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Compute merkle root from trace state using our Gray Paper implementation
 */
export function stateRoot(
  keyValuePairs: { key: string; value: string }[],
): string {
  // Convert to hex format for merklizeHex (31-byte keys as per Gray Paper)
  const hexKeyValues: Record<string, string> = {}
  for (const kvp of keyValuePairs) {
    const keyHex = kvp.key.startsWith('0x') ? kvp.key : `0x${kvp.key}`
    const valueHex = kvp.value.startsWith('0x') ? kvp.value : `0x${kvp.value}`
    hexKeyValues[keyHex] = valueHex
  }

  // Compute merkle root using strict Gray Paper implementation
  const [error, merkleRoot] = merklizeHex(hexKeyValues)
  if (error) {
    throw error
  }

  return bytesToHex(merkleRoot)
}

/**
 * Merklize hex input according to Gray Paper specification
 * @param input - Dictionary of hex key-value pairs
 * @param strictGrayPaper - If true, enforce 31-byte keys (Gray Paper). If false, allow 32-byte keys (test vectors)
 * @returns Safe result containing the merkle root hash
 */
export function merklizeHex(input: TrieInput): Safe<Uint8Array> {
  try {
    const keyValuePairs: KeyValuePair[] = []

    for (const [key, value] of Object.entries(input)) {
      // Normalize hex strings (remove 0x prefix if present)
      const normalizedKey = key.startsWith('0x') ? key.slice(2) : key
      const normalizedValue = value.startsWith('0x') ? value.slice(2) : value

      // Convert to Uint8Array (viem expects 0x prefix)
      const keyUint8Array = hexToBytes(`0x${normalizedKey}`)
      const valueUint8Array = hexToBytes(`0x${normalizedValue}`)

      keyValuePairs.push({
        key: keyUint8Array,
        value: valueUint8Array,
      })
    }

    return merklize(keyValuePairs)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Merklize function that works directly with Uint8Array inputs
 * @param keyValuePairs - Array of [key, value] pairs where both are Uint8Array
 * @param strictGrayPaper - Whether to enforce strict Gray Paper compliance (31-byte keys)
 * @returns Safe result containing the merkle root as Uint8Array
 */
export function merklizeBytes(
  keyValuePairs: [Uint8Array, Uint8Array][],
): Safe<Uint8Array> {
  try {
    const processedPairs: KeyValuePair[] = []

    for (const [key, value] of keyValuePairs) {
      processedPairs.push({
        key: key,
        value: value,
      })
    }

    return merklize(processedPairs)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Validate trie input format
 * @param input - Dictionary of hex key-value pairs
 * @returns Safe result containing validation errors if any
 */
export function validateTrieInput(input: TrieInput): Safe<void> {
  try {
    const errors: string[] = []

    for (const [key, value] of Object.entries(input)) {
      // Normalize hex strings
      const normalizedKey = key.startsWith('0x') ? key.slice(2) : key
      const normalizedValue = value.startsWith('0x') ? value.slice(2) : value

      // Validate key format
      const keyValidation = validateHexString(normalizedKey, 'key')
      if (!keyValidation.isValid) {
        errors.push(
          `Invalid key format for key "${key}": ${keyValidation.errors[0]?.message}`,
        )
      }

      // Validate value format
      const valueValidation = validateHexString(normalizedValue, 'value')
      if (!valueValidation.isValid) {
        errors.push(
          `Invalid value format for value "${value}": ${valueValidation.errors[0]?.message}`,
        )
      }
    }

    if (errors.length > 0) {
      return safeError(new Error(errors.join('; ')))
    }

    return safeResult(undefined)
  } catch (error) {
    return safeError(error as Error)
  }
}
