/**
 * Gray Paper Merklization Implementation
 *
 * Implements the binary Patricia Merkle Trie as specified in the Gray Paper
 * Reference: Gray Paper merklization.tex section D
 */

import { keccak_256 } from '@noble/hashes/sha3.js'
import type { Encoder, Safe } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
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
  // Convert to hex format for merklizeState (31-byte keys as per Gray Paper)
  const hexKeyValues: Record<string, string> = {}
  for (const kvp of keyValuePairs) {
    const keyHex = kvp.key.startsWith('0x') ? kvp.key : `0x${kvp.key}`
    const valueHex = kvp.value.startsWith('0x') ? kvp.value : `0x${kvp.value}`
    hexKeyValues[keyHex] = valueHex
  }

  // Compute merkle root using strict Gray Paper implementation
  const [error, merkleRoot] = merklizeState(hexKeyValues)
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
export function merklizeState(input: TrieInput): Safe<Uint8Array> {
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

// ============================================================================
// ADDITIONAL MERKLIZATION METHODS (Gray Paper Appendix)
// ============================================================================

/**
 * Hash function type for merklization
 */
export type HashFunction = (data: Uint8Array) => Safe<Uint8Array>

/**
 * Default BLAKE2b hash function
 */
export function defaultBlake2bHash(data: Uint8Array): Safe<Uint8Array> {
  const [error, hash] = blake2bHash(data)
  if (error) {
    return safeError(error)
  }
  return safeResult(hexToBytes(hash))
}

/**
 * Default Keccak hash function (for MMR compatibility)
 */
export function defaultKeccakHash(data: Uint8Array): Safe<Uint8Array> {
  try {
    const hash = keccak_256(data)
    return safeResult(hash)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Well-Balanced Binary Merkle Tree
 *
 * Gray Paper Reference: merklization.tex (Equations 213-222)
 *
 * When to use:
 * - Erasure root generation
 * - Small data sequences (≤32 bytes per item)
 * - Accumulation output logs
 *
 * Formula: merklizewb(v, H) ≡ {
 *   zerohash when |v| = 0
 *   H(v₀) when |v| = 1
 *   N(v, H) otherwise
 * }
 *
 * @param values - Sequence of byte arrays to merklize
 * @param hashFn - Hash function to use (defaults to blake2b, use keccak for accoutBelt)
 */
export function merklizewb(
  values: Uint8Array[],
  hashFn: HashFunction = defaultBlake2bHash,
): Safe<Uint8Array> {
  if (values.length === 0) {
    // Gray Paper: merklizewb([]) = zerohash (32 bytes of zeros)
    return safeResult(new Uint8Array(32))
  }

  if (values.length === 1) {
    // Single value: hash it directly per Gray Paper Equation 218
    return hashFn(values[0])
  }

  // Multiple values: use Gray Paper node function N per Equation 219
  return merkleNodeWB(values, hashFn)
}

/**
 * Merkle Node Function (N) for Well-Balanced Trees
 *
 * Gray Paper Reference: merklization.tex (Equation 174-182)
 *
 * N(v, H) ≡ {
 *   zerohash when |v| = 0
 *   v₀ when |v| = 1
 *   H($node concat N(left, H) concat N(right, H)) otherwise
 * }
 */
function merkleNodeWB(
  values: Uint8Array[],
  hashFn: HashFunction = defaultBlake2bHash,
): Safe<Uint8Array> {
  if (values.length === 0) {
    return safeResult(new Uint8Array(32)) // Zero hash
  }

  if (values.length === 1) {
    // Return the value itself (not hashed) per Gray Paper Equation 178
    return safeResult(values[0])
  }

  // Split into two halves using ceil(len/2)
  const mid = Math.ceil(values.length / 2)
  const left = values.slice(0, mid)
  const right = values.slice(mid)

  // Recursively compute left and right subtrees
  const [leftError, leftHash] = merkleNodeWB(left, hashFn)
  if (leftError) {
    return safeError(leftError)
  }

  const [rightError, rightHash] = merkleNodeWB(right, hashFn)
  if (rightError) {
    return safeError(rightError)
  }

  // Hash the concatenation with "$node" prefix per Gray Paper Equation 179
  const nodePrefix = new TextEncoder().encode('node')
  const combined = new Uint8Array(
    nodePrefix.length + leftHash.length + rightHash.length,
  )
  combined.set(nodePrefix, 0)
  combined.set(leftHash, nodePrefix.length)
  combined.set(rightHash, nodePrefix.length + leftHash.length)

  return hashFn(combined)
}

/**
 * Constant-Depth Binary Merkle Tree
 *
 * Gray Paper Reference: merklization.tex (Equations 232-246)
 *
 * When to use:
 * - Segments root generation
 * - Large data sequences where uniform depth is needed
 * - When proof size optimization is critical
 *
 * Formula: merklizecd(v) ≡ N(C(v))
 */
export function merklizecd(values: Uint8Array[]): Safe<Uint8Array> {
  // Apply constancy preprocessor C(v) per Gray Paper Equation 254-264
  const [cError, processedValues] = constancyPreprocessor(values)
  if (cError) {
    return safeError(cError)
  }

  // Apply node function to processed values per Gray Paper Equation 234
  return merkleNodeCD(processedValues)
}

/**
 * Constancy Preprocessor Function (C)
 *
 * Gray Paper Reference: merklization.tex (Equations 253-264)
 *
 * C(v) ≡ v' where:
 *   |v'| = 2^ceil(log₂(max(1, |v|)))
 *   v'ᵢ = H($leaf concat vᵢ) when i < |v|
 *   v'ᵢ = zerohash otherwise
 */
function constancyPreprocessor(values: Uint8Array[]): Safe<Uint8Array[]> {
  if (values.length === 0) {
    return safeResult([])
  }

  // Calculate next power of 2 per Gray Paper Equation 257
  const nextPowerOf2 = 2 ** Math.ceil(Math.log2(Math.max(1, values.length)))

  const processedValues: Uint8Array[] = []
  const leafPrefix = new TextEncoder().encode('$leaf')

  // Process each value per Gray Paper Equation 258-261
  for (let i = 0; i < nextPowerOf2; i++) {
    if (i < values.length) {
      // Hash with "$leaf" prefix per Equation 259
      const prefixed = new Uint8Array(leafPrefix.length + values[i].length)
      prefixed.set(leafPrefix, 0)
      prefixed.set(values[i], leafPrefix.length)

      const [hashError, hash] = defaultBlake2bHash(prefixed)
      if (hashError) {
        return safeError(hashError)
      }
      processedValues.push(hash)
    } else {
      // Pad with zero hash per Equation 260
      processedValues.push(new Uint8Array(32))
    }
  }

  return safeResult(processedValues)
}

/**
 * Merkle Node Function (N) for Constant-Depth Trees
 *
 * Same as merkleNodeWB but used for constant-depth trees
 */
function merkleNodeCD(values: Uint8Array[]): Safe<Uint8Array> {
  if (values.length === 0) {
    return safeResult(new Uint8Array(32)) // Zero hash
  }

  if (values.length === 1) {
    // Return the value itself (not hashed)
    return safeResult(values[0])
  }

  // Split into two halves using ceil(len/2)
  const mid = Math.ceil(values.length / 2)
  const left = values.slice(0, mid)
  const right = values.slice(mid)

  // Recursively compute left and right subtrees
  const [leftError, leftHash] = merkleNodeCD(left)
  if (leftError) {
    return safeError(leftError)
  }

  const [rightError, rightHash] = merkleNodeCD(right)
  if (rightError) {
    return safeError(rightError)
  }

  // Hash the concatenation with "node" prefix
  const nodePrefix = new TextEncoder().encode('node')
  const combined = new Uint8Array(
    nodePrefix.length + leftHash.length + rightHash.length,
  )
  combined.set(nodePrefix, 0)
  combined.set(leftHash, nodePrefix.length)
  combined.set(rightHash, nodePrefix.length + leftHash.length)

  return defaultBlake2bHash(combined)
}

/**
 * Merkle Mountain Range (MMR) Types
 */
export type MMRPeak = Uint8Array | null
export type MMRRange = MMRPeak[]

/**
 * MMR Append Function
 *
 * Gray Paper Reference: merklization.tex (Equations 275-295)
 *
 * When to use:
 * - Append-only data structures
 * - Historical data commitments
 * - Accumulation output belts
 *
 * Formula: mmrappend(r, l, H) ≡ P(r, l, 0, H)
 */
export function mmrappend(
  range: MMRRange,
  leaf: Uint8Array,
  hashFunction: HashFunction = defaultKeccakHash,
): Safe<MMRRange> {
  try {
    return mmrAppendHelper(range, leaf, 0, hashFunction)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * MMR Append Helper Function (P)
 *
 * Gray Paper Reference: merklization.tex (Equations 282-294)
 */
function mmrAppendHelper(
  range: MMRRange,
  leaf: Uint8Array,
  n: number,
  hashFunction: HashFunction,
): Safe<MMRRange> {
  try {
    if (n >= range.length) {
      // Append new peak
      return safeResult([...range, leaf])
    }

    if (range[n] === null) {
      // Replace null with leaf
      const newRange = [...range]
      newRange[n] = leaf
      return safeResult(newRange)
    }

    // Merge with existing peak and recurse
    const existingPeak = range[n]
    if (!existingPeak) {
      return safeError(new Error('Unexpected null peak'))
    }
    const combined = new Uint8Array(existingPeak.length + leaf.length)
    combined.set(existingPeak, 0)
    combined.set(leaf, existingPeak.length)

    const [hashError, mergedHash] = hashFunction(combined)
    if (hashError) {
      return safeError(hashError)
    }

    const newRange = [...range]
    newRange[n] = null
    return mmrAppendHelper(newRange, mergedHash, n + 1, hashFunction)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * MMR Super-Peak Function
 *
 * Gray Paper Reference: merklization.tex (Equations 305-316)
 *
 * Creates a single hash commitment to the entire MMR
 */
export function mmrsuperpeak(
  range: MMRRange,
  hashFunction: HashFunction = defaultKeccakHash,
): Safe<Uint8Array> {
  try {
    // Filter out null peaks
    const nonNullPeaks = range.filter(
      (peak): peak is Uint8Array => peak !== null,
    )

    if (nonNullPeaks.length === 0) {
      return safeResult(new Uint8Array(32)) // Zero hash
    }

    if (nonNullPeaks.length === 1) {
      return safeResult(nonNullPeaks[0])
    }

    // Recursively hash peaks with "$peak" prefix
    return mmrSuperPeakHelper(nonNullPeaks, hashFunction)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * MMR Super-Peak Helper
 */
function mmrSuperPeakHelper(
  peaks: Uint8Array[],
  hashFunction: HashFunction,
): Safe<Uint8Array> {
  try {
    if (peaks.length === 1) {
      return safeResult(peaks[0])
    }

    // Take the last peak and hash with previous super-peak
    const lastPeak = peaks[peaks.length - 1]
    const previousPeaks = peaks.slice(0, -1)

    const [prevError, prevSuperPeak] = mmrSuperPeakHelper(
      previousPeaks,
      hashFunction,
    )
    if (prevError) {
      return safeError(prevError)
    }

    // Hash with "peak" prefix (without $)
    const peakPrefix = new TextEncoder().encode('peak')
    const combined = new Uint8Array(
      peakPrefix.length + prevSuperPeak.length + lastPeak.length,
    )
    combined.set(peakPrefix, 0)
    combined.set(prevSuperPeak, peakPrefix.length)
    combined.set(lastPeak, peakPrefix.length + prevSuperPeak.length)

    return hashFunction(combined)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * MMR Encode Function
 *
 * Gray Paper Reference: merklization.tex (Equations 297-303)
 *
 * Encodes MMR range as a blob for storage/transmission
 */
export function mmrencode(range: MMRRange): Safe<Uint8Array> {
  try {
    // Convert MMR range to sequence of optional hashes
    const optionalHashes = range.map((peak) => peak ?? null)

    // Create encoder for optional Uint8Array (null or hash)
    const optionalHashEncoder: Encoder<Uint8Array | null> = (hash) => {
      if (hash === null) {
        // Encode null as single byte 0
        return safeResult(new Uint8Array([0]))
      } else {
        // Encode hash as length + data
        const lengthBytes = new Uint8Array(4)
        const view = new DataView(lengthBytes.buffer)
        view.setUint32(0, hash.length, true) // little-endian
        const result = new Uint8Array(lengthBytes.length + hash.length)
        result.set(lengthBytes, 0)
        result.set(hash, lengthBytes.length)
        return safeResult(result)
      }
    }

    // Encode sequence with length prefix (minimal implementation to avoid codec dependency)
    const parts: Uint8Array[] = []

    // Encode length as 4-byte little-endian
    const lengthBytes = new Uint8Array(4)
    const lengthView = new DataView(lengthBytes.buffer)
    lengthView.setUint32(0, optionalHashes.length, true) // little-endian
    parts.push(lengthBytes)

    // Encode each element
    for (const hash of optionalHashes) {
      const [error, encoded] = optionalHashEncoder(hash)
      if (error) {
        return safeError(error)
      }
      parts.push(encoded)
    }

    // Concatenate all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const part of parts) {
      result.set(part, offset)
      offset += part.length
    }

    return safeResult(result)
  } catch (error) {
    return safeError(error as Error)
  }
}

// ============================================================================
// BOUNDARY NODE METHODS
// ============================================================================

/**
 * Get boundary node for a specific key-value pair (Leaf node)
 *
 * Gray Paper Reference: merklization.tex (Equations 143-150)
 *
 * Creates a 64-byte (512-bit) boundary node of type L (Leaf)
 *
 * @param key - State key (31 bytes)
 * @param value - Value
 * @returns Safe<Uint8Array> - 64-byte boundary node (Leaf type)
 */
export function getLeafBoundaryNode(
  key: Uint8Array,
  value: Uint8Array,
): Safe<Uint8Array> {
  const leafHash = createLeafHash(key, value)
  return safeResult(new Uint8Array(leafHash))
}

/**
 * Get boundary node for a branch (Branch node)
 *
 * Gray Paper Reference: merklization.tex (Equations 139-142)
 *
 * Creates a 64-byte (512-bit) boundary node of type B (Branch)
 *
 * @param left - Left child hash (32 bytes)
 * @param right - Right child hash (32 bytes)
 * @returns Safe<Uint8Array> - 64-byte boundary node (Branch type)
 */
export function getBranchBoundaryNode(
  left: Uint8Array,
  right: Uint8Array,
): Safe<Uint8Array> {
  const branchHash = createBranchHash(left, right)
  return safeResult(branchHash)
}

// ============================================================================
// MERKLE INCLUSION PROOF METHODS
// ============================================================================

/**
 * Merkle Proof Types
 */
export interface MerkleProof {
  path: Uint8Array[] // Path from leaf to root
  leafIndex: number // Index of the leaf in the original sequence
  treeSize: number // Total number of elements in the tree
}

/**
 * Generate Merkle inclusion proof for well-balanced tree
 *
 * Gray Paper Reference: merklization.tex (Equations 187-207)
 *
 * Uses the trace function T to generate proof path
 */
export function generateWellBalancedProof(
  values: Uint8Array[],
  leafIndex: number,
): Safe<MerkleProof> {
  if (leafIndex < 0 || leafIndex >= values.length) {
    return safeError(new Error('Leaf index out of range'))
  }

  if (values.length === 1) {
    // Single value: empty proof path per Gray Paper
    return safeResult({
      path: [],
      leafIndex,
      treeSize: 1,
    })
  }

  // Use Gray Paper trace function T per Equation 187-207
  const [traceError, trace] = merkleTrace(values, leafIndex)
  if (traceError) {
    return safeError(traceError)
  }

  return safeResult({
    path: trace,
    leafIndex,
    treeSize: values.length,
  })
}

/**
 * Merkle Trace Function (T)
 *
 * Gray Paper Reference: merklization.tex (Equations 187-207)
 *
 * T(v, i) ≡ [N(P⊥(v, i))] concat T(P⊤(v, i), i - P_I(v, i)) when |v| > 1
 * T(v, i) ≡ [] otherwise
 *
 * Returns opposite nodes from top to bottom as tree is navigated to leaf
 */
function merkleTrace(
  values: Uint8Array[],
  leafIndex: number,
): Safe<Uint8Array[]> {
  if (values.length <= 1) {
    return safeResult([])
  }

  const mid = Math.ceil(values.length / 2)

  if (leafIndex < mid) {
    // Leaf is in left subtree per Gray Paper Equation 196
    const rightSubtree = values.slice(mid)
    const [rightError, rightHash] = merkleNodeWB(rightSubtree)
    if (rightError) {
      return safeError(rightError)
    }

    const leftSubtree = values.slice(0, mid)
    const [leftTraceError, leftTrace] = merkleTrace(leftSubtree, leafIndex)
    if (leftTraceError) {
      return safeError(leftTraceError)
    }

    return safeResult([rightHash, ...leftTrace])
  } else {
    // Leaf is in right subtree per Gray Paper Equation 197
    const leftSubtree = values.slice(0, mid)
    const [leftError, leftHash] = merkleNodeWB(leftSubtree)
    if (leftError) {
      return safeError(leftError)
    }

    const rightSubtree = values.slice(mid)
    const [rightTraceError, rightTrace] = merkleTrace(
      rightSubtree,
      leafIndex - mid,
    )
    if (rightTraceError) {
      return safeError(rightTraceError)
    }

    return safeResult([leftHash, ...rightTrace])
  }
}

/**
 * Verify Merkle inclusion proof
 *
 * Gray Paper Reference: merklization.tex (Equations 187-207, 213-222)
 *
 * The verification reconstructs the merkle root by:
 * 1. Starting with the leaf value
 * 2. For each sibling in the proof path (from top to bottom):
 *    - Combine current with sibling using N's logic
 *    - Move up one level in the tree
 * 3. Compare final result with expected root
 */
export function verifyMerkleProof(
  leaf: Uint8Array,
  proof: MerkleProof,
  expectedRoot: Uint8Array,
): Safe<boolean> {
  if (proof.path.length === 0) {
    // Single value case per Gray Paper Equation 218: merklizewb(v) = H(v₀)
    const [leafHashError, leafHash] = defaultBlake2bHash(leaf)
    if (leafHashError) {
      return safeError(leafHashError)
    }

    const isValid =
      leafHash.length === expectedRoot.length &&
      leafHash.every((byte, index) => byte === expectedRoot[index])

    return safeResult(isValid)
  }

  // Reconstruct the root by simulating the tree construction
  // The proof path contains N(opposite_subtree) for each level
  const [reconstructError, reconstructedRoot] = reconstructRoot(
    leaf,
    proof.path,
    proof.leafIndex,
    proof.treeSize,
  )
  if (reconstructError) {
    return safeError(reconstructError)
  }

  // Compare with expected root
  const isValid =
    reconstructedRoot.length === expectedRoot.length &&
    reconstructedRoot.every((byte, index) => byte === expectedRoot[index])

  return safeResult(isValid)
}

/**
 * Reconstruct the merkle root from a leaf and its proof path
 *
 * Gray Paper Reference: merklization.tex Equations 187-207, 196-202
 *
 * The tree uses ceil(len/2) splitting per Gray Paper Equation 196.
 * We simulate the trace function in reverse: top-down tree navigation.
 */
export function reconstructRoot(
  leaf: Uint8Array,
  proofPath: Uint8Array[],
  leafIndex: number,
  treeSize: number,
): Safe<Uint8Array> {
  // Navigate down the tree to find which subtree the leaf is in at each level
  // This builds the path structure
  const subtreeSizes: number[] = []
  const isLeftFlags: boolean[] = []

  let currentSize = treeSize
  let currentIndex = leafIndex

  // Navigate top-down to record the tree structure
  for (let level = 0; level < proofPath.length; level++) {
    const mid = Math.ceil(currentSize / 2)
    const isLeft = currentIndex < mid

    subtreeSizes.push(currentSize)
    isLeftFlags.push(isLeft)

    if (!isLeft) {
      currentIndex = currentIndex - mid
      currentSize = currentSize - mid // Right subtree size
    } else {
      currentSize = mid // Left subtree size
    }
  }

  // Now reconstruct bottom-up using the recorded structure
  let currentNode = leaf

  for (let i = proofPath.length - 1; i >= 0; i--) {
    const sibling = proofPath[i]
    const isLeftChild = isLeftFlags[i]

    const [combineError, parentNode] = combineNodes(
      currentNode,
      sibling,
      isLeftChild,
    )
    if (combineError) {
      return safeError(combineError)
    }

    currentNode = parentNode
  }

  return safeResult(currentNode)
}

/**
 * Combine two nodes according to Gray Paper node function logic
 *
 * Per Gray Paper Equation 179:
 * N(v) = H($node concat N(left) concat N(right))
 */
function combineNodes(
  current: Uint8Array,
  sibling: Uint8Array,
  currentIsLeft: boolean,
): Safe<Uint8Array> {
  const nodePrefix = new TextEncoder().encode('node')

  let combined: Uint8Array
  if (currentIsLeft) {
    // Current is left, sibling is right
    combined = new Uint8Array(
      nodePrefix.length + current.length + sibling.length,
    )
    combined.set(nodePrefix, 0)
    combined.set(current, nodePrefix.length)
    combined.set(sibling, nodePrefix.length + current.length)
  } else {
    // Current is right, sibling is left
    combined = new Uint8Array(
      nodePrefix.length + sibling.length + current.length,
    )
    combined.set(nodePrefix, 0)
    combined.set(sibling, nodePrefix.length)
    combined.set(current, nodePrefix.length + sibling.length)
  }

  return defaultBlake2bHash(combined)
}

/**
 * Blake2b Merkle Tree Construction (blakemany)
 *
 * Implements Gray Paper specification for blakemany function:
 * blakemany{a} creates a Merkle tree from sequence a using Blake2b hashing
 *
 * Gray Paper formula: H_extrinsichash ≡ blake{encode{blakemany{a}}}
 *
 * Gray Paper Reference: merklization.tex (Equation 174-182) - Node function N
 * Gray Paper Reference: header.tex (Equation 28) - Extrinsic hash calculation
 *
 * The ^# notation means blakemany applies blake to each element first, then
 * builds a Merkle tree internally. However, blakemany returns only the sequence
 * of leaf hashes (the hashed elements), not all tree nodes. This allows encode{}
 * to serialize the leaf hashes, then blake{} hashes the result.
 *
 * This uses the Gray Paper node function N internally to build the tree:
 * 1. Splits at ceil(len/2) (well-balanced tree, not adjacent pairing)
 * 2. Uses "node" prefix for internal node hashing (Gray Paper Equation 179)
 * 3. Returns zerohash for empty sequence
 * 4. Returns v₀ (the value itself) for single-item sequence
 * 5. Recursively builds tree: H(node concat N(left) concat N(right))
 *
 * @param items - Array of Uint8Array items to merklize
 * @returns Sequence of leaf hashes (one hash per input item)
 */
export function blakemany(items: Uint8Array[]): Safe<Uint8Array[]> {
  // Gray Paper Equation 177: N(v, H) = zerohash when len(v) = 0
  if (items.length === 0) {
    return safeResult([new Uint8Array(32)])
  }

  // First, hash all items to get leaf hashes (blake^# applies blake to each element)
  const leafHashes: Uint8Array[] = []
  for (const item of items) {
    const [hashError, hash] = blake2bHash(item)
    if (hashError) {
      return safeError(hashError)
    }
    leafHashes.push(hexToBytes(hash))
  }

  // Gray Paper Equation 178: N(v, H) = v₀ when len(v) = 1
  if (leafHashes.length === 1) {
    return safeResult(leafHashes)
  }

  // Gray Paper Equation 179: N(v, H) = H($node concat N(left) concat N(right))
  // where left = v[0..ceil(len/2)], right = v[ceil(len/2)..]
  const merkleTree: Uint8Array[] = [...leafHashes] // Start with leaf level

  // Recursive function to build tree using Gray Paper node function N
  // This works on hashes (not blobs), so N(v) = v₀ when len(v) = 1
  function buildTree(hashes: Uint8Array[]): Safe<Uint8Array> {
    if (hashes.length === 0) {
      const zeroHash = new Uint8Array(32)
      merkleTree.push(zeroHash)
      return safeResult(zeroHash)
    }

    // Gray Paper Equation 178: N(v, H) = v₀ when len(v) = 1
    // Since we're working with hashes, return the hash itself
    if (hashes.length === 1) {
      return safeResult(hashes[0])
    }

    // Split at ceil(len/2) per Gray Paper Equation 179
    const mid = Math.ceil(hashes.length / 2)
    const left = hashes.slice(0, mid)
    const right = hashes.slice(mid)

    // Recursively compute left and right subtrees
    const [leftError, leftHash] = buildTree(left)
    if (leftError) {
      return safeError(leftError)
    }

    const [rightError, rightHash] = buildTree(right)
    if (rightError) {
      return safeError(rightError)
    }

    // Gray Paper Equation 179: H($node concat N(left) concat N(right))
    // Note: Gray Paper uses token{$node}, where $ means start of string, so the literal string is "node"
    const nodePrefix = new TextEncoder().encode('node')
    const combined = new Uint8Array(
      nodePrefix.length + leftHash.length + rightHash.length,
    )
    combined.set(nodePrefix, 0)
    combined.set(leftHash, nodePrefix.length)
    combined.set(rightHash, nodePrefix.length + leftHash.length)

    const [hashError, hash] = blake2bHash(combined)
    if (hashError) {
      return safeError(hashError)
    }

    const hashBytes = hexToBytes(hash)
    merkleTree.push(hashBytes)

    return safeResult(hashBytes)
  }

  // Build the tree and collect all nodes
  const [rootError] = buildTree(leafHashes)
  if (rootError) {
    return safeError(rootError)
  }

  // Gray Paper: blakemany{a} returns the sequence of leaf hashes (blake^# applied to each element)
  // The tree is built internally but only the leaf hashes are returned
  // This allows encode{} to serialize the leaf hashes, then blake{} hashes the result
  return safeResult(leafHashes)
}

/**
 * Generate MMR inclusion proof
 *
 * Creates proof for a specific leaf in the MMR
 *
 * Gray Paper Reference: merklization.tex (Equations 275-316)
 *
 * MMR proof consists of:
 * 1. Sibling hashes from the leaf to the peak
 * 2. Peak hashes that are not part of the direct path
 * 3. The leaf index for verification
 */
export function generateMMRProof(
  range: MMRRange,
  leafIndex: number,
  hashFunction: HashFunction = defaultKeccakHash,
): Safe<MerkleProof> {
  try {
    if (leafIndex < 0) {
      return safeError(new Error('Leaf index must be non-negative'))
    }

    // Calculate total number of leaves in the MMR
    let totalLeaves = 0
    for (let i = 0; i < range.length; i++) {
      if (range[i] !== null) {
        totalLeaves += 2 ** i
      }
    }

    if (leafIndex >= totalLeaves) {
      return safeError(new Error('Leaf index out of range'))
    }

    const proofPath: Uint8Array[] = []
    let currentIndex = leafIndex
    const currentRange = range

    // Build proof path by traversing from leaf to peaks
    for (let peakIndex = 0; peakIndex < currentRange.length; peakIndex++) {
      const peak = currentRange[peakIndex]
      if (peak === null) {
        continue
      }

      const peakSize = 2 ** peakIndex

      // Check if our leaf is in this peak
      if (currentIndex < peakSize) {
        // Our leaf is in this peak, we need to generate proof within this peak
        const [proofError, peakProof] = generatePeakProof(
          peak,
          currentIndex,
          peakIndex,
          hashFunction,
        )
        if (proofError) {
          return safeError(proofError)
        }
        proofPath.push(...peakProof)
        break
      } else {
        // Our leaf is not in this peak, add this peak to proof path
        proofPath.push(peak)
        currentIndex -= peakSize
      }
    }

    return safeResult({
      path: proofPath,
      leafIndex,
      treeSize: totalLeaves,
    })
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Generate proof within a single peak (well-balanced tree)
 */
function generatePeakProof(
  _peak: Uint8Array,
  _leafIndex: number,
  _peakIndex: number,
  _hashFunction: HashFunction,
): Safe<Uint8Array[]> {
  try {
    // For now, we'll use a simplified approach
    // In a full implementation, we'd need to reconstruct the tree structure
    // and generate the proper proof path within the peak

    // This is a placeholder implementation
    // TODO: Implement proper peak proof generation
    return safeResult([])
  } catch (error) {
    return safeError(error as Error)
  }
}
