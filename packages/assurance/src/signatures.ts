/**
 * Assurance Signature Functions
 *
 * Implements assurance signature creation and validation according to the Gray Paper.
 *
 * Gray Paper Reference: reporting_assurance.tex, Equations 159-160
 *
 * Message format: "$jam_available" || BLAKE2b(encode(parent_hash, bitfield))
 */

import { ed25519 } from '@noble/curves/ed25519'
import { blake2bHash, type Safe, safeError, safeResult } from '@pbnj/core'
import type { Assurance } from '@pbnj/types'
import type { Hex } from 'viem'
import { bytesToHex, hexToBytes } from 'viem'

/**
 * Create an assurance signature
 *
 * Gray Paper: Equation 159-160
 * Signature message = "$jam_available" || BLAKE2b(encode(parent_hash, bitfield))
 *
 * @param parentHash - Parent block hash (anchor)
 * @param bitfield - Availability bitfield (which erasure code segments validator holds)
 * @param validatorPrivateKey - Ed25519 private key of validator
 * @returns Assurance signature (hex string)
 */
export function createAssuranceSignature(
  parentHash: Hex,
  bitfield: Hex,
  validatorPrivateKey: Uint8Array,
): Safe<Hex> {
  try {
    // Gray Paper: X_available ≡ "$jam_available"
    const availablePrefix = new TextEncoder().encode('$jam_available')

    // Encode parent_hash and bitfield for hashing
    const parentHashBytes = hexToBytes(parentHash)
    const bitfieldBytes = hexToBytes(bitfield)

    // Create message: encode(parent_hash, bitfield)
    const messageData = new Uint8Array(
      parentHashBytes.length + bitfieldBytes.length,
    )
    messageData.set(parentHashBytes, 0)
    messageData.set(bitfieldBytes, parentHashBytes.length)

    // Gray Paper: BLAKE2b(encode(H_parent, a_availabilities))
    const [messageHashError, messageHash] = blake2bHash(messageData)
    if (messageHashError) {
      return safeError(messageHashError)
    }
    const messageHashBytes = hexToBytes(messageHash)

    // Gray Paper: X_available || BLAKE2b(...)
    const fullMessage = new Uint8Array(
      availablePrefix.length + messageHashBytes.length,
    )
    fullMessage.set(availablePrefix, 0)
    fullMessage.set(messageHashBytes, availablePrefix.length)

    // Sign with Ed25519
    const signature = ed25519.sign(fullMessage, validatorPrivateKey)

    return safeResult(bytesToHex(signature))
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Verify an assurance signature
 *
 * Gray Paper: Equation 159-160
 * Message = "$jam_available" || BLAKE2b(encode(parent_hash, bitfield))
 *
 * @param assurance - Assurance containing signature to verify
 * @param parentHash - Parent block hash (anchor)
 * @param validatorPublicKey - Ed25519 public key of validator
 * @returns True if signature is valid
 */
export function verifyAssuranceSignature(
  assurance: Assurance,
  parentHash: Hex,
  validatorPublicKey: Uint8Array,
): Safe<boolean> {
  try {
    // Gray Paper: X_available ≡ "$jam_available"
    const availablePrefix = new TextEncoder().encode('$jam_available')

    // Encode parent_hash and bitfield for hashing
    const parentHashBytes = hexToBytes(parentHash)
    const bitfieldBytes = hexToBytes(assurance.bitfield)

    // Create message: encode(parent_hash, bitfield)
    const messageData = new Uint8Array(
      parentHashBytes.length + bitfieldBytes.length,
    )
    messageData.set(parentHashBytes, 0)
    messageData.set(bitfieldBytes, parentHashBytes.length)

    // Gray Paper: BLAKE2b(encode(H_parent, a_availabilities))
    const [messageHashError, messageHash] = blake2bHash(messageData)
    if (messageHashError) {
      return safeError(messageHashError)
    }
    const messageHashBytes = hexToBytes(messageHash)

    // Gray Paper: X_available || BLAKE2b(...)
    const fullMessage = new Uint8Array(
      availablePrefix.length + messageHashBytes.length,
    )
    fullMessage.set(availablePrefix, 0)
    fullMessage.set(messageHashBytes, availablePrefix.length)

    // Verify Ed25519 signature
    const signatureBytes = hexToBytes(assurance.signature)
    const isValid = ed25519.verify(
      signatureBytes,
      fullMessage,
      validatorPublicKey,
    )

    return safeResult(isValid)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Validate assurance signatures for multiple assurances
 *
 * Validates that all signatures are correct according to Gray Paper specifications.
 *
 * @param assurances - List of assurances to validate
 * @param parentHash - Parent block hash (anchor)
 * @param validatorKeys - Map of validator_index -> Ed25519 public key
 * @returns Safe<void> - Error if any signature is invalid
 */
export function validateAssuranceSignatures(
  assurances: Assurance[],
  parentHash: Hex,
  validatorKeys: Map<number, Uint8Array>,
): Safe<void> {
  for (const assurance of assurances) {
    const validatorKey = validatorKeys.get(assurance.validator_index)
    if (!validatorKey) {
      return safeError(
        new Error(
          `Validator key not found for index ${assurance.validator_index}`,
        ),
      )
    }

    const [sigError, isValid] = verifyAssuranceSignature(
      assurance,
      parentHash,
      validatorKey,
    )

    if (sigError) {
      return safeError(sigError)
    }

    if (!isValid) {
      return safeError(
        new Error(
          `Invalid signature for validator ${assurance.validator_index}`,
        ),
      )
    }
  }

  return safeResult(undefined)
}
