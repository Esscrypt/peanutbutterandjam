/**
 * Gray Paper Merklization Implementation
 *
 * Implements the binary Patricia Merkle Trie as specified in the Gray Paper
 * Reference: Gray Paper merklization.tex section D
 */

import type { Hex } from 'viem'
import { type Safe, safeError, safeResult } from './safe'
import { blake2bHash, bytesToHex, hexToBytes } from './utils/crypto'
import { validateHexString } from './utils/validation'

/**
 * Type for key-value pairs in the trie
 */
export interface KeyValuePair {
  key: Uint8Array // 32-byte key
  value: Uint8Array // Arbitrary length value
}

/**
 * Type for trie input (hex strings)
 */
export interface TrieInput {
  [key: string]: string // hex key -> hex value mapping
}

/**
 * Get the i-th bit from a byte array
 * @param data - Byte array
 * @param i - Bit index
 * @returns Boolean value of the bit
 */
function getBit(data: Uint8Array, i: number): boolean {
  const byteIndex = i >> 3
  const bitIndex = i & 7
  return (data[byteIndex] & (1 << bitIndex)) !== 0
}

/**
 * Branch node encoding (GP 286)
 * Creates a 64-byte branch node from left and right child hashes
 * @param left - Left child hash (32 Uint8Array)
 * @param right - Right child hash (32 Uint8Array)
 * @returns 64-byte encoded branch node
 */
function encodeBranch(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length !== 32 || right.length !== 32) {
    throw new Error('Branch children must be 32 Uint8Array each')
  }

  const result = new Uint8Array(64)

  // First bit is 0 for branch nodes
  result[0] = left[0] & 0xfe // Clear the first bit

  // Copy left child (last 255 bits)
  result.set(left.slice(1), 1)

  // Copy right child (full 256 bits)
  result.set(right, 32)

  return result
}

/**
 * Leaf node encoding (GP 287)
 * Creates a 64-byte leaf node from key and value
 * @param key - 31-byte state key
 * @param value - Value Uint8Array
 * @returns 64-byte encoded leaf node
 */
function encodeLeaf(key: Uint8Array, value: Uint8Array): Uint8Array {
  if (key.length !== 31) {
    throw new Error('Leaf key must be 31 Uint8Array')
  }

  const result = new Uint8Array(64)

  if (value.length <= 32) {
    // Embedded-value leaf
    // First bit is 1, second bit is 0
    result[0] = 0x01 | (value.length << 2)

    // Copy key (31 Uint8Array)
    result.set(key, 1)

    // Copy value and pad with zeros
    result.set(value, 32)
    // Remaining Uint8Array are already zero
  } else {
    // Regular leaf
    // First bit is 1, second bit is 1
    result[0] = 0x03

    // Copy key (31 Uint8Array)
    result.set(key, 1)

    // Copy hash of value (32 Uint8Array)
    const [valueHashError, valueHash] = blake2bHash(value)
    if (valueHashError) {
      throw valueHashError
    }
    const hashUint8Array = hexToBytes(valueHash)
    result.set(hashUint8Array, 32)
  }

  return result
}

/**
 * Main merklization function (GP 289)
 * @param keyValuePairs - Array of key-value pairs
 * @param bitIndex - Current bit index for trie traversal
 * @returns 32-byte merkle root hash
 */
export function merklize(
  keyValuePairs: KeyValuePair[],
  bitIndex = 0,
): Safe<Uint8Array> {
  if (keyValuePairs.length === 0) {
    // Empty trie returns zero hash
    return safeResult(new Uint8Array(32))
  }

  if (keyValuePairs.length === 1) {
    // Single leaf node
    const { key, value } = keyValuePairs[0]
    const encoded = encodeLeaf(key, value)
    const [hashResultError, hashResult] = blake2bHash(encoded)
    if (hashResultError) {
      return safeError(hashResultError)
    }
    return safeResult(hexToBytes(hashResult))
  }

  // Split by current bit
  const left: KeyValuePair[] = []
  const right: KeyValuePair[] = []

  for (const { key, value } of keyValuePairs) {
    if (getBit(key, bitIndex)) {
      right.push({ key, value })
    } else {
      left.push({ key, value })
    }
  }

  // Recursively compute child hashes
  const [leftHashError, leftHash] = merklize(left, bitIndex + 1)
  if (leftHashError) {
    return safeError(leftHashError)
  }
  const [rightHashError, rightHash] = merklize(right, bitIndex + 1)
  if (rightHashError) {
    return safeError(rightHashError)
  }

  // Encode branch node
  const encoded = encodeBranch(leftHash, rightHash)
  const [hashResultError, hashResult] = blake2bHash(encoded)
  if (hashResultError) {
    return safeError(hashResultError)
  }
  return safeResult(hexToBytes(hashResult))
}

/**
 * Convert hex input to key-value pairs and compute merkle root
 * @param input - Object mapping hex keys to hex values
 * @returns Hex string of merkle root
 */
export function merklizeHex(input: TrieInput): Safe<Uint8Array> {
  const keyValuePairs: KeyValuePair[] = []

  for (const [hexKey, hexValue] of Object.entries(input)) {
    // Ensure hex strings have 0x prefix for viem
    const normalizedKey: Hex = (
      hexKey.startsWith('0x') ? hexKey : `0x${hexKey}`
    ) as `0x${string}`

    // Validate key format
    const keyValidation = validateHexString(normalizedKey, 'key', 64) // 32 Uint8Array = 64 hex chars
    if (!keyValidation.isValid) {
      return safeError(
        new Error(`Invalid key format: ${keyValidation.errors[0]?.message}`),
      )
    }

    // Handle empty values (they represent empty byte arrays)
    let normalizedValue: Hex
    if (hexValue === '') {
      normalizedValue = '0x' // Empty hex string
    } else {
      normalizedValue = (
        hexValue.startsWith('0x') ? hexValue : `0x${hexValue}`
      ) as `0x${string}`

      // Validate non-empty value format
      const valueValidation = validateHexString(normalizedValue, 'value')
      if (!valueValidation.isValid) {
        return safeError(
          new Error(
            `Invalid value format: ${valueValidation.errors[0]?.message}`,
          ),
        )
      }
    }

    // Use viem's hexToBytes for consistent hex handling
    const keyUint8Array = hexToBytes(normalizedKey)
    const valueUint8Array = hexToBytes(normalizedValue)

    // Keys must be 32 Uint8Array, we take the first 31 Uint8Array for the leaf
    if (keyUint8Array.length !== 32) {
      return safeError(
        new Error(`Key must be 32 Uint8Array, got ${keyUint8Array.length}`),
      )
    }

    // Remove the last byte to get 31-byte state key
    const stateKey = keyUint8Array.slice(0, 31)

    keyValuePairs.push({
      key: stateKey,
      value: valueUint8Array,
    })
  }

  const [rootHashError, rootHash] = merklize(keyValuePairs)
  if (rootHashError) {
    return safeError(rootHashError)
  }
  // Remove 0x prefix to match test vector format
  return safeResult(rootHash)
}

/**
 * Verify merklization against test vectors
 * @param testVectors - Array of test cases
 * @returns Array of verification results
 */
export function verifyTestVectors(
  testVectors: Array<{ input: TrieInput; output: Hex }>,
): Array<{ passed: boolean; expected: string; actual: Uint8Array }> {
  return testVectors.map(({ input, output }) => {
    const [actualError, actual] = merklizeHex(input)
    if (actualError) {
      throw actualError
    }
    const passed = bytesToHex(actual) === output
    return { passed, expected: output, actual }
  })
}

/**
 * Validate trie input format
 * @param input - Trie input to validate
 * @returns Validation result
 */
export function validateTrieInput(input: unknown): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (typeof input !== 'object' || input === null) {
    return { isValid: false, errors: ['Input must be an object'] }
  }

  const inputObj = input as Record<string, unknown>

  for (const [key, value] of Object.entries(inputObj)) {
    // Validate key format
    if (typeof key !== 'string') {
      errors.push(`Key must be a string, got ${typeof key}`)
      continue
    }

    const keyValidation = validateHexString(key, 'key', 64)
    if (!keyValidation.isValid) {
      errors.push(
        `Invalid key format for key "${key}": ${keyValidation.errors[0]?.message}`,
      )
    }

    // Validate value format
    if (typeof value !== 'string') {
      errors.push(
        `Value must be a string for key "${key}", got ${typeof value}`,
      )
      continue
    }

    const valueValidation = validateHexString(value, 'value')
    if (!valueValidation.isValid) {
      errors.push(
        `Invalid value format for key "${key}": ${valueValidation.errors[0]?.message}`,
      )
    }
  }

  return { isValid: errors.length === 0, errors }
}
