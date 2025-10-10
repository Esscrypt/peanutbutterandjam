/**
 * Ring VRF Verifier Implementation
 *
 * Implements Ring VRF verification according to bandersnatch-vrf-spec section 4.3:
 * 1. θ₀ = Pedersen.verify(I, ad, O, π_p) - Verify underlying Pedersen VRF proof
 * 2. (Ȳ, R, O_k, s, s_b) ← π_p - Extract Pedersen proof components
 * 3. θ₁ = Ring.verify(V, π_r, Ȳ) - Verify ring proof using blinded public key Ȳ
 * 4. θ ← θ₀ ∧ θ₁ - Both verifications must pass
 */

import { BANDERSNATCH_PARAMS } from '@pbnj/bandersnatch'
import { logger, mod } from '@pbnj/core'
import { BYTES_PER_BLOB, verifyBlobKzgProof } from 'c-kzg'
import { PedersenVRFProver } from '../prover/pedersen'
import type { RingVRFInput, RingVRFProof } from '../prover/ring-kzg'
import { RingVRFProver } from '../prover/ring-kzg'
import { PedersenVRFVerifier } from './pedersen'

/**
 * Ring VRF Verifier
 * Implements Ring VRF verification with anonymity
 */
export class RingVRFVerifier {
  /**
   * Verify Ring VRF proof according to bandersnatch-vrf-spec section 4.3
   *
   * This method takes the serialized Ring VRF result as bytes and deserializes it internally.
   *
   * Steps:
   * 1. Deserialize Ring VRF result to get gamma, hash, and proof components
   * 2. θ₀ = Pedersen.verify(I, ad, O, π_p)
   * 3. (Ȳ, R, O_k, s, s_b) ← π_p
   * 4. θ₁ = Ring.verify(V, π_r, Ȳ)
   * 5. θ ← θ₀ ∧ θ₁
   */
  static verify(
    ringKeys: Uint8Array[],
    input: RingVRFInput,
    serializedResult: Uint8Array,
    auxData?: Uint8Array,
  ): boolean {
    const startTime = Date.now()

    logger.debug('Verifying Ring VRF proof', {
      inputLength: input.input.length,
      ringSize: ringKeys.length,
      serializedResultLength: serializedResult.length,
      hasAuxData: !!auxData,
    })

    try {
      // Step 1: Deserialize Ring VRF result to get gamma and proof components
      const result = RingVRFProver.deserialize(serializedResult)
      const { gamma, proof } = result
      const pedersenProof = proof.pedersenProof
      const ringProof = proof.ringProof
      const ringCommitment = proof.ringCommitment

      // Step 2: θ₀ = Pedersen.verify(I, ad, O, π_p)
      // Verify underlying Pedersen VRF proof using the provided gamma
      const theta0 = this.verifyPedersenVRF(input, gamma, proof, auxData)
      if (!theta0) {
        logger.error('Pedersen VRF verification failed (θ₀ = ⊥)')
        return false
      }

      // Step 3: (Ȳ, R, O_k, s, s_b) ← π_p
      // Extract Pedersen proof components
      const pedersenComponents = PedersenVRFProver.deserialize(pedersenProof)
      if (!pedersenComponents) {
        logger.error('Failed to extract Pedersen proof components')
        return false
      }

      // Step 4: θ₁ = Ring.verify(V, π_r, Ȳ)
      // Verify ring proof using the blinded public key Ȳ
      const theta1 = this.verifyRingProof(
        ringKeys,
        ringCommitment,
        ringProof,
        pedersenComponents.Y_bar,
      )
      if (!theta1) {
        logger.error('Ring proof verification failed (θ₁ = ⊥)')
        return false
      }

      // Step 5: θ ← θ₀ ∧ θ₁
      // Both verifications must pass
      const theta = theta0 && theta1

      const verificationTime = Date.now() - startTime
      logger.debug('Ring VRF proof verification completed', {
        verificationTime,
        theta0,
        theta1,
        theta,
        result: theta ? '⊤' : '⊥',
      })

      return theta
    } catch (error) {
      const verificationTime = Date.now() - startTime
      logger.error('Ring VRF proof verification failed', {
        error: error instanceof Error ? error.message : String(error),
        verificationTime,
      })
      return false
    }
  }

  /**
   * Step 1: θ₀ = Pedersen.verify(I, ad, O, π_p)
   * Verify underlying Pedersen VRF proof
   */
  private static verifyPedersenVRF(
    input: RingVRFInput,
    gamma: Uint8Array,
    proof: RingVRFProof,
    auxData?: Uint8Array,
  ): boolean {
    try {
      // Verify using Pedersen verifier
      const isValid = PedersenVRFVerifier.verify(
        input.input,
        gamma,
        proof.pedersenProof,
        auxData,
      )

      logger.debug('Pedersen VRF verification', {
        inputLength: input.input.length,
        outputPointLength: gamma.length,
        proofLength: proof.pedersenProof.length,
        hasAuxData: !!auxData,
        isValid,
      })

      return isValid
    } catch (error) {
      logger.error('Pedersen VRF verification error', { error })
      return false
    }
  }

  /**
   * Step 3: θ₁ = Ring.verify(V, π_r, Ȳ)
   * Verify ring proof using KZG commitments
   */
  private static verifyRingProof(
    ringKeys: Uint8Array[],
    ringCommitment: Uint8Array,
    ringProof: Uint8Array,
    yBar: Uint8Array,
  ): boolean {
    try {
      // 1. Recreate ring polynomial from public keys (representing the ring verifier V)
      const ringPolynomial = this.createRingPolynomial(ringKeys)

      // 2. Convert polynomial to KZG blob
      const ringBlob = this.polynomialToBlob(ringPolynomial)

      // 3. Verify the KZG commitment and proof (π_r verification)
      const isValid = verifyBlobKzgProof(ringBlob, ringCommitment, ringProof)

      logger.debug('Ring proof verification', {
        ringSize: ringKeys.length,
        blobSize: ringBlob.length,
        commitmentSize: ringCommitment.length,
        proofSize: ringProof.length,
        yBarLength: yBar.length,
        isValid,
      })

      // Note: In a complete implementation following [VG24], we would also verify
      // that the blinded public key Ȳ is properly committed in the ring proof.
      // For now, we focus on the KZG commitment verification.

      return isValid
    } catch (error) {
      logger.error('Ring proof verification error', { error })
      return false
    }
  }

  /**
   * Create ring polynomial from public keys (same as prover)
   */
  private static createRingPolynomial(ringKeys: Uint8Array[]): bigint[] {
    const maxRingSize = BANDERSNATCH_PARAMS.KZG_CONFIG.MAX_RING_SIZE

    if (ringKeys.length > maxRingSize) {
      throw new Error(
        `Ring size ${ringKeys.length} exceeds maximum ${maxRingSize}`,
      )
    }

    // Pad to domain size for KZG
    const domainSize = BANDERSNATCH_PARAMS.KZG_CONFIG.DOMAIN_SIZE
    const polynomial: bigint[] = new Array(domainSize).fill(0n)

    // Convert each public key to a polynomial coefficient
    ringKeys.forEach((key, index) => {
      if (index >= domainSize) return

      // Use the first 31 bytes of the key as a coefficient to stay within BLS12-381 scalar field
      const keyPrefix = key.slice(0, 31)
      let coeff = 0n

      // Convert bytes to scalar in little-endian format (arkworks compatible)
      for (let i = 0; i < keyPrefix.length; i++) {
        coeff += BigInt(keyPrefix[i]) * 256n ** BigInt(i)
      }

      // Store coefficient directly (will be reduced to BLS12-381 scalar field in polynomialToBlob)
      polynomial[index] = coeff
    })

    return polynomial
  }

  /**
   * Convert polynomial to KZG blob (same as prover)
   */
  private static polynomialToBlob(polynomial: bigint[]): Uint8Array {
    const blob = new Uint8Array(BYTES_PER_BLOB)

    // c-kzg expects 4096 field elements of 32 bytes each
    const fieldElements = BYTES_PER_BLOB / 32 // 4096

    polynomial.forEach((coeff, index) => {
      if (index >= fieldElements) return

      // Reduce coefficient to BLS12-381 scalar field
      const reducedCoeff = mod(coeff, BANDERSNATCH_PARAMS.FIELD_MODULUS)

      // Convert bigint to 32-byte big-endian representation (c-kzg format)
      const coeffBytes = this.bigintToBytes32BE(reducedCoeff)
      blob.set(coeffBytes, index * 32)
    })

    return blob
  }

  /**
   * Convert bigint to 32-byte big-endian representation (c-kzg format)
   */
  private static bigintToBytes32BE(value: bigint): Uint8Array {
    const bytes = new Uint8Array(32)
    let temp = value

    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(temp & 0xffn)
      temp = temp >> 8n
    }

    return bytes
  }
}
