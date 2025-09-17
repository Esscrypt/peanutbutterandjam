/**
 * Pedersen VRF Prover Implementation
 *
 * Implements Pedersen VRF proof generation with blinding
 * Reference: Bandersnatch VRF specification section 3
 */

import { sha512 } from '@noble/hashes/sha2'
import {
  BANDERSNATCH_PARAMS,
  BandersnatchCurve,
  elligator2HashToCurve,
} from '@pbnj/bandersnatch'
import { bytesToBigInt, logger, numberToBytes } from '@pbnj/core'
import type { VRFProofWithOutput } from '@pbnj/types'
import { generateNonceRfc8032 } from '../crypto/nonce-rfc8032'
import { DEFAULT_PROVER_CONFIG } from './config'
import type { ProverConfig } from './types'

/**
 * Pedersen VRF proof structure
 */
export interface PedersenVRFProof {
  /** Blinded public key commitment Y_bar = x*G + b*B */
  Y_bar: Uint8Array
  /** Commitment R = k*G + k_b*B */
  R: Uint8Array
  /** Output commitment O_k = k*I */
  O_k: Uint8Array
  /** Proof scalar s = k + c*x */
  s: Uint8Array
  /** Blinding proof scalar s_b = k_b + c*b */
  s_b: Uint8Array
}

/**
 * Pedersen VRF input
 */
export interface PedersenVRFInput {
  /** VRF input data */
  input: Uint8Array
  /** Additional data */
  auxData?: Uint8Array
}

/**
 * Pedersen VRF Prover
 * Implements Pedersen VRF with blinding for anonymity
 */
export class PedersenVRFProver {
  /**
   * Generate Pedersen VRF proof and output
   */
  static prove(
    secretKey: Uint8Array,
    blindingFactor: Uint8Array,
    input: PedersenVRFInput,
    config?: ProverConfig,
  ): VRFProofWithOutput {
    const startTime = Date.now()
    const mergedConfig = { ...DEFAULT_PROVER_CONFIG, ...config }

    logger.debug('Generating Pedersen VRF proof', {
      inputLength: input.input.length,
      hasAuxData: !!input.auxData,
      config: mergedConfig,
    })

    try {
      // TODO: Step 1 - Hash input to curve point (H1) using Elligator2
      // This should map the input to a point on the Bandersnatch curve
      const I = this.hashToCurve(input.input, mergedConfig)

      // TODO: Step 2 - Generate VRF output O = x * I
      // This is the main VRF output that will be verified
      const O = this.scalarMultiply(I, secretKey)

      // TODO: Step 3 - Generate nonces k and k_b using RFC-9381
      // These must be cryptographically secure and deterministic
      const k = this.generateNonce(secretKey, I)
      const k_b = this.generateNonce(blindingFactor, I)

      // TODO: Step 4 - Generate blinded public key commitment Y_bar = x*G + b*B
      // This hides the public key using the blinding factor
      const Y_bar = this.generateBlindedPublicKey(secretKey, blindingFactor)

      // TODO: Step 5 - Generate commitment R = k*G + k_b*B
      // This is used in the key commitment verification
      const R = this.generateCommitment(k, k_b)

      // TODO: Step 6 - Generate output commitment O_k = k*I
      // This is used in the output commitment verification
      const O_k = this.scalarMultiply(I, k)

      // Debug: Check if O_k is valid
      const O_kPoint = BandersnatchCurve.bytesToPoint(O_k)
      logger.debug('Generated O_k point', {
        O_kX: O_kPoint.x.toString(16),
        O_kY: O_kPoint.y.toString(16),
        k: bytesToBigInt(k).toString(16),
        IX: BandersnatchCurve.bytesToPoint(I).x.toString(16),
        IY: BandersnatchCurve.bytesToPoint(I).y.toString(16),
      })

      // TODO: Step 7 - Generate challenge c = H2(Y_bar, I, O, R, O_k, ad)
      // This must be the same in both prover and verifier
      const c = this.generateChallenge(Y_bar, I, O, R, O_k, input.auxData)

      // Debug: Log challenge generation
      logger.debug('Prover challenge generation', {
        c: c.toString(16),
        Y_barLength: Y_bar.length,
        ILength: I.length,
        OLength: O.length,
        RLength: R.length,
        O_kLength: O_k.length,
        auxDataLength: input.auxData?.length || 0,
      })

      // TODO: Step 8 - Generate proof scalars s = k + c*x and s_b = k_b + c*b
      // These scalars prove knowledge of the secret key and blinding factor
      const s = this.generateProofScalar(k, c, secretKey)
      const s_b = this.generateBlindingProofScalar(k_b, c, blindingFactor)

      // 9. Hash output (H2)
      const hash = this.hashOutput(O, mergedConfig)

      const generationTime = Date.now() - startTime

      logger.debug('Pedersen VRF proof generated successfully', {
        generationTime,
        proofSize: this.serializeProof({ Y_bar, R, O_k, s, s_b }).length,
        outputSize: hash.length,
      })

      return {
        output: { gamma: O, hash },
        proof: this.serializeProof({ Y_bar, R, O_k, s, s_b }),
      }
    } catch (error) {
      logger.error('Pedersen VRF proof generation failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw new Error(
        `Pedersen VRF proof generation failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Hash input to curve point (H1 function)
   */
  static hashToCurve(message: Uint8Array, config?: ProverConfig): Uint8Array {
    if (config?.hashToCurve) {
      return config.hashToCurve(message)
    }

    // Use Elligator2 hash-to-curve for proper implementation
    const point = elligator2HashToCurve(message)
    return BandersnatchCurve.pointToBytes(point)
  }

  /**
   * Scalar multiplication on Bandersnatch curve
   */
  private static scalarMultiply(
    pointBytes: Uint8Array,
    scalarBytes: Uint8Array,
  ): Uint8Array {
    const point = BandersnatchCurve.bytesToPoint(pointBytes)
    const scalar = bytesToBigInt(scalarBytes)
    const result = BandersnatchCurve.scalarMultiply(point, scalar)
    return BandersnatchCurve.pointToBytes(result)
  }

  /**
   * Generate nonce using RFC-8032 nonce generation (matches Rust implementation)
   */
  private static generateNonce(
    secret: Uint8Array,
    input: Uint8Array,
  ): Uint8Array {
    // Use RFC-8032 nonce generation to match Rust implementation
    return generateNonceRfc8032(secret, input)
  }

  /**
   * Generate blinded public key commitment Y_bar = x*G + b*B
   */
  private static generateBlindedPublicKey(
    secretKey: Uint8Array,
    blindingFactor: Uint8Array,
  ): Uint8Array {
    const x = bytesToBigInt(secretKey)
    const b = bytesToBigInt(blindingFactor)

    // Y_bar = x*G + b*B
    const xG = BandersnatchCurve.scalarMultiply(BandersnatchCurve.GENERATOR, x)
    const bB = BandersnatchCurve.scalarMultiply(this.getBlindingBase(), b)
    const Y_bar = BandersnatchCurve.add(xG, bB)

    // Debug: Check if Y_bar is valid
    logger.debug('Generated Y_bar point', {
      Y_barX: Y_bar.x.toString(16),
      Y_barY: Y_bar.y.toString(16),
      x: x.toString(16),
      b: b.toString(16),
      xGX: xG.x.toString(16),
      xGY: xG.y.toString(16),
      bBX: bB.x.toString(16),
      bBY: bB.y.toString(16),
    })

    return BandersnatchCurve.pointToBytes(Y_bar)
  }

  /**
   * Generate commitment R = k*G + k_b*B
   */
  private static generateCommitment(
    k: Uint8Array,
    k_b: Uint8Array,
  ): Uint8Array {
    const kScalar = bytesToBigInt(k)
    const k_bScalar = bytesToBigInt(k_b)

    // R = k*G + k_b*B
    const kG = BandersnatchCurve.scalarMultiply(
      BandersnatchCurve.GENERATOR,
      kScalar,
    )
    const k_bB = BandersnatchCurve.scalarMultiply(
      this.getBlindingBase(),
      k_bScalar,
    )
    const R = BandersnatchCurve.add(kG, k_bB)

    // Debug: Check if R is valid
    logger.debug('Generated R point', {
      RX: R.x.toString(16),
      RY: R.y.toString(16),
      k: kScalar.toString(16),
      k_b: k_bScalar.toString(16),
      kGX: kG.x.toString(16),
      kGY: kG.y.toString(16),
      k_bBX: k_bB.x.toString(16),
      k_bBY: k_bB.y.toString(16),
    })

    return BandersnatchCurve.pointToBytes(R)
  }

  /**
   * Generate challenge c = H2(Y_bar, I, O, R, O_k, ad)
   */
  private static generateChallenge(
    Y_bar: Uint8Array,
    I: Uint8Array,
    O: Uint8Array,
    R: Uint8Array,
    O_k: Uint8Array,
    auxData?: Uint8Array,
  ): bigint {
    // Combine all inputs for challenge generation
    const challengeInput = new Uint8Array([
      ...Y_bar,
      ...I,
      ...O,
      ...R,
      ...O_k,
      ...(auxData || new Uint8Array(0)),
    ])

    // Hash using SHA-512 as specified in Bandersnatch VRF
    const hashBytes = sha512(challengeInput)

    // Convert to scalar
    const hashValue = bytesToBigInt(hashBytes)
    return hashValue % BANDERSNATCH_PARAMS.CURVE_ORDER
  }

  /**
   * Generate proof scalar s = k + c*x
   */
  private static generateProofScalar(
    k: Uint8Array,
    c: bigint,
    secretKey: Uint8Array,
  ): Uint8Array {
    const kScalar = bytesToBigInt(k)
    const x = bytesToBigInt(secretKey)
    const s = (kScalar + c * x) % BANDERSNATCH_PARAMS.CURVE_ORDER
    return numberToBytes(s)
  }

  /**
   * Generate blinding proof scalar s_b = k_b + c*b
   */
  private static generateBlindingProofScalar(
    k_b: Uint8Array,
    c: bigint,
    blindingFactor: Uint8Array,
  ): Uint8Array {
    const k_bScalar = bytesToBigInt(k_b)
    const b = bytesToBigInt(blindingFactor)
    const s_b = (k_bScalar + c * b) % BANDERSNATCH_PARAMS.CURVE_ORDER
    return numberToBytes(s_b)
  }

  /**
   * Hash VRF output point (H2 function)
   */
  private static hashOutput(
    gamma: Uint8Array,
    config?: ProverConfig,
  ): Uint8Array {
    if (config?.hashOutput) {
      return config.hashOutput(gamma)
    }

    const point = BandersnatchCurve.bytesToPoint(gamma)
    return BandersnatchCurve.hashPoint(point)
  }

  /**
   * Get blinding base point B
   * From specification: B_x = 6150229251051246713677296363717454238956877613358614224171740096471278798312
   * B_y = 28442734166467795856797249030329035618871580593056783094884474814923353898473
   */
  private static getBlindingBase() {
    return {
      x: BigInt(
        '6150229251051246713677296363717454238956877613358614224171740096471278798312',
      ),
      y: BigInt(
        '28442734166467795856797249030329035618871580593056783094884474814923353898473',
      ),
      isInfinity: false,
    }
  }

  /**
   * Serialize Pedersen VRF proof
   */
  static serializeProof(proof: PedersenVRFProof): Uint8Array {
    // Serialize as: Y_bar || R || O_k || s || s_b
    return new Uint8Array([
      ...proof.Y_bar,
      ...proof.R,
      ...proof.O_k,
      ...proof.s,
      ...proof.s_b,
    ])
  }

  /**
   * Deserialize Pedersen VRF proof
   */
  static deserializeProof(proofBytes: Uint8Array): PedersenVRFProof {
    const pointSize = 64 // Full point size (32 bytes X + 32 bytes Y)
    const scalarSize = 32 // Scalar size

    let offset = 0
    const Y_bar = proofBytes.slice(offset, offset + pointSize)
    offset += pointSize

    const R = proofBytes.slice(offset, offset + pointSize)
    offset += pointSize

    const O_k = proofBytes.slice(offset, offset + pointSize)
    offset += pointSize

    const s = proofBytes.slice(offset, offset + scalarSize)
    offset += scalarSize

    const s_b = proofBytes.slice(offset, offset + scalarSize)

    return { Y_bar, R, O_k, s, s_b }
  }
}
