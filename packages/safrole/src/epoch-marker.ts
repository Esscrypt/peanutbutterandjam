import { blake2bHash, type Hex, hexToBytes } from '@pbnjam/core'

import type { Safe, ValidatorPublicKeys } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'

/**
 * Compute epoch marker according to Gray Paper Eq. 248-257
 * H_epochmark = {entropyaccumulator, entropy_1, [(k_vk_bs, k_vk_ed)] | k ∈ pendingset'} when e' > e
 *
 * Gray Paper specification:
 * - Only computed when e' > e (epoch transition)
 * - Returns none otherwise
 * - Structure: tuple of {entropyaccumulator, entropy_1, [(k_vk_bs, k_vk_ed)]}
 */
export function computeEpochMarker(
  entropyAccumulator: Hex,
  entropy1: Hex,
  pendingSet: ValidatorPublicKeys[],
  currentEpoch: bigint,
  nextEpoch: bigint,
): Safe<Hex | null> {
  // Gray Paper condition: only compute when e' > e (epoch transition)
  if (nextEpoch <= currentEpoch) {
    return safeResult(null) // Gray Paper: none
  }

  // Create the epoch marker tuple structure according to Gray Paper
  // Structure: {entropyaccumulator, entropy_1, [(k_vk_bs, k_vk_ed)] | k ∈ pendingset'}

  // 1. Entropy accumulator (32 bytes)
  const entropyAccumulatorBytes = hexToBytes(entropyAccumulator)

  // 2. Entropy_1 (32 bytes)
  const entropy1Bytes = hexToBytes(entropy1)

  // 3. Validator key pairs: [(k_vk_bs, k_vk_ed)] | k ∈ pendingset'
  const validatorKeysData = new Uint8Array(pendingSet.length * 64) // 32 bytes each for bs + ed
  for (let i = 0; i < pendingSet.length; i++) {
    const validator = pendingSet[i]
    const bsKeyBytes = hexToBytes(validator.bandersnatch)
    const edKeyBytes = hexToBytes(validator.ed25519)

    // Place Bandersnatch key (32 bytes)
    validatorKeysData.set(bsKeyBytes, i * 64)
    // Place Ed25519 key (32 bytes)
    validatorKeysData.set(edKeyBytes, i * 64 + 32)
  }

  // Combine all components into the marker tuple
  const markerData = new Uint8Array([
    ...entropyAccumulatorBytes, // entropyaccumulator
    ...entropy1Bytes, // entropy_1
    ...validatorKeysData, // [(k_vk_bs, k_vk_ed)] | k ∈ pendingset'
  ])

  // Hash the complete marker tuple
  const [hashError, hash] = blake2bHash(markerData)
  if (hashError) {
    return safeError(hashError)
  }

  return safeResult(hash)
}
