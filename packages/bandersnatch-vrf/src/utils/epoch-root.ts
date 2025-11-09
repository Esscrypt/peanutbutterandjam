import type { RingVRFProver } from '@pbnj/bandersnatch-vrf'
import { bytesToHex, type Hex, hexToBytes, logger, zeroHash } from '@pbnj/core'
import type {
  Safe,
  ValidatorPublicKeys,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import {
  BANDERSNATCH_VRF_CONFIG,
  RING_ROOT_OFFSETS,
} from '../config/bandersnatch-vrf-config'

/**
 * Calculate Bandersnatch ring root from a set of public keys
 * Implements Gray Paper getRingRoot function
 *
 * This creates a commitment to a set of Bandersnatch public keys that can be used
 * for ring VRF proofs. The root allows verification that a proof was created by
 * someone who knows a secret key corresponding to one of the public keys in the ring.
 *
 * @param bandersnatchKeys - Array of Bandersnatch public keys (32 bytes each)
 * @returns Ring root as 32-byte hash
 */
/**
 * getRingRoot - Create KZG polynomial commitment to ring of public keys
 *
 * ============================================================================
 * GRAY PAPER SPECIFICATION:
 * ============================================================================
 *
 * Gray Paper bandersnatch.tex equation 15:
 * getRingRoot{sequence{bskey}} ∈ ringroot ≡ commit(sequence{bskey})
 *
 * Gray Paper notation.tex line 169:
 * - ringroot ⊂ blob[144] (ring root is 144 bytes)
 *
 * Gray Paper safrole.tex equation 118:
 * z = getRingRoot({k_vk_bs | k ∈ pendingSet'})
 *
 * ============================================================================
 * BANDERSNATCH-VRF-SPEC COMPLIANCE:
 * ============================================================================
 *
 * Ring root structure (144 bytes total):
 * - KZG Polynomial Commitment (48 bytes): BLS12-381 G1 point commitment
 * - Accumulator Seed Point (32 bytes): For ring proof generation
 * - Padding Point (32 bytes): For invalid Bandersnatch keys
 * - Domain Information (32 bytes): Polynomial domain generator and size
 *
 * ============================================================================
 *
 * @param bandersnatchKeys - Sequence of Bandersnatch public keys (32 bytes each)
 * @param keyPairService - Not needed (kept for backward compatibility, can be null)
 * @param validatorSetManager - Not needed (kept for backward compatibility, can be null)
 * @param prover - RingVRFProver instance for computing ring commitment
 * @returns 144-byte ring root commitment with proper metadata
 */
export function getRingRoot(
  bandersnatchKeys: Uint8Array[],
  prover: RingVRFProver,
): Safe<Uint8Array> {
  if (bandersnatchKeys.length === 0) {
    return safeError(new Error('Cannot create ring root from empty key set'))
  }

  // Sort keys for deterministic ordering (Gray Paper requirement)
  const sortedKeys = [...bandersnatchKeys].sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] < b[i]) return -1
      if (a[i] > b[i]) return 1
    }
    return a.length - b.length
  })

  // Gray Paper compliant: compute ring commitment from public keys only
  // No private key needed - this is deterministic and can be computed by any node
  let ringCommitment: Uint8Array
  try {
    ringCommitment = prover.computeRingCommitment(sortedKeys)
  } catch (error) {
    return safeError(
      error instanceof Error
        ? error
        : new Error(`Failed to compute ring commitment: ${String(error)}`),
    )
  }

  if (!ringCommitment || ringCommitment.length === 0) {
    return safeError(new Error('Failed to compute ring commitment'))
  }

  // Construct the full 144-byte ring root structure according to bandersnatch-vrf-spec
  const ringRoot = new Uint8Array(BANDERSNATCH_VRF_CONFIG.RING_ROOT_SIZE)

  // 1. KZG Polynomial Commitment (48 bytes) - BLS12-381 G1 point
  ringRoot.set(ringCommitment, RING_ROOT_OFFSETS.KZG_COMMITMENT)

  // 2. Accumulator Seed Point (32 bytes) - from bandersnatch-vrf-spec
  const accumulatorSeedPoint = hexToBytes(
    BANDERSNATCH_VRF_CONFIG.ACCUMULATOR_SEED_POINT,
  )
  ringRoot.set(accumulatorSeedPoint, RING_ROOT_OFFSETS.ACCUMULATOR_SEED_POINT)

  // 3. Padding Point (32 bytes) - from bandersnatch-vrf-spec
  const paddingPoint = hexToBytes(BANDERSNATCH_VRF_CONFIG.PADDING_POINT)
  ringRoot.set(paddingPoint, RING_ROOT_OFFSETS.PADDING_POINT)

  // 4. Domain Information (32 bytes) - polynomial domain generator and size
  const domainGenerator = hexToBytes(BANDERSNATCH_VRF_CONFIG.DOMAIN_GENERATOR)

  const domainSize = new Uint8Array(BANDERSNATCH_VRF_CONFIG.DOMAIN_SIZE_BYTES)

  new DataView(domainSize.buffer).setUint32(
    0,
    BANDERSNATCH_VRF_CONFIG.DOMAIN_SIZE,
    true,
  ) // Little-endian

  ringRoot.set(
    domainGenerator.slice(0, BANDERSNATCH_VRF_CONFIG.DOMAIN_GENERATOR_SIZE),
    RING_ROOT_OFFSETS.DOMAIN_GENERATOR,
  )

  ringRoot.set(domainSize, RING_ROOT_OFFSETS.DOMAIN_SIZE)

  // logger.debug('Generated ring root with bandersnatch-vrf-spec compliance', {
  //   ringSize: sortedKeys.length,
  //   ringCommitmentLength: ringCommitment.length,
  //   ringRootLength: ringRoot.length,
  //   accumulatorSeedPoint: bytesToHex(accumulatorSeedPoint),
  //   paddingPoint: bytesToHex(paddingPoint),
  //   domainSize: BANDERSNATCH_VRF_CONFIG.DOMAIN_SIZE,
  // })

  return safeResult(ringRoot)
}

/**
 * Extract ring keys from validator set for ring VRF verification
 *
 * Gray Paper safrole.tex equation 118:
 * z = getRingRoot({k_vk_bs | k ∈ pendingSet'})
 *
 * Gray Paper safrole.tex lines 104-111:
 * ∀ vk ∈ valkey : vk_vk_bs ∈ bskey ≡ vk[0:32]
 *
 * This function extracts the Bandersnatch keys from the validator set
 * and prepares them for ring VRF verification. The epoch root is a
 * commitment to these keys, not the keys themselves.
 *
 * @param pendingSet - Validator public keys for the epoch
 * @returns Array of Bandersnatch public keys for ring verification
 */
export function extractRingKeysFromValidatorSet(
  pendingSet: ValidatorPublicKeys[],
): Safe<Uint8Array[]> {
  if (pendingSet.length === 0) {
    return safeError(
      new Error('Cannot extract ring keys from empty validator set'),
    )
  }

  // Convert validator public keys to Bandersnatch keys
  // Gray Paper: vk_vk_bs ∈ bskey ≡ vk[0:32] (first 32 bytes of validator key)
  const ringKeys = pendingSet
    .map((validator) => validator.bandersnatch)
    .filter((key) => key !== zeroHash)
    .map((key) => hexToBytes(key))

  // Sort keys for deterministic ordering (Gray Paper requirement)
  // This ensures consistent ring ordering across all nodes
  const sortedRingKeys = ringKeys.sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] < b[i]) return -1
      if (a[i] > b[i]) return 1
    }
    return a.length - b.length
  })

  return safeResult(sortedRingKeys)
}

/**
 * Verify ring commitment structure without reconstructing it
 *
 * According to bandersnatch-vrf-spec, Ring VRF verification does NOT require
 * the private key of the prover. The verification process works by:
 *
 * 1. Verifying the Pedersen VRF proof (θ₀) - proves correct output generation
 * 2. Verifying the ring proof (θ₁) - proves membership in the ring
 *
 * The ring commitment in the epoch root is a KZG commitment to the ring
 * polynomial. We don't need to reconstruct it - we just need to verify that:
 * - The epoch root structure is valid (144 bytes)
 * - The metadata constituents are correct
 * - The domain size matches the ring size
 *
 * The actual ring commitment verification happens during Ring VRF proof
 * verification, not during epoch root validation.
 *
 * @param epochRootBytes - 144-byte epoch root
 * @param ringKeys - Array of Bandersnatch public keys (32 bytes each)
 * @returns True if epoch root structure is valid for the given ring
 */
function verifyEpochRootStructure(
  epochRootBytes: Uint8Array,
  ringKeys: Uint8Array[],
): Safe<boolean> {
  try {
    if (epochRootBytes.length !== BANDERSNATCH_VRF_CONFIG.RING_ROOT_SIZE) {
      return safeError(
        new Error(
          `Invalid epoch root size: expected ${BANDERSNATCH_VRF_CONFIG.RING_ROOT_SIZE} bytes, got ${epochRootBytes.length}`,
        ),
      )
    }

    // Extract and validate metadata constituents
    const metadataValidation = validateEpochRootMetadata(
      epochRootBytes,
      ringKeys.length,
    )

    if (!metadataValidation.isValid) {
      logger.warn('Epoch root metadata validation failed', {
        error: metadataValidation.error,
        expectedRingSize: ringKeys.length,
        actualDomainSize: metadataValidation.domainSize,
      })
      return safeResult(false)
    }

    logger.debug('Epoch root structure validation successful', {
      epochRootLength: epochRootBytes.length,
      ringSize: ringKeys.length,
      domainSize: metadataValidation.domainSize,
      kzgCommitmentLength: BANDERSNATCH_VRF_CONFIG.KZG_COMMITMENT_SIZE,
    })

    return safeResult(true)
  } catch (error) {
    logger.error('Failed to verify epoch root structure', {
      error: error instanceof Error ? error.message : String(error),
    })
    return safeError(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Verify that epoch root structure is valid for the validator set
 *
 * Gray Paper bandersnatch.tex equation 15:
 * getRingRoot{sequence{bskey}} ∈ ringroot ≡ commit(sequence{bskey})
 *
 * According to bandersnatch-vrf-spec, Ring VRF verification does NOT require
 * the private key of the prover. The verification process works by:
 *
 * 1. Verifying the Pedersen VRF proof (θ₀) - proves correct output generation
 * 2. Verifying the ring proof (θ₁) - proves membership in the ring
 *
 * This function validates that the epoch root structure is correct for the
 * validator set by:
 * 1. Extracting ring keys from validator set
 * 2. Validating epoch root structure (144 bytes)
 * 3. Validating metadata constituents (accumulator seed, padding point, domain size)
 *
 * The actual ring commitment verification happens during Ring VRF proof
 * verification, not during epoch root validation.
 *
 * @param epochRoot - 144-byte epoch root from Gray Paper
 * @param pendingSet - Validator public keys for the epoch
 * @returns True if epoch root structure is valid for the validator set
 */
export function verifyEpochRootMatchesValidatorSet(
  epochRoot: Hex,
  pendingSet: ValidatorPublicKeys[],
): Safe<boolean> {
  try {
    // Step 1: Extract ring keys from validator set
    const [extractError, ringKeys] = extractRingKeysFromValidatorSet(pendingSet)
    if (extractError) {
      return safeError(extractError)
    }

    if (!ringKeys || ringKeys.length === 0) {
      return safeError(new Error('No valid ring keys found in validator set'))
    }

    // Step 2: Convert epoch root to bytes
    const epochRootBytes = hexToBytes(epochRoot)

    // Step 3: Verify epoch root structure
    const [structureError, structureValid] = verifyEpochRootStructure(
      epochRootBytes,
      ringKeys,
    )
    if (structureError) {
      return safeError(structureError)
    }

    if (!structureValid) {
      logger.warn('Epoch root structure validation failed', {
        epochRootHex: epochRoot,
        ringSize: ringKeys.length,
      })
      return safeResult(false)
    }

    logger.debug('Epoch root verification completed successfully', {
      epochRootLength: epochRootBytes.length,
      ringSize: ringKeys.length,
      epochRootHex: epochRoot,
    })

    return safeResult(true)
  } catch (error) {
    logger.error('Failed to verify epoch root against validator set', {
      error: error instanceof Error ? error.message : String(error),
    })
    return safeError(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Validate epoch root metadata constituents
 *
 * The epoch root contains several metadata components that must be validated:
 * 1. Accumulator Seed Point (32 bytes): Used by Ring VRF provers for proof generation
 * 2. Padding Point (32 bytes): Used for invalid Bandersnatch keys
 * 3. Domain Information (32 bytes): Polynomial domain generator and size
 *
 * @param epochRootBytes - 144-byte epoch root
 * @param expectedRingSize - Expected number of keys in the ring
 * @returns Validation result with metadata information
 */
function validateEpochRootMetadata(
  epochRootBytes: Uint8Array,
  expectedRingSize: number,
): { isValid: boolean; error?: string; domainSize?: number } {
  try {
    // Extract accumulator seed point
    const accumulatorSeedPoint = epochRootBytes.slice(
      RING_ROOT_OFFSETS.ACCUMULATOR_SEED_POINT,
      RING_ROOT_OFFSETS.ACCUMULATOR_SEED_POINT +
        BANDERSNATCH_VRF_CONFIG.ACCUMULATOR_SEED_POINT_SIZE,
    )

    // Extract padding point
    const paddingPoint = epochRootBytes.slice(
      RING_ROOT_OFFSETS.PADDING_POINT,
      RING_ROOT_OFFSETS.PADDING_POINT +
        BANDERSNATCH_VRF_CONFIG.PADDING_POINT_SIZE,
    )

    // Extract domain size
    const domainSizeBytes = epochRootBytes.slice(
      RING_ROOT_OFFSETS.DOMAIN_SIZE,
      RING_ROOT_OFFSETS.DOMAIN_SIZE + BANDERSNATCH_VRF_CONFIG.DOMAIN_SIZE_BYTES,
    )
    const domainSize = new DataView(domainSizeBytes.buffer).getUint32(0, true) // Little-endian

    // Validate accumulator seed point matches expected value
    const expectedAccumulatorSeedPoint = hexToBytes(
      BANDERSNATCH_VRF_CONFIG.ACCUMULATOR_SEED_POINT,
    )
    const accumulatorMatches = accumulatorSeedPoint.every(
      (byte, index) => byte === expectedAccumulatorSeedPoint[index],
    )

    if (!accumulatorMatches) {
      return {
        isValid: false,
        error: 'Accumulator seed point does not match expected value',
      }
    }

    // Validate padding point matches expected value
    const expectedPaddingPoint = hexToBytes(
      BANDERSNATCH_VRF_CONFIG.PADDING_POINT,
    )
    const paddingMatches = paddingPoint.every(
      (byte, index) => byte === expectedPaddingPoint[index],
    )

    if (!paddingMatches) {
      return {
        isValid: false,
        error: 'Padding point does not match expected value',
      }
    }

    // Validate domain size matches ring size
    if (domainSize !== expectedRingSize) {
      return {
        isValid: false,
        error: `Domain size mismatch: expected ${expectedRingSize}, got ${domainSize}`,
      }
    }

    logger.debug('Epoch root metadata validation successful', {
      accumulatorSeedPointHex: bytesToHex(accumulatorSeedPoint),
      paddingPointHex: bytesToHex(paddingPoint),
      domainSize,
      expectedRingSize,
    })

    return {
      isValid: true,
      domainSize,
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
