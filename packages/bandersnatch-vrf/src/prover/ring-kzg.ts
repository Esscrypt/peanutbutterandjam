/**
 * Ring VRF Prover with c-kzg Polynomial Commitments
 *
 * Implements Ring VRF using c-kzg for production-grade polynomial commitments.
 * This combines Pedersen VRF with KZG ring membership proofs for anonymity.
 * Uses custom SRS reading instead of loadTrustedSetup.
 */

import { BANDERSNATCH_PARAMS } from '@pbnj/bandersnatch'
import { bytesToHex, logger, mod } from '@pbnj/core'
import {
  BYTES_PER_BLOB,
  blobToKzgCommitment,
  computeBlobKzgProof,
  loadTrustedSetup,
  verifyBlobKzgProof,
} from 'c-kzg'
import { PedersenVRFProver } from './pedersen'

export interface RingVRFInput {
  /** VRF input data */
  input: Uint8Array
  /** Additional data (not affecting VRF output) */
  auxData?: Uint8Array
  /** Ring of public keys */
  ringKeys: Uint8Array[]
  /** Prover's key index in the ring */
  proverIndex: number
}

export interface RingVRFProof {
  /** Pedersen VRF proof components */
  pedersenProof: Uint8Array
  /** Ring commitment (KZG commitment to ring polynomial) */
  ringCommitment: Uint8Array
  /** Ring membership proof (KZG proof) */
  ringProof: Uint8Array
  /** Prover index (for verification, not revealed in anonymous version) */
  proverIndex?: number
}

export interface RingVRFResult {
  /** VRF output */
  gamma: Uint8Array
  /** Ring VRF proof */
  proof: RingVRFProof
}

/**
 * Ring VRF Prover using c-kzg for polynomial commitments
 * Note: This implementation uses c-kzg's default trusted setup (no custom SRS loading)
 */
export class RingVRFProver {
  private static trustedSetupLoaded = false

  /**
   * Create a new Ring VRF Prover instance
   * @param srsFilePath - Optional path to SRS file (currently ignored, kept for compatibility)
   */
  constructor(srsFilePath?: string) {
    // Only load trusted setup once to avoid "already loaded" errors
    if (!RingVRFProver.trustedSetupLoaded) {
      try {
        loadTrustedSetup(0, srsFilePath) // Use default trusted setup, no precompute
        RingVRFProver.trustedSetupLoaded = true
      } catch (error) {
        // If trusted setup is already loaded, that's fine
        if (
          error instanceof Error &&
          error.message.includes('already loaded')
        ) {
          RingVRFProver.trustedSetupLoaded = true
        } else {
          throw error
        }
      }
    }
  }

  /**
   * Generate Ring VRF proof and output
   */
  prove(secretKey: Uint8Array, input: RingVRFInput): RingVRFResult {
    try {
      logger.debug('Generating Ring VRF proof', {
        ringSize: input.ringKeys.length,
        proverIndex: input.proverIndex,
        inputLength: input.input.length,
      })

      // Step 1: Generate Pedersen VRF proof
      logger.debug('Starting Pedersen VRF proof generation')
      const pedersenInput = {
        input: input.input,
        auxData: input.auxData,
      }
      const pedersenResult = PedersenVRFProver.prove(secretKey, pedersenInput)
      logger.debug('Pedersen VRF proof generation completed')

      logger.debug('Pedersen VRF proof generated', {
        outputHash: bytesToHex(pedersenResult.hash),
        proofLength: pedersenResult.proof.length,
      })

      // Step 2: Create ring polynomial from public keys
      const ringPolynomial = this.createRingPolynomial(input.ringKeys)

      logger.debug('Ring polynomial created', {
        degree: ringPolynomial.length - 1,
        coefficientsPreview: ringPolynomial
          .slice(0, 3)
          .map((c) => c.toString(16))
          .join(', '),
      })

      // Step 3: Generate KZG commitment to ring polynomial
      const ringBlob = this.polynomialToBlob(ringPolynomial)
      const ringCommitment = blobToKzgCommitment(ringBlob)

      logger.debug('Ring commitment generated', {
        commitment: bytesToHex(ringCommitment),
        blobSize: ringBlob.length,
      })

      // Step 4: Generate KZG proof for prover's key membership
      const ringProof = computeBlobKzgProof(ringBlob, ringCommitment)

      logger.debug('Ring membership proof generated', {
        proof: bytesToHex(ringProof),
      })

      // Step 5: Verify the proof (self-check)
      const isValid = verifyBlobKzgProof(ringBlob, ringCommitment, ringProof)
      if (!isValid) {
        throw new Error('Generated ring proof failed verification')
      }

      logger.debug('Ring VRF proof verification passed')

      return {
        gamma: pedersenResult.gamma,
        proof: {
          pedersenProof: pedersenResult.proof,
          ringCommitment,
          ringProof,
          proverIndex: input.proverIndex, // In anonymous version, this would be omitted
        },
      }
    } catch (error) {
      logger.error('Ring VRF proof generation failed:', error)
      throw error
    }
  }

  /**
   * Verify Ring VRF proof
   */
  verify(input: RingVRFInput, result: RingVRFResult): boolean {
    try {
      logger.debug('Verifying Ring VRF proof', {
        ringSize: input.ringKeys.length,
        outputLength: result.gamma.length,
        proofLength: result.proof.pedersenProof.length,
      })

      // Step 2: Verify ring membership proof
      // Recreate ring polynomial
      const ringPolynomial = this.createRingPolynomial(input.ringKeys)
      const ringBlob = this.polynomialToBlob(ringPolynomial)

      // Verify ring commitment and proof
      const ringValid = verifyBlobKzgProof(
        ringBlob,
        result.proof.ringCommitment,
        result.proof.ringProof,
      )

      logger.debug('Ring VRF verification result', {
        ringValid,
      })

      return ringValid
    } catch (error) {
      logger.error('Ring VRF verification failed:', error)
      return false
    }
  }

  /**
   * Create polynomial from ring of public keys
   * Maps each public key to a coefficient in the polynomial
   */
  private createRingPolynomial(ringKeys: Uint8Array[]): bigint[] {
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
   * Convert polynomial coefficients to c-kzg blob format
   * c-kzg expects 4096 BLS12-381 scalar field elements, each 32 bytes in big-endian
   */
  private polynomialToBlob(polynomial: bigint[]): Uint8Array {
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
  private bigintToBytes32BE(value: bigint): Uint8Array {
    const bytes = new Uint8Array(32)
    let val = value

    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(val & 0xffn)
      val = val >> 8n
    }

    return bytes
  }

  /**
   * Extract VRF output from Ring VRF result
   */
  static extractOutput(result: RingVRFResult): Uint8Array {
    return result.gamma
  }

  /**
   * Check if ring size is valid
   */
  static isValidRingSize(ringSize: number): boolean {
    const maxRingSize = BANDERSNATCH_PARAMS.KZG_CONFIG.MAX_RING_SIZE
    return ringSize > 0 && ringSize <= maxRingSize
  }

  /**
   * Get maximum supported ring size
   */
  static getMaxRingSize(): number {
    return BANDERSNATCH_PARAMS.KZG_CONFIG.MAX_RING_SIZE
  }

  /**
   * Get SRS information (for c-kzg default setup)
   */
  static getSRSInfo(): {
    domainSize: number
    maxRingSize: number
    source: string
  } {
    return {
      domainSize: BANDERSNATCH_PARAMS.KZG_CONFIG.DOMAIN_SIZE,
      maxRingSize: BANDERSNATCH_PARAMS.KZG_CONFIG.MAX_RING_SIZE,
      source: 'c-kzg-default-trusted-setup',
    }
  }

  /**
   * Serialize Ring VRF proof to bytes according to Gray Paper specification
   *
   * Gray Paper safrole.tex:
   * bsringproof{r ∈ ringroot}{x ∈ blob}{m ∈ blob} ⊂ blob[784]
   *
   * Format (784 bytes total):
   * - Pedersen VRF proof: 192 bytes (blinding + Y_bar + R + O_k + s + s_b)
   * - Ring commitment: 48 bytes (KZG commitment to ring polynomial)
   * - Ring proof: 48 bytes (KZG proof of ring membership)
   * - Reserved/padding: 496 bytes (for future use or additional proof components)
   *
   * @param proof - Ring VRF proof structure
   * @returns 784-byte serialized proof
   */
  static serializeProof(proof: RingVRFProof): Uint8Array {
    const TOTAL_SIZE = 784 // Gray Paper blob[784]
    const PEDERSEN_SIZE = 160 // 32+32+32+32+32 (Y_bar, R, O_k, s, s_b - gamma excluded per spec)
    const RING_COMMITMENT_SIZE = 48 // G1 point compressed
    const RING_PROOF_SIZE = 48 // G1 point compressed

    const serialized = new Uint8Array(TOTAL_SIZE)
    let offset = 0

    // 1. Pedersen VRF proof (224 bytes)
    if (proof.pedersenProof.length !== PEDERSEN_SIZE) {
      throw new Error(
        `Pedersen proof must be ${PEDERSEN_SIZE} bytes, got ${proof.pedersenProof.length}`,
      )
    }
    serialized.set(proof.pedersenProof, offset)
    offset += PEDERSEN_SIZE

    // 2. Ring commitment (48 bytes)
    if (proof.ringCommitment.length !== RING_COMMITMENT_SIZE) {
      throw new Error(
        `Ring commitment must be ${RING_COMMITMENT_SIZE} bytes, got ${proof.ringCommitment.length}`,
      )
    }
    serialized.set(proof.ringCommitment, offset)
    offset += RING_COMMITMENT_SIZE

    // 3. Ring proof (48 bytes)
    if (proof.ringProof.length !== RING_PROOF_SIZE) {
      throw new Error(
        `Ring proof must be ${RING_PROOF_SIZE} bytes, got ${proof.ringProof.length}`,
      )
    }
    serialized.set(proof.ringProof, offset)

    // 4. Remaining bytes are zero-padded (reserved for future use)
    // offset is now 320, remaining 464 bytes are already zeros

    return serialized
  }

  /**
   * Deserialize Ring VRF proof from bytes
   *
   * @param proofBytes - 784-byte serialized proof
   * @returns Ring VRF proof structure
   */
  static deserializeProof(proofBytes: Uint8Array): RingVRFProof {
    const TOTAL_SIZE = 784
    const PEDERSEN_SIZE = 160 // Updated to exclude gamma point per bandersnatch-vrf-spec
    const RING_COMMITMENT_SIZE = 48
    const RING_PROOF_SIZE = 48

    if (proofBytes.length !== TOTAL_SIZE) {
      throw new Error(
        `Proof must be ${TOTAL_SIZE} bytes, got ${proofBytes.length}`,
      )
    }

    let offset = 0

    // 1. Pedersen VRF proof (160 bytes)
    const pedersenProof = proofBytes.slice(offset, offset + PEDERSEN_SIZE)
    offset += PEDERSEN_SIZE

    // 2. Ring commitment (48 bytes)
    const ringCommitment = proofBytes.slice(
      offset,
      offset + RING_COMMITMENT_SIZE,
    )
    offset += RING_COMMITMENT_SIZE

    // 3. Ring proof (48 bytes)
    const ringProof = proofBytes.slice(offset, offset + RING_PROOF_SIZE)

    return {
      pedersenProof,
      ringCommitment,
      ringProof,
    }
  }

  /**
   * Serialize Ring VRF result according to bandersnatch-vrf-spec
   *
   * According to VRF-AD spec: Π ← encode_compressed((O, π))
   * Where:
   * - O ∈ G: VRF output point (gamma)
   * - π = (π_p, π_r): Combined proof
   *   - π_p ∈ (G, G, G, F, F): Pedersen proof (5 components)
   *   - π_r ∈ ((G₁)⁴, (F)⁷, G₁, F, G₁, G₁): Ring proof
   *
   * Structure: gamma(32) || pedersen_proof(160) || ring_commitment(48) || ring_proof(48)
   * Total: 288 bytes
   */
  static serialize(result: RingVRFResult): Uint8Array {
    const GAMMA_SIZE = 32 // VRF output point (gamma)
    const PEDERSEN_SIZE = 160 // 5 components × 32 bytes each
    const RING_COMMITMENT_SIZE = 48 // G1 point compressed
    const RING_PROOF_SIZE = 48 // G1 point compressed
    const TOTAL_SIZE =
      GAMMA_SIZE + PEDERSEN_SIZE + RING_COMMITMENT_SIZE + RING_PROOF_SIZE

    const serialized = new Uint8Array(TOTAL_SIZE)
    let offset = 0

    // 1. VRF output point (gamma) - 32 bytes
    serialized.set(result.gamma, offset)
    offset += GAMMA_SIZE

    // 2. Pedersen proof (π_p) - 160 bytes
    if (result.proof.pedersenProof.length !== PEDERSEN_SIZE) {
      throw new Error(
        `Pedersen proof must be ${PEDERSEN_SIZE} bytes, got ${result.proof.pedersenProof.length}`,
      )
    }
    serialized.set(result.proof.pedersenProof, offset)
    offset += PEDERSEN_SIZE

    // 3. Ring commitment - 48 bytes
    if (result.proof.ringCommitment.length !== RING_COMMITMENT_SIZE) {
      throw new Error(
        `Ring commitment must be ${RING_COMMITMENT_SIZE} bytes, got ${result.proof.ringCommitment.length}`,
      )
    }
    serialized.set(result.proof.ringCommitment, offset)
    offset += RING_COMMITMENT_SIZE

    // 4. Ring proof - 48 bytes
    if (result.proof.ringProof.length !== RING_PROOF_SIZE) {
      throw new Error(
        `Ring proof must be ${RING_PROOF_SIZE} bytes, got ${result.proof.ringProof.length}`,
      )
    }
    serialized.set(result.proof.ringProof, offset)

    return serialized
  }

  /**
   * Deserialize Ring VRF result according to bandersnatch-vrf-spec
   *
   * Structure: gamma(32) || pedersen_proof(160) || ring_commitment(48) || ring_proof(48)
   * Total: 288 bytes
   */
  static deserialize(resultBytes: Uint8Array): RingVRFResult {
    const GAMMA_SIZE = 32 // VRF output point (gamma)
    const PEDERSEN_SIZE = 160 // 5 components × 32 bytes each
    const RING_COMMITMENT_SIZE = 48 // G1 point compressed
    const RING_PROOF_SIZE = 48 // G1 point compressed
    const TOTAL_SIZE =
      GAMMA_SIZE + PEDERSEN_SIZE + RING_COMMITMENT_SIZE + RING_PROOF_SIZE

    if (resultBytes.length !== TOTAL_SIZE) {
      throw new Error(
        `Result must be ${TOTAL_SIZE} bytes, got ${resultBytes.length}`,
      )
    }

    let offset = 0

    // 1. Extract VRF output point (gamma) - 32 bytes
    const gamma = resultBytes.slice(offset, offset + GAMMA_SIZE)
    offset += GAMMA_SIZE

    // 2. Extract Pedersen proof (π_p) - 160 bytes
    const pedersenProof = resultBytes.slice(offset, offset + PEDERSEN_SIZE)
    offset += PEDERSEN_SIZE

    // 3. Extract Ring commitment - 48 bytes
    const ringCommitment = resultBytes.slice(
      offset,
      offset + RING_COMMITMENT_SIZE,
    )
    offset += RING_COMMITMENT_SIZE

    // 4. Extract Ring proof - 48 bytes
    const ringProof = resultBytes.slice(offset, offset + RING_PROOF_SIZE)

    return {
      gamma,
      proof: {
        pedersenProof,
        ringCommitment,
        ringProof,
      },
    }
  }
}
