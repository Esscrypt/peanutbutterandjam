import { decodeNatural, decodeProgramFromPreimage } from "@pbnjam/codec"
import type { Hex } from "viem"
import { bytesToHex, hexToBytes } from "viem"
import { blake2bHash } from "./utils/crypto"
import { logger } from "./logger"

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
          if (programError) {
            logger.warn('Preimage found but it is not a parsable program')
          }
          return {
            preimageHash: preimageHash,
            blob: valueBytes,
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
   * Match a request key from value bytes and verify against known preimages
   *
   * Gray Paper: C(s, encode[4]{l} ∥ h) ↦ encode{var{sequence{encode[4]{x} | x ∈ t}}}
   * Request values are sequences of up to 3 timeslots (4-byte each)
   * Format: var{length} || timeslot0 || timeslot1 || ...
   *
   * @param stateKeyHex - State key to check
   * @param valueBytes - Value bytes from the state
   * @param preimages - Map of known preimages (state key -> preimage data)
   * @returns Request data if it matches a known preimage, null otherwise
   */
  export function matchRequestKey(
    stateKeyHex: Hex,
    valueBytes: Uint8Array,
    preimages: Map<Hex, { preimageHash: Hex; blob: Uint8Array }>,
  ): { preimageHash: Hex; timeslots: bigint[] } | null {
    // Check if value format matches request pattern
    const [lengthError, lengthResult] = decodeNatural(valueBytes)
    if (!lengthError && lengthResult) {
      const timeslotCount = Number(lengthResult.value)
      const lengthPrefixBytes = lengthResult.consumed
      const remainingBytes = valueBytes.length - lengthPrefixBytes
      const expectedBytes = timeslotCount * 4

      // Check if we have EXACTLY the right number of bytes for the timeslots and length is <= 3
      if (timeslotCount <= 3 && remainingBytes === expectedBytes) {
        const timeslots: bigint[] = []
        for (let i = 0; i < timeslotCount; i++) {
          const offset = lengthPrefixBytes + i * 4
          if (offset + 4 <= valueBytes.length) {
            const view = new DataView(
              valueBytes.buffer,
              valueBytes.byteOffset + offset,
              4,
            )
            const timeslot = BigInt(view.getUint32(0, true)) // little-endian
            timeslots.push(timeslot)
          }
        }
        if (timeslots.length === timeslotCount) {
          // Verify this is a request by checking if it matches any known preimage
          for (const [, preimageData] of preimages) {
            if (isRequestKeyForPreimage(stateKeyHex, preimageData.preimageHash, preimageData.blob.length)) {
              return {
                preimageHash: preimageData.preimageHash,
                timeslots,
              }
            }
          }
        }
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
    // Import createServiceRequestKey dynamically to avoid circular dependency
    // For now, we'll compute the request key pattern manually
    const stateKeyBytes = hexToBytes(stateKeyHex)
    if (stateKeyBytes.length !== 31) return false

    // Extract service ID from state key
    const serviceIdBytes = new Uint8Array(4)
    serviceIdBytes[0] = stateKeyBytes[0] // n₀
    serviceIdBytes[1] = stateKeyBytes[2] // n₁
    serviceIdBytes[2] = stateKeyBytes[4] // n₂
    serviceIdBytes[3] = stateKeyBytes[6] // n₃
    const serviceIdView = new DataView(serviceIdBytes.buffer)
    const serviceId = BigInt(serviceIdView.getUint32(0, true))

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
   * 2. Second pass: Match request keys based on known preimages
   * 3. Everything else is storage
   *
   * @param rawCshKeyvals - Map of state keys to values
   * @returns Map of state keys to their determined types
   */
  export function determineKeyType(
    rawCshKeyvals: Record<Hex, Hex>,
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
      if (stateKeyBytes.length !== 31) continue

      const valueBytes = hexToBytes(valueHex as Hex)
      const blakeHashFromKey = extractBlakeHashFromStateKey(stateKeyBytes)

      // Try to match as a request
      const requestMatch = matchRequestKey(stateKeyHex as Hex, valueBytes, preimages)
      if (requestMatch) {
        results.set(stateKeyHex as Hex, {
          keyType: 'request',
          preimageHash: requestMatch.preimageHash,
          timeslots: requestMatch.timeslots,
        })
        continue
      }

      // Not a preimage or verified request - default to storage
      if (valueBytes.length === 0) {
        throw new Error(
          'C(s, h) key value is empty - cannot be storage (storage values must be non-empty raw blobs)',
        )
      }
      results.set(stateKeyHex as Hex, {
        keyType: 'storage',
        key: blakeHashFromKey,
        value: valueBytes,
      })
    }

    return results
  }