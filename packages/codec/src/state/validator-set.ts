/**
 * Staging set serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: merklization.tex (Equation C(7))
 * Formula:
 *
 * C(7) ↦ encode{stagingset}
 *
 * Gray Paper Section: accumulation.tex (Equation 136)
 * Staging set structure:
 *
 * ps_stagingset ∈ sequence[Cvalcount]{valkey}
 * valkey ≡ blob[336]
 *
 * Gray Paper Section: safrole.tex (Equation 106-110)
 * Validator key composition:
 *
 * ∀ vk ∈ valkey: vk_bs ∈ bskey ≡ vk[0:32]     (Bandersnatch key)
 * ∀ vk ∈ valkey: vk_ed ∈ edkey ≡ vk[32:32]     (Ed25519 key)
 * ∀ vk ∈ valkey: vk_bls ∈ blskey ≡ vk[64:144]  (BLS key)
 * ∀ vk ∈ valkey: vk_metadata ∈ metadatakey ≡ vk[208:128] (Metadata)
 *
 * Implements Gray Paper staging set serialization as specified
 * Reference: graypaper/text/safrole.tex, merklization.tex, and accumulation.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Staging set contains validator keys queued for the next epoch.
 * It provides the prospective validator set for future consensus.
 *
 * Validator key structure per Gray Paper:
 * 1. **k_bs**: Bandersnatch key (32 bytes) - for VRF and signatures
 * 2. **k_ed**: Ed25519 key (32 bytes) - for standard signatures
 * 3. **k_bls**: BLS key (144 bytes) - for aggregate signatures
 * 4. **k_metadata**: Metadata (128 bytes) - validator identification
 *
 * Key concepts:
 * - **Prospective validators**: Keys queued for next epoch activation
 * - **Epochal rotation**: Staging set becomes active set on epoch transition
 * - **Validator identification**: Metadata contains practical identifiers
 * - **Cryptographic diversity**: Multiple signature schemes for different purposes
 * - **Fixed structure**: Each validator key is exactly 336 bytes
 * - **Fixed count**: Exactly Cvalcount validators (1023 by default)
 *
 * The fixed-length sequence encoding ensures deterministic validator set sizes
 * while maintaining deterministic serialization for state hashing.
 *
 * This is critical for JAM's validator management system that ensures
 * smooth epoch transitions and validator set updates.
 */

import { bytesToHex, concatBytes, hexToBytes } from '@pbnj/core'
import type {
  DecodingResult,
  IConfigService,
  Safe,
  ValidatorPublicKeys,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'

/**
 * Encode staging set according to Gray Paper specification.
 *
 * Gray Paper merklization.tex equation C(7):
 * C(7) ↦ encode{stagingset}
 *
 * Gray Paper accumulation.tex equation 136:
 * ps_stagingset ∈ sequence[Cvalcount]{valkey}
 *
 * Gray Paper safrole.tex equation 106-110:
 * valkey ≡ blob[336]
 * ∀ vk ∈ valkey: vk_bs ∈ bskey ≡ vk[0:32]
 * ∀ vk ∈ valkey: vk_ed ∈ edkey ≡ vk[32:32]
 * ∀ vk ∈ valkey: vk_bls ∈ blskey ≡ vk[64:144]
 * ∀ vk ∈ valkey: vk_metadata ∈ metadatakey ≡ vk[208:128]
 *
 * Staging set contains validator keys queued for the next epoch,
 * providing the prospective validator set for future consensus.
 *
 * Field encoding per Gray Paper:
 * 1. k_bs: Bandersnatch key (32 bytes) - for VRF and signatures
 * 2. k_ed: Ed25519 key (32 bytes) - for standard signatures
 * 3. k_bls: BLS key (144 bytes) - for aggregate signatures
 * 4. k_metadata: Metadata (128 bytes) - validator identification
 *
 * Validator key semantics:
 * - **Prospective validators**: Keys queued for next epoch activation
 * - **Epochal rotation**: Staging set becomes active set on epoch transition
 * - **Validator identification**: Metadata contains practical identifiers
 * - **Cryptographic diversity**: Multiple signature schemes for different purposes
 * - **Fixed structure**: Each validator key is exactly 336 bytes
 * - **Fixed count**: Exactly Cvalcount validators (1023 by default)
 *
 * Consensus integration:
 * - Staging set determines next epoch's validator set
 * - Used for Bandersnatch ring root calculation
 * - Enables smooth epoch transitions
 * - Fixed-length sequence with Cvalcount elements
 *
 * ✅ CORRECT: Uses fixed-length sequence encoding for Cvalcount validator keys
 * ✅ CORRECT: Each validator key is exactly 336 bytes as per Gray Paper
 * ✅ CORRECT: Field order matches Gray Paper specification exactly
 * ✅ CORRECT: Supports prospective validator set management
 *
 * @param stagingSet - Array of validator keys to encode
 * @param configService - Configuration service for validator count
 * @returns Encoded octet sequence
 */
export function encodeValidatorSet(
  validatorSet: ValidatorPublicKeys[],
  configService: IConfigService,
): Safe<Uint8Array> {
  const validatorCount = configService.numValidators
  const parts: Uint8Array[] = []

  if (validatorSet.length !== validatorCount) {
    return safeError(
      new Error(
        `Validator set must have ${validatorCount} elements, got ${validatorSet.length}`,
      ),
    )
  }

  // Ensure we have exactly validatorCount elements
  for (let i = 0; i < validatorCount; i++) {
    const validator = validatorSet[i]

    // Gray Paper: valkey ≡ blob[336] - exactly 336 bytes per validator
    const validatorBytes = new Uint8Array(336)
    let offset = 0

    // Gray Paper: vk_bs ∈ bskey ≡ vk[0:32] - Bandersnatch key (32 bytes)
    const bsBytes = hexToBytes(validator.bandersnatch)
    if (bsBytes.length !== 32) {
      return safeError(
        new Error(`Bandersnatch key must be 32 bytes, got ${bsBytes.length}`),
      )
    }
    validatorBytes.set(bsBytes, offset)
    offset += 32

    // Gray Paper: vk_ed ∈ edkey ≡ vk[32:32] - Ed25519 key (32 bytes)
    const edBytes = hexToBytes(validator.ed25519)
    if (edBytes.length !== 32) {
      return safeError(
        new Error(`Ed25519 key must be 32 bytes, got ${edBytes.length}`),
      )
    }
    validatorBytes.set(edBytes, offset)
    offset += 32

    // Gray Paper: vk_bls ∈ blskey ≡ vk[64:144] - BLS key (144 bytes)
    const blsBytes = hexToBytes(validator.bls)
    if (blsBytes.length !== 144) {
      return safeError(
        new Error(`BLS key must be 144 bytes, got ${blsBytes.length}`),
      )
    }
    validatorBytes.set(blsBytes, offset)
    offset += 144

    // Gray Paper: vk_metadata ∈ metadatakey ≡ vk[208:128] - Metadata (128 bytes)
    const metadataBytes = hexToBytes(validator.metadata)
    if (metadataBytes.length !== 128) {
      return safeError(
        new Error(`Metadata must be 128 bytes, got ${metadataBytes.length}`),
      )
    }
    validatorBytes.set(metadataBytes, offset)

    parts.push(validatorBytes)
  }

  // Concatenate all validator keys
  return safeResult(concatBytes(parts))
}

/**
 * Decode staging set according to Gray Paper specification.
 *
 * Decodes the Gray Paper compliant staging set structure:
 * ps_stagingset ∈ sequence[Cvalcount]{valkey}
 * valkey ≡ blob[336]
 *
 * Each validator key is decoded as a 336-byte blob with specific field layout:
 * - vk[0:32]: Bandersnatch key
 * - vk[32:32]: Ed25519 key
 * - vk[64:144]: BLS key
 * - vk[208:128]: Metadata
 *
 * ✅ CORRECT: Decodes fixed-length sequence of Cvalcount validator keys
 * ✅ CORRECT: Each validator key is exactly 336 bytes
 * ✅ CORRECT: Field layout matches Gray Paper specification exactly
 * ✅ CORRECT: Maintains round-trip compatibility with encoding
 *
 * @param data - Octet sequence to decode
 * @param configService - Configuration service for validator count
 * @returns Decoded staging set and remaining data
 */
export function decodeValidatorSet(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<ValidatorPublicKeys[]>> {
  const validatorCount = configService.numValidators
  const totalBytesNeeded = validatorCount * 336

  // Validate we have enough data for all validator keys
  if (data.length < totalBytesNeeded) {
    return safeError(
      new Error(
        `Insufficient data for staging set: need ${totalBytesNeeded} bytes, got ${data.length}`,
      ),
    )
  }

  const validators: ValidatorPublicKeys[] = []

  // Decode each validator key
  for (let i = 0; i < validatorCount; i++) {
    const validatorData = data.slice(i * 336, (i + 1) * 336)

    // Gray Paper: vk_bs ∈ bskey ≡ vk[0:32] - Bandersnatch key (32 bytes)
    const bandersnatch = validatorData.slice(0, 32)

    // Gray Paper: vk_ed ∈ edkey ≡ vk[32:32] - Ed25519 key (32 bytes)
    const ed25519 = validatorData.slice(32, 64)

    // Gray Paper: vk_bls ∈ blskey ≡ vk[64:144] - BLS key (144 bytes)
    const bls = validatorData.slice(64, 208)

    // Gray Paper: vk_metadata ∈ metadatakey ≡ vk[208:128] - Metadata (128 bytes)
    const metadata = validatorData.slice(208, 336)

    validators.push({
      bandersnatch: bytesToHex(bandersnatch),
      ed25519: bytesToHex(ed25519),
      bls: bytesToHex(bls),
      metadata: bytesToHex(metadata),
    })
  }

  const remaining = data.slice(totalBytesNeeded)
  const consumed = totalBytesNeeded

  return safeResult({
    value: validators,
    remaining,
    consumed,
  })
}
