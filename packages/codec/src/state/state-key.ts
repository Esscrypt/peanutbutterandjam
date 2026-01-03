import { blake2bHash } from "@pbnjam/core"
import type { Hex } from "viem"
import { bytesToHex, hexToBytes } from "viem"
import { decodeNatural } from "../core/natural-number"  
import { decodeProgramFromPreimage } from "../pvm/blob"
import { extractServiceIdFromStateKey } from "./service-account"

  /**
   * Check if a value matches the preimage key pattern
   *
   * Gray Paper: C(s, encode[4]{2³²-2} ∥ h) ↦ p
   * For preimage: value is p, and h = blake(p)
   * State key contains: blake(encode[4]{0xFFFFFFFE} ∥ h)
   * Additionally, preimages must be valid programs (decodeProgramFromPreimage must succeed)
   *
   * @param valueBytes - The value bytes from the state
   * @param blakeHashFromKey - The Blake hash extracted from the state key (first 27 bytes)
   * @returns Preimage data if it matches, null otherwise
   */
  export function isPreimageKey(
    valueBytes: Uint8Array,
    blakeHashFromKey: Hex,
  ): { preimageHash: Hex; blob: Uint8Array } | null {
    // For preimage: value is p, and h = blake(p)
    // State key contains: blake(encode[4]{0xFFFFFFFE} ∥ h)
    const [preimageHashError, preimageHash] = blake2bHash(valueBytes)
    if (!preimageHashError && preimageHash) {
      // Try to match against preimage prefix
      const prefix = new Uint8Array(4)
      const prefixView = new DataView(prefix.buffer)
      prefixView.setUint32(0, 0xfffffffe, true) // little-endian
      // preimageHash is already Hex type from blake2bHash
      const preimageHashBytes = hexToBytes(preimageHash)
      const combinedKey = new Uint8Array(
        prefix.length + preimageHashBytes.length,
      )
      combinedKey.set(prefix, 0)
      combinedKey.set(preimageHashBytes, prefix.length)
      const [combinedHashError, combinedHash] = blake2bHash(combinedKey)
      if (!combinedHashError && combinedHash) {
        // combinedHash is Hex (string), extract first 27 bytes
        const combinedHashBytes = hexToBytes(combinedHash)
        const combinedHashHex = bytesToHex(combinedHashBytes.slice(0, 27)) // First 27 bytes
        if (combinedHashHex === blakeHashFromKey) {
          // Blake hash matches - now validate it's a valid program
          // Preimages in state include metadata, so use decodeProgramFromPreimage
          const [programError] = decodeProgramFromPreimage(valueBytes)
          if (!programError) {
            // It's a valid preimage (valid program)!
            return {
              preimageHash: preimageHash,
              blob: valueBytes,
            }
          }
        }
      }
    }
    return null
  }

  /**
   * Extract all preimage keys from rawCshKeyvals
   *
   * Iterates through all C(s, h) keys and identifies those that match the preimage pattern.
   *
   * @param rawCshKeyvals - Map of state keys to values
   * @returns Map of state keys to preimage data (preimageHash and blob)
   */
  export function extractPreimageKeys(
    rawCshKeyvals: Record<Hex, Hex>,
  ): Map<Hex, { preimageHash: Hex; blob: Uint8Array }> {
    const preimages = new Map<Hex, { preimageHash: Hex; blob: Uint8Array }>()

    for (const [stateKeyHex, valueHex] of Object.entries(rawCshKeyvals)) {
      const stateKeyBytes = hexToBytes(stateKeyHex as Hex)
      
      // Only process 31-byte state keys (C(s, h) format)
      if (stateKeyBytes.length !== 31) continue

      const valueBytes = hexToBytes(valueHex as Hex)
      
      // Extract the 27-byte Blake hash from the state key
      const blakeHashFromKey = extractBlakeHashFromStateKey(stateKeyBytes)
      
      // Check if it's a preimage
      const preimageResult = isPreimageKey(valueBytes, blakeHashFromKey)
      
      if (preimageResult) {
        preimages.set(stateKeyHex as Hex, preimageResult)
      }
    }

    return preimages
  }

  /**
   * Extract Blake hash from a C(s, h) state key
   *
   * Gray Paper: C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩
   * where n = encode[4](s), a = blake(h)
   * The Blake hash is interleaved: a₀, a₁, a₂, a₃, a₄, ..., a₂₆
   *
   * @param stateKeyBytes - 31-byte state key
   * @returns 27-byte Blake hash as Hex
   */
  export function extractBlakeHashFromStateKey(stateKeyBytes: Uint8Array): Hex {
    if (stateKeyBytes.length !== 31) {
      throw new Error(`Invalid state key length: expected 31, got ${stateKeyBytes.length}`)
    }

    // Extract Blake hash bytes: a₀, a₁, a₂, a₃, a₄, ..., a₂₆
    // Interleaved pattern: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆
    const blakeHash = new Uint8Array(27)
    blakeHash[0] = stateKeyBytes[1] // a₀
    blakeHash[1] = stateKeyBytes[3] // a₁
    blakeHash[2] = stateKeyBytes[5] // a₂
    blakeHash[3] = stateKeyBytes[7] // a₃
    // Remaining bytes: a₄, a₅, ..., a₂₆ (23 bytes starting at index 8)
    blakeHash.set(stateKeyBytes.slice(8), 4)

    return bytesToHex(blakeHash)
  }

  /**
   * Parse timeslots from request value bytes
   *
   * Gray Paper: encode{var{sequence{encode[4]{x} | x ∈ t}}}
   * Format: var{length} || timeslot0 || timeslot1 || ...
   *
   * @param valueBytes - Value bytes from the state
   * @returns Parsed timeslots array if format is valid, null otherwise
   */
  function parseRequestTimeslots(valueBytes: Uint8Array): bigint[] | null {
    const [lengthError, lengthResult] = decodeNatural(valueBytes)
    if (lengthError || !lengthResult) {
      return null
    }

    const timeslotCount = Number(lengthResult.value)
    const lengthPrefixBytes = lengthResult.consumed
    const remainingBytes = valueBytes.length - lengthPrefixBytes
    const expectedBytes = timeslotCount * 4

    // Check if we have EXACTLY the right number of bytes for the timeslots and length is <= 3
    if (timeslotCount > 3 || remainingBytes !== expectedBytes) {
      return null
    }

    const timeslots: bigint[] = []
    for (let i = 0; i < timeslotCount; i++) {
      const offset = lengthPrefixBytes + i * 4
      if (offset + 4 > valueBytes.length) {
        return null
      }
      const view = new DataView(
        valueBytes.buffer,
        valueBytes.byteOffset + offset,
        4,
      )
      const timeslot = BigInt(view.getUint32(0, true)) // little-endian
      timeslots.push(timeslot)
    }

    return timeslots
  }

  /**
   * Validate request timeslots
   *
   * Validates that:
   * 1. Timeslots are in ascending order (each timeslot >= previous timeslot)
   * 2. All timeslots are <= currentTimeslot (if provided)
   *
   * @param timeslots - Array of timeslots to validate
   * @param currentTimeslot - Optional current timeslot for validation
   * @returns true if valid, false otherwise
   */
  function validateRequestTimeslots(
    timeslots: bigint[],
    currentTimeslot?: bigint,
  ): boolean {
    // Validate that timeslots are in ascending order
    for (let i = 1; i < timeslots.length; i++) {
      if (timeslots[i]! < timeslots[i - 1]!) {
        return false
      }
    }

    // Validate that all timeslots are <= currentTimeslot (if provided)
    if (currentTimeslot !== undefined) {
      for (const ts of timeslots) {
        if (ts > currentTimeslot) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Match a request key from value bytes and verify against known preimages
   *
   * Gray Paper: C(s, encode[4]{l} ∥ h) ↦ encode{var{sequence{encode[4]{x} | x ∈ t}}}
   * Request values are sequences of up to 3 timeslots (4-byte each)
   * Format: var{length} || timeslot0 || timeslot1 || ...
   *
   * @param stateKeyHex - State key to check
   * @param valueBytes - Value bytes from the state
   * @param preimages - Map of known preimages (state key -> preimage data)
   * @param currentTimeslot - Optional current timeslot for validation (all request timeslots must be <= currentTimeslot)
   * @returns Request data if it matches a known preimage or is a valid pending request, null otherwise
   */
  export function matchRequestKey(
    stateKeyHex: Hex,
    valueBytes: Uint8Array,
    preimages: Map<Hex, { preimageHash: Hex; blob: Uint8Array }>,
    currentTimeslot?: bigint,
  ): { preimageHash: Hex; timeslots: bigint[] } | { preimageHash?: Hex; timeslots: bigint[]; isPending: true } | null {
    // Requests must be exactly 5 bytes
    if (valueBytes.length !== 5) {
      return null
    }

    // Parse timeslots from value bytes
    const timeslots = parseRequestTimeslots(valueBytes)
    if (!timeslots) {
      return null
    }

    // Validate timeslots (ascending order and <= currentTimeslot if provided)
    if (!validateRequestTimeslots(timeslots, currentTimeslot)) {
      return null
    }

    // Try to match against known preimages
    for (const [, preimageData] of preimages) {
      if (isRequestKeyForPreimage(stateKeyHex, preimageData.preimageHash, preimageData.blob.length)) {
        return {
          preimageHash: preimageData.preimageHash,
          timeslots,
        }
      }
    }

    // No matching preimage found, but format is valid and timeslots are valid
    // This is a pending request (preimage not yet provided)
    // Only return it if currentTimeslot is provided (for validation)
    if (currentTimeslot !== undefined) {
      return {
        timeslots,
        isPending: true as const,
      }
    }

    return null
  }

  /**
   * Check if a state key matches a request key pattern for a given preimage
   *
   * Gray Paper: C(s, encode[4]{l} ∥ h) ↦ encode{var{sequence{encode[4]{x} | x ∈ t}}}
   * Request keys use the pattern: C(s, encode[4]{length} ∥ h)
   * where:
   * - s is the service ID
   * - l is the blob length (expected length of the preimage)
   * - h is the Blake2b hash of the preimage blob (same hash used for preimage keys)
   *
   * @param stateKeyHex - State key to check
   * @param preimageHash - Preimage hash (32-byte Blake2b hash of the preimage blob)
   * @param blobLength - Preimage blob length
   * @returns true if the state key matches the request pattern for this preimage
   */
  export function isRequestKeyForPreimage(
    stateKeyHex: Hex,
    preimageHash: Hex,
    blobLength: number,
  ): boolean {
    const stateKeyBytes = hexToBytes(stateKeyHex)
    if (stateKeyBytes.length !== 31) return false

    // Extract service ID from state key using helper from service-account.ts
    const serviceId = extractServiceIdFromStateKey(stateKeyBytes)
    if (serviceId === null) return false

    // Compute expected request key: C(s, encode[4]{l} ∥ h)
    // Create prefix: encode[4]{length}
    const prefix = new Uint8Array(4)
    const prefixView = new DataView(prefix.buffer)
    prefixView.setUint32(0, blobLength, true) // little-endian

    // Concatenate prefix with preimage hash
    const preimageHashBytes = hexToBytes(preimageHash)
    const combinedKey = new Uint8Array(prefix.length + preimageHashBytes.length)
    combinedKey.set(prefix, 0)
    combinedKey.set(preimageHashBytes, prefix.length)

    // Compute Blake hash of combined key
    const [blakeError, blakeHashHex] = blake2bHash(combinedKey)
    if (blakeError) return false

    const blakeHashFull = hexToBytes(blakeHashHex)
    const blakeHash = blakeHashFull.slice(0, 27) // First 27 bytes

    // Construct expected state key by interleaving service ID with Blake hash
    const expectedKey = new Uint8Array(31)
    const serviceUint8Array = new Uint8Array(4)
    const serviceView = new DataView(serviceUint8Array.buffer)
    serviceView.setUint32(0, Number(serviceId), true) // little-endian

    // Interleave: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆
    expectedKey[0] = serviceUint8Array[0] // n₀
    expectedKey[1] = blakeHash[0] // a₀
    expectedKey[2] = serviceUint8Array[1] // n₁
    expectedKey[3] = blakeHash[1] // a₁
    expectedKey[4] = serviceUint8Array[2] // n₂
    expectedKey[5] = blakeHash[2] // a₂
    expectedKey[6] = serviceUint8Array[3] // n₃
    expectedKey[7] = blakeHash[3] // a₃
    expectedKey.set(blakeHash.slice(4), 8) // a₄...a₂₆

    const expectedKeyHex = bytesToHex(expectedKey)
    return expectedKeyHex === stateKeyHex
  }

  /**
   * Determine the type of a single C(s, h) key-value pair
   *
   * Helper function for single key classification. Uses determineKeyTypes internally
   * with a single-entry record.
   *
   * @param stateKeyHex - State key (31-byte C(s, h) key)
   * @param valueBytes - Value bytes
   * @param currentTimeslot - Optional current timeslot for request validation (all request timeslots must be <= currentTimeslot)
   * @returns Key type classification result
   */
  export function determineSingleKeyType(
    stateKeyHex: Hex,
    valueBytes: Uint8Array,
    currentTimeslot?: bigint,
  ):
    | { keyType: 'storage'; key: Hex; value: Uint8Array }
    | { keyType: 'preimage'; preimageHash: Hex; blob: Uint8Array }
    | { keyType: 'request'; preimageHash: Hex; timeslots: bigint[] } {
    const valueHex = bytesToHex(valueBytes)
    const singleKeyRecord: Record<Hex, Hex> = { [stateKeyHex]: valueHex }
    const results = determineKeyTypes(singleKeyRecord, currentTimeslot)
    const result = results.get(stateKeyHex)
    if (!result) {
      // Default to storage if not found (should not happen, but fallback)
      const stateKeyBytes = hexToBytes(stateKeyHex)
      const blakeHashFromKey = extractBlakeHashFromStateKey(stateKeyBytes)
      return {
        keyType: 'storage',
        key: blakeHashFromKey,
        value: valueBytes,
      }
    }
    return result
  }

  /**
   * Determine the type of all C(s, h) keys from rawCshKeyvals
   *
   * Gray Paper formulas:
   * - Storage: C(s, encode[4]{2³²-1} ∥ k) ↦ v (raw blob)
   * - Preimage: C(s, encode[4]{2³²-2} ∥ h) ↦ p (raw blob, where h = blake2b(p))
   * - Request: C(s, encode[4]{l} ∥ h) ↦ encode{var{sequence{encode[4]{x} | x ∈ t}}}
   *   where l is the blob length and h is the Blake2b hash of the preimage blob
   *
   * Strategy:
   * 1. First pass: Extract all preimage keys (cryptographically verifiable)
   * 2. Second pass: Match request keys based on known preimages or validate pending requests (must be exactly 5 bytes)
   * 3. Everything else defaults to storage
 *
   * @param rawCshKeyvals - Map of state keys to values
   * @param currentTimeslot - Optional current timeslot for request validation (all request timeslots must be <= currentTimeslot)
   * @returns Map of state keys to their determined types
   */
  export function determineKeyTypes(
    rawCshKeyvals: Record<Hex, Hex>,
    currentTimeslot?: bigint,
  ): Map<
    Hex,
    | { keyType: 'storage'; key: Hex; value: Uint8Array }
    | { keyType: 'preimage'; preimageHash: Hex; blob: Uint8Array }
    | { keyType: 'request'; preimageHash: Hex; timeslots: bigint[] }
  > {
    const results = new Map<
      Hex,
      | { keyType: 'storage'; key: Hex; value: Uint8Array }
      | { keyType: 'preimage'; preimageHash: Hex; blob: Uint8Array }
      | { keyType: 'request'; preimageHash: Hex; timeslots: bigint[] }
    >()

    // First pass: Extract all preimages
    const preimages = extractPreimageKeys(rawCshKeyvals)
    for (const [stateKeyHex, preimageData] of preimages) {
      results.set(stateKeyHex, {
        keyType: 'preimage',
        preimageHash: preimageData.preimageHash,
        blob: preimageData.blob,
      })
    }

    // Second pass: Match requests based on known preimages
    for (const [stateKeyHex, valueHex] of Object.entries(rawCshKeyvals)) {
      // Skip if already classified as preimage
      if (results.has(stateKeyHex as Hex)) continue

      const stateKeyBytes = hexToBytes(stateKeyHex as Hex)
      
      // Only process 31-byte state keys (C(s, h) format)
      // Skip invalid state keys (they won't be classified, but won't cause errors)
      if (stateKeyBytes.length !== 31) {
        continue
      }

      const valueBytes = hexToBytes(valueHex as Hex)
      const blakeHashFromKey = extractBlakeHashFromStateKey(stateKeyBytes)

      // Try to match as a request (must be exactly 5 bytes)
      const requestMatch = matchRequestKey(stateKeyHex as Hex, valueBytes, preimages, currentTimeslot)
      
      if (requestMatch) {
        // Handle both matched requests (with preimageHash) and pending requests (without preimageHash)
        if ('preimageHash' in requestMatch && requestMatch.preimageHash) {
          // Matched request: has corresponding preimage
          results.set(stateKeyHex as Hex, {
            keyType: 'request',
            preimageHash: requestMatch.preimageHash,
            timeslots: requestMatch.timeslots,
          })
        } else if ('isPending' in requestMatch && requestMatch.isPending) {
          // Pending request: format is valid and timeslots are valid (all <= currentTimeslot),
          // but no matching preimage found yet. We still classify it as a request for items calculation,
          // but we can't determine preimageHash without the preimage, so we use an empty hash.
          // The items formula requires counting requests: items = 2 * len(requests) + len(storage)
          results.set(stateKeyHex as Hex, {
            keyType: 'request',
            preimageHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
            timeslots: requestMatch.timeslots,
          })
        }
        continue
      }

      // Not a preimage or request - default to storage
      results.set(stateKeyHex as Hex, {
        keyType: 'storage',
        key: blakeHashFromKey,
        value: valueBytes,
      })
    }

    return results
  }