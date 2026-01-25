/**
 * Fallback Block Sealing using IETF VRF
 *
 * Implements Gray Paper safrole.tex equation 154:
 * H_sealsig ∈ bssignature{H_authorbskey}{Xfallback ∥ entropy'_3}{encodeunsignedheader{H}}
 *
 * ============================================================================
 * GRAY PAPER SPECIFICATION:
 * ============================================================================
 *
 * Gray Paper safrole.tex equation 154 (fallback case):
 * H_sealsig ∈ bssignature{H_authorbskey}{Xfallback ∥ entropy'_3}{encodeunsignedheader{H}}
 *
 * Gray Paper safrole.tex equation 160:
 * Xfallback = "$jam_fallback_seal"
 *
 * Gray Paper bandersnatch.tex line 5:
 * The singly-contextualized Bandersnatch Schnorr-like signatures bssignature{k}{c}{m}
 * are defined as a formulation under the IETF VRF template
 *
 * Gray Paper bandersnatch.tex line 8:
 * bssignature{k ∈ bskey}{c ∈ hash}{m ∈ blob} ⊂ blob[96]
 * banderout{s ∈ bssignature{k}{c}{m}} ∈ hash ≡ text{output}(x | x ∈ bssignature{k}{c}{m})[:32]
 *
 * ============================================================================
 * IMPLEMENTATION NOTES:
 * ============================================================================
 *
 * 1. IETF VRF provides deterministic, verifiable randomness
 * 2. Context: Xfallback ∥ entropy'_3 (concatenated)
 * 3. Message: encodeunsignedheader{H} (block header without seal signature)
 * 4. Output: 96-byte IETF VRF signature
 * 5. VRF output: 32-byte hash for entropy generation
 *
 * @fileoverview Fallback block sealing using IETF VRF on Bandersnatch curve
 */

import {
  getBanderoutFromGamma,
  IETFVRFProver,
  IETFVRFVerifier,
} from '@pbnjam/bandersnatch-vrf'
import { encodeUnsignedHeader } from '@pbnjam/codec'
import { blake2bHash, bytesToHex, hexToBytes, logger } from '@pbnjam/core'
import type {
  IConfigService,
  IValidatorSetManager,
  UnsignedBlockHeader,
} from '@pbnjam/types'
import { type Safe, safeError, safeResult } from '@pbnjam/types'

/**
 * Gray Paper hardcoded context string for fallback sealing
 * Gray Paper safrole.tex equation 160: Xfallback = "$jam_fallback_seal"
 */
const XFALLBACK_SEAL = new TextEncoder().encode('jam_fallback_seal')

/**
 * Generate IETF VRF signature for fallback block sealing
 *
 * Implements Gray Paper safrole.tex equation 154:
 * H_sealsig ∈ bssignature{H_authorbskey}{Xfallback ∥ entropy'_3}{encodeunsignedheader{H}}
 *
 * This generates a deterministic, verifiable signature that can be used to:
 * 1. Seal blocks when no ticket is available
 * 2. Provide entropy for the next block's VRF signature
 * 3. Prove the block was authored by a validator with the correct secret key
 *
 * @param validatorSecretKey - Validator's Bandersnatch secret key (32 bytes)
 * @param entropy3 - Third-oldest epoch entropy (32 bytes)
 * @param unsignedHeader - Block header without seal signature (blob)
 * @returns IETF VRF signature (96 bytes) and VRF output hash (32 bytes)
 */
export function generateFallbackSealSignature(
  validatorSecretKey: Uint8Array,
  entropy3: Uint8Array,
  unsignedHeader: UnsignedBlockHeader,
  configService: IConfigService,
): Safe<{
  signature: Uint8Array // 96-byte IETF VRF signature
  vrfOutput: Uint8Array // 32-byte VRF output hash
}> {
  // Validate inputs
  if (validatorSecretKey.length !== 32) {
    return safeError(new Error('Validator secret key must be 32 bytes'))
  }

  if (entropy3.length !== 32) {
    return safeError(new Error('entropy_3 must be 32 bytes'))
  }

  const [error, encodedUnsignedHeader] = encodeUnsignedHeader(
    unsignedHeader,
    configService,
  )
  if (error) {
    return safeError(error)
  }

  // Build VRF context according to Gray Paper equation 154:
  // context = Xfallback ∥ entropy'_3
  const context = new Uint8Array(XFALLBACK_SEAL.length + entropy3.length)
  let offset = 0
  context.set(XFALLBACK_SEAL, offset)
  offset += XFALLBACK_SEAL.length
  context.set(entropy3, offset)

  // Generate IETF VRF signature using IETFVRFProver
  // Gray Paper equation 154: bssignature{k}{c}{m} where:
  // k = validatorSecretKey, c = context, m = unsignedHeader
  // NOTE: IETFVRFProver.prove parameter order is (secretKey, input, auxData)
  // Must match verification: IETFVRFVerifier.verify(publicKey, context, proof, encodedUnsignedHeader)
  // where input = context and auxData = message per IETF VRF specification
  const vrfResult = IETFVRFProver.prove(
    validatorSecretKey,
    context, // Xfallback ∥ entropy'_3 (context) - goes to _input parameter
    encodedUnsignedHeader, // encodeunsignedheader{H} (message) - goes to _auxData parameter
  )

  // Verify the signature is the correct length (96 bytes per Gray Paper)
  if (vrfResult.proof.length !== 96) {
    logger.warn('IETF VRF signature has unexpected length', {
      expected: 96,
      actual: vrfResult.proof.length,
    })
  }

  // Verify the VRF output is the correct length (32 bytes per Gray Paper)
  if (vrfResult.gamma.length !== 32) {
    logger.warn('IETF VRF output has unexpected length', {
      expected: 32,
      actual: vrfResult.gamma.length,
    })
  }

  const vrfOutput = getBanderoutFromGamma(vrfResult.gamma)

  return safeResult({
    signature: vrfResult.proof,
    vrfOutput: vrfOutput,
  })
}

/**
 * Verify IETF VRF signature for fallback block sealing
 *
 * Implements Gray Paper safrole.tex equation 154 verification:
 * H_sealsig ∈ bssignature{H_authorbskey}{Xfallback ∥ entropy'_3}{encodeunsignedheader{H}}
 *
 * This verifies that:
 * 1. The signature was generated by someone with the correct secret key
 * 2. The signature corresponds to the correct context and message
 * 3. The VRF output provides deterministic, verifiable randomness
 *
 * @param validatorPublicKey - Validator's Bandersnatch public key (32 bytes)
 * @param signature - IETF VRF signature to verify (96 bytes)
 * @param entropy3 - Third-oldest epoch entropy (32 bytes)
 * @param unsignedHeader - Block header without seal signature (blob)
 * @returns True if signature is valid, false otherwise
 */
export function verifyFallbackSealSignature(
  validatorPublicKey: Uint8Array,
  proof: Uint8Array,
  entropy3: Uint8Array,
  unsignedHeader: UnsignedBlockHeader,
  configService: IConfigService,
): Safe<boolean> {
  // Validate inputs
  if (validatorPublicKey.length !== 32) {
    return safeError(new Error('Validator public key must be 32 bytes'))
  }

  if (proof.length !== 96) {
    return safeError(new Error('IETF VRF signature must be 96 bytes'))
  }

  if (entropy3.length !== 32) {
    return safeError(new Error('entropy_3 must be 32 bytes'))
  }

  const [error, encodedUnsignedHeader] = encodeUnsignedHeader(
    unsignedHeader,
    configService,
  )
  if (error) {
    return safeError(error)
  }

  // Build VRF context according to Gray Paper equation 154:
  // context = Xfallback ∥ entropy'_3
  const context = new Uint8Array(XFALLBACK_SEAL.length + entropy3.length)
  let offset = 0
  context.set(XFALLBACK_SEAL, offset)
  offset += XFALLBACK_SEAL.length
  context.set(entropy3, offset)

  // Verify IETF VRF signature using IETFVRFVerifier
  // Gray Paper equation 154: bssignature{k}{c}{m} where:
  // k = validatorPublicKey, c = context, m = unsignedHeader
  // NOTE: IETFVRFVerifier.verify parameter order is (publicKey, input, proof, auxData)
  // where input = message and auxData = context per IETF VRF specification
  const isValid = IETFVRFVerifier.verify(
    validatorPublicKey,
    context, // Xfallback ∥ entropy'_3 (context) - goes to _input parameter
    proof,
    encodedUnsignedHeader, // encodeunsignedheader{H} (message) - goes to _auxData parameter
  )

  return safeResult(isValid)
}

/**
 * Generate fallback key sequence according to Gray Paper Eq. 220-228
 *
 * Gray Paper: F: (hash, sequence<valkey>) → sequence[EPOCH_LENGTH]{bskey}
 * F(r, k) = [cyclic{k[decode[4]{blake(r ∥ encode[4]{i})}_4]}_bs for i ∈ epochindex]
 */
export function generateFallbackKeySequence(
  entropy2: Uint8Array,
  validatorSetManager: IValidatorSetManager,
  configService: IConfigService,
): Safe<Uint8Array[]> {
  const epochLength = configService.epochDuration
  const fallbackKeys: Uint8Array[] = []

  for (let i = 0; i < epochLength; i++) {
    // Gray Paper: encode[4]{i} - Encode index as 4 bytes
    // Gray Paper serialization.tex line 100: "Values are encoded in a regular little-endian fashion"
    const indexBytes = new Uint8Array(4)
    new DataView(indexBytes.buffer).setUint32(0, i, true) // true = little-endian

    // Gray Paper: blake(r ∥ encode[4]{i})
    const combined = new Uint8Array(entropy2.length + indexBytes.length) // r ∥ encode[4]{i}
    combined.set(entropy2, 0)
    combined.set(indexBytes, entropy2.length)

    const [hashError, hashData] = blake2bHash(combined)
    if (hashError) {
      return safeError(hashError)
    }

    // Gray Paper: decode[4]{hash}_4 - Take first 4 bytes of hash as a 32-bit integer
    // Gray Paper serialization.tex line 100: "Values are encoded in a regular little-endian fashion"
    const hashBytes = hexToBytes(hashData)
    const dataView = new DataView(hashBytes.buffer.slice(0, 4))
    const decodedIndex = dataView.getUint32(0, true) // true = little-endian

    const activeValidators = validatorSetManager.getActiveValidators()
    const activeValidatorSize = activeValidators.length
    // Use the decoded index to select a validator (cyclic indexing)
    const validatorIndex = decodedIndex % activeValidatorSize

    // Gray Paper: cyclic{k[index]}_bs - Get Bandersnatch key from validator
    // This should never be out of bounds because we use modulo, but we handle it just in case
    if (activeValidatorSize === 0) {
      return safeError(
        new Error(
          'Active validator set is empty, cannot generate fallback key sequence',
        ),
      )
    }

    // Ensure index is within bounds (should always be true with modulo)
    const safeIndex = validatorIndex % activeValidatorSize

    // Log phase 0 calculation for debugging
    if (i === 0) {
      logger.debug('[generateFallbackKeySequence] Phase 0 calculation', {
        phase: i,
        entropy2: bytesToHex(entropy2),
        indexBytes: Array.from(indexBytes),
        combinedInput: bytesToHex(combined),
        hashData,
        decodedIndex: decodedIndex.toString(),
        activeValidatorSize,
        validatorIndex: safeIndex,
      })
    }

    // Get the validator's Bandersnatch key
    const [bandersnatchKeyError, publicKeys] =
      validatorSetManager.getValidatorAtIndex(safeIndex)
    if (bandersnatchKeyError) {
      return safeError(bandersnatchKeyError)
    }

    // Add the Bandersnatch key to the sequence
    const bandersnatchKey = publicKeys.bandersnatch
    fallbackKeys.push(hexToBytes(bandersnatchKey))

    // Log phase 0 result
    if (i === 0) {
      logger.debug('[generateFallbackKeySequence] Phase 0 result', {
        phase: i,
        selectedValidatorIndex: safeIndex,
        sealKey: bandersnatchKey,
      })
    }
  }

  return safeResult(fallbackKeys)
}
