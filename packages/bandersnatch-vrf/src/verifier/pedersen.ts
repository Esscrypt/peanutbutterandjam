/**
 * Pedersen VRF Verifier Implementation
 *
 * Implements verification for Pedersen VRF scheme
 * Reference: Bandersnatch VRF specification section 3.3
 */

import { sha512 } from '@noble/hashes/sha2'
import {
  BANDERSNATCH_PARAMS,
  BandersnatchCurve,
  elligator2HashToCurve,
} from '@pbnj/bandersnatch'
import { bytesToBigInt, logger } from '@pbnj/core'
import type { CurvePoint, VRFOutput } from '@pbnj/types'
import { type PedersenVRFProof, PedersenVRFProver } from '../prover/pedersen'
import { DEFAULT_VERIFIER_CONFIG } from './config'
import type { VerificationResult, VerifierConfig } from './types'

/**
 * Pedersen VRF Verifier
 * Implements Pedersen VRF proof verification
 */
export class PedersenVRFVerifier {
  /**
   * Verify Pedersen VRF proof
   */
  static verify(
    input: Uint8Array,
    output: VRFOutput,
    proof: Uint8Array,
    auxData?: Uint8Array,
    config?: VerifierConfig,
  ): boolean {
    const startTime = Date.now()
    const mergedConfig = { ...DEFAULT_VERIFIER_CONFIG, ...config }

    logger.debug('Verifying Pedersen VRF proof', {
      inputLength: input.length,
      hasAuxData: !!auxData,
      config: mergedConfig,
    })

    try {
      // TODO: Step 1 - Deserialize proof components
      // Extract Y_bar, R, O_k, s, s_b from the proof bytes
      const pedersenProof = PedersenVRFProver.deserializeProof(proof)

      // TODO: Step 2 - Hash input to curve point (H1) using Elligator2
      // This must match the same process used in the prover
      const I = this.hashToCurve(input, mergedConfig)

      // TODO: Step 3 - Verify proof using two mathematical relationships
      // 1. Output commitment: O_k + c·O = I·s
      // 2. Key commitment: R + c·Y_bar = s·G + s_b·B
      const isValid = this.verifyProof(
        I,
        output.gamma,
        pedersenProof,
        auxData,
        mergedConfig,
      )

      const verificationTime = Date.now() - startTime

      if (!isValid) {
        logger.error('Pedersen VRF proof verification failed', {
          verificationTime,
        })
      } else {
        logger.debug('Pedersen VRF proof verified successfully', {
          verificationTime,
        })
      }

      return isValid
    } catch (error) {
      const verificationTime = Date.now() - startTime
      logger.error('Pedersen VRF proof verification failed', {
        error: error instanceof Error ? error.message : String(error),
        verificationTime,
      })
      return false
    }
  }

  /**
   * Verify Pedersen VRF proof with detailed result
   */
  static verifyWithResult(
    input: Uint8Array,
    output: VRFOutput,
    proof: Uint8Array,
    auxData?: Uint8Array,
    config?: VerifierConfig,
  ): VerificationResult {
    const startTime = Date.now()
    const mergedConfig = { ...DEFAULT_VERIFIER_CONFIG, ...config }

    try {
      // 1. Deserialize proof
      const pedersenProof = PedersenVRFProver.deserializeProof(proof)

      // 2. Hash input to curve point (H1)
      const I = this.hashToCurve(input, mergedConfig)

      // 3. Verify proof
      const isValid = this.verifyProof(
        I,
        output.gamma,
        pedersenProof,
        auxData,
        mergedConfig,
      )

      const verificationTime = Date.now() - startTime

      return {
        isValid,
        verificationTime,
        error: isValid ? undefined : 'Pedersen VRF proof verification failed',
        metadata: {
          scheme: 'pedersen-vrf',
          usedAuxData: !!auxData,
          config: mergedConfig,
        },
      }
    } catch (error) {
      const verificationTime = Date.now() - startTime
      return {
        isValid: false,
        verificationTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          scheme: 'pedersen-vrf',
          usedAuxData: !!auxData,
          config: mergedConfig,
        },
      }
    }
  }

  /**
   * Hash input to curve point (H1 function)
   */
  static hashToCurve(message: Uint8Array, config?: VerifierConfig): Uint8Array {
    if (config?.hashToCurve) {
      return config.hashToCurve(message)
    }

    // Use Elligator2 hash-to-curve for proper implementation
    const point = elligator2HashToCurve(message)
    return BandersnatchCurve.pointToBytes(point)
  }

  /**
   * Verify Pedersen VRF proof according to specification
   * Steps:
   * 1. (Y_bar, R, O_k, s, s_b) ← π
   * 2. c ← challenge(Y_bar, I, O, R, O_k, ad)
   * 3. θ₀ ← ⊤ if O_k + c·O = I·s else ⊥
   * 4. θ₁ ← ⊤ if R + c·Y_bar = s·G + s_b·B else ⊥
   * 5. θ = θ₀ ∧ θ₁
   */
  private static verifyProof(
    I: Uint8Array,
    O: Uint8Array,
    proof: PedersenVRFProof,
    auxData?: Uint8Array,
    _config?: VerifierConfig,
  ): boolean {
    try {
      // TODO: Step 1 - Parse proof components
      // Extract Y_bar, R, O_k, s, s_b from the deserialized proof
      const { Y_bar, R, O_k, s, s_b } = proof

      // TODO: Step 2 - Generate challenge c = H2(Y_bar, I, O, R, O_k, ad)
      // This must match exactly what the prover generated
      const c = this.generateChallenge(Y_bar, I, O, R, O_k, auxData)

      // Debug: Log challenge generation
      logger.debug('Verifier challenge generation', {
        c: c.toString(16),
        Y_barLength: Y_bar.length,
        ILength: I.length,
        OLength: O.length,
        RLength: R.length,
        O_kLength: O_k.length,
        auxDataLength: auxData?.length || 0,
      })

      // TODO: Step 3 - Verify output commitment: O_k + c·O = I·s
      // This proves the output was generated correctly
      const theta0 = this.verifyOutputCommitment(I, O, O_k, s, c)

      // TODO: Step 4 - Verify key commitment: R + c·Y_bar = s·G + s_b·B
      // This proves knowledge of the secret key and blinding factor
      const theta1 = this.verifyKeyCommitment(R, Y_bar, s, s_b, c)

      // TODO: Step 5 - Both verifications must pass
      // If either fails, the proof is invalid
      return theta0 && theta1
    } catch (error) {
      logger.error('Pedersen VRF proof verification error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Verify output commitment: O_k + c·O = I·s
   */
  private static verifyOutputCommitment(
    I: Uint8Array,
    O: Uint8Array,
    O_k: Uint8Array,
    s: Uint8Array,
    c: bigint,
  ): boolean {
    try {
      // Convert to curve points
      const IPoint = BandersnatchCurve.bytesToPoint(I)
      const OPoint = BandersnatchCurve.bytesToPoint(O)
      const O_kPoint = BandersnatchCurve.bytesToPoint(O_k)
      const sScalar = bytesToBigInt(s)

      // Left side: O_k + c·O
      const cO = BandersnatchCurve.scalarMultiply(OPoint, c)
      const leftSide = BandersnatchCurve.add(O_kPoint, cO)

      // Right side: I·s
      const rightSide = BandersnatchCurve.scalarMultiply(IPoint, sScalar)

      // Debug logging
      logger.debug('Output commitment verification', {
        leftSideX: leftSide.x.toString(16),
        leftSideY: leftSide.y.toString(16),
        rightSideX: rightSide.x.toString(16),
        rightSideY: rightSide.y.toString(16),
        c: c.toString(16),
        s: sScalar.toString(16),
        // Debug intermediate values
        IPointX: IPoint.x.toString(16),
        IPointY: IPoint.y.toString(16),
        OPointX: OPoint.x.toString(16),
        OPointY: OPoint.y.toString(16),
        O_kPointX: O_kPoint.x.toString(16),
        O_kPointY: O_kPoint.y.toString(16),
      })

      // Check equality
      const isEqual = this.pointsEqual(leftSide, rightSide)
      logger.debug('Output commitment result', { isEqual })
      return isEqual
    } catch (error) {
      logger.error('Output commitment verification failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Verify key commitment: R + c·Y_bar = s·G + s_b·B
   */
  private static verifyKeyCommitment(
    R: Uint8Array,
    Y_bar: Uint8Array,
    s: Uint8Array,
    s_b: Uint8Array,
    c: bigint,
  ): boolean {
    try {
      // Convert to curve points
      const RPoint = BandersnatchCurve.bytesToPoint(R)
      const Y_barPoint = BandersnatchCurve.bytesToPoint(Y_bar)
      const sScalar = bytesToBigInt(s)
      const s_bScalar = bytesToBigInt(s_b)

      // Left side: R + c·Y_bar
      const cY_bar = BandersnatchCurve.scalarMultiply(Y_barPoint, c)
      const leftSide = BandersnatchCurve.add(RPoint, cY_bar)

      // Right side: s·G + s_b·B
      const sG = BandersnatchCurve.scalarMultiply(
        BandersnatchCurve.GENERATOR,
        sScalar,
      )
      const s_bB = BandersnatchCurve.scalarMultiply(
        this.getBlindingBase(),
        s_bScalar,
      )
      const rightSide = BandersnatchCurve.add(sG, s_bB)

      // Debug logging
      logger.debug('Key commitment verification', {
        leftSideX: leftSide.x.toString(16),
        leftSideY: leftSide.y.toString(16),
        rightSideX: rightSide.x.toString(16),
        rightSideY: rightSide.y.toString(16),
        c: c.toString(16),
        s: sScalar.toString(16),
        s_b: s_bScalar.toString(16),
        // Debug intermediate values
        RPointX: RPoint.x.toString(16),
        RPointY: RPoint.y.toString(16),
        Y_barPointX: Y_barPoint.x.toString(16),
        Y_barPointY: Y_barPoint.y.toString(16),
        sGX: sG.x.toString(16),
        sGY: sG.y.toString(16),
        s_bBX: s_bB.x.toString(16),
        s_bBY: s_bB.y.toString(16),
      })

      // Check equality
      const isEqual = this.pointsEqual(leftSide, rightSide)
      logger.debug('Key commitment result', { isEqual })
      return isEqual
    } catch (error) {
      logger.error('Key commitment verification failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
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
   * Check if two curve points are equal
   */
  private static pointsEqual(p1: CurvePoint, p2: CurvePoint): boolean {
    if (p1.isInfinity && p2.isInfinity) return true
    if (p1.isInfinity || p2.isInfinity) return false

    const xEqual = p1.x === p2.x
    const yEqual = p1.y === p2.y

    return xEqual && yEqual
  }

  /**
   * Get blinding base point B
   * From specification: B_x = 6150229251051246713677296363717454238956877613358614224171740096471278798312
   * B_y = 28442734166467795856797249030329035618871580593056783094884474814923353898473
   */
  private static getBlindingBase(): CurvePoint {
    return BANDERSNATCH_PARAMS.BLINDING_BASE
  }
}
