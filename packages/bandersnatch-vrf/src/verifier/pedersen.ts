/**
 * Pedersen VRF Verifier Implementation
 *
 * Implements verification for Pedersen VRF scheme
 * Reference: Bandersnatch VRF specification section 3.3
 */

import type { EdwardsPoint } from '@noble/curves/abstract/edwards.js'
import {
  BANDERSNATCH_PARAMS,
  BandersnatchCurveNoble,
  BandersnatchNoble,
} from '@pbnj/bandersnatch'
import { logger } from '@pbnj/core'
import {
  bytesToBigIntLittleEndian,
  curvePointToNoble,
  elligator2HashToCurve,
} from '../crypto/elligator2'
import { type PedersenVRFProof, PedersenVRFProver } from '../prover/pedersen'

/**
 * Pedersen VRF Verifier
 * Implements Pedersen VRF proof verification
 */
export class PedersenVRFVerifier {
  /**
   * Verify Pedersen VRF proof according to bandersnatch-vrf-spec
   * The gamma (output) is provided as a parameter
   */
  static verify(
    input: Uint8Array,
    gamma: Uint8Array,
    proof: Uint8Array,
    auxData?: Uint8Array,
  ): boolean {
    const startTime = Date.now()

    logger.debug('Verifying Pedersen VRF proof', {
      inputLength: input.length,
      hasAuxData: !!auxData,
    })

    try {
      // Step 1: Deserialize proof components
      const pedersenProof = PedersenVRFProver.deserialize(proof)

      // Step 2: Hash input to curve point (H1) using Elligator2
      const I = this.hashToCurve(input)

      // Step 3: Verify proof using the provided gamma
      const isValid = this.verifyProof(I, gamma, pedersenProof, auxData)

      if (!isValid) {
        logger.error('Pedersen VRF proof verification failed', {})
      } else {
        logger.debug('Pedersen VRF proof verified successfully', {})
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
   * Hash input to curve point (H1 function)
   */
  static hashToCurve(message: Uint8Array): Uint8Array {
    // Use Elligator2 hash-to-curve for proper implementation
    const point = elligator2HashToCurve(message)
    return BandersnatchCurveNoble.pointToBytes(curvePointToNoble(point))
  }

  /**
   * Get blinding base point B as Edwards point
   * From specification: B_x = 6150229251051246713677296363717454238956877613358614224171740096471278798312
   * B_y = 28442734166467795856797249030329035618871580593056783094884474814923353898473
   */
  private static getBlindingBase() {
    // Use the same pattern as the generator
    return BandersnatchNoble.fromAffine({
      x: BANDERSNATCH_PARAMS.BLINDING_BASE.x,
      y: BANDERSNATCH_PARAMS.BLINDING_BASE.y,
    })
  }

  /**
   * Compare two curve points for equality
   */
  private static pointsEqual(
    point1: EdwardsPoint,
    point2: EdwardsPoint,
  ): boolean {
    return point1.equals(point2)
  }

  /**
   * Verify Pedersen VRF proof with provided gamma point according to bandersnatch-vrf-spec
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
  ): boolean {
    try {
      // Step 1: Extract proof components
      const { Y_bar, R, O_k, s, s_b } = proof

      // Convert proof components to curve points and scalars
      const IPoint = BandersnatchCurveNoble.bytesToPoint(I)
      const OPoint = BandersnatchCurveNoble.bytesToPoint(O)
      const Y_barPoint = BandersnatchCurveNoble.bytesToPoint(Y_bar)
      const RPoint = BandersnatchCurveNoble.bytesToPoint(R)
      const O_kPoint = BandersnatchCurveNoble.bytesToPoint(O_k)

      const sScalar = bytesToBigIntLittleEndian(s)
      const s_bScalar = bytesToBigIntLittleEndian(s_b)

      // Step 2: Generate challenge
      const c = PedersenVRFProver.generateChallenge(
        Y_bar,
        I,
        O,
        R,
        O_k,
        auxData || new Uint8Array(0),
      )

      // Step 3: Verify output commitment: O_k + c·O = I·s
      const cO = BandersnatchCurveNoble.scalarMultiply(OPoint, c)
      const leftSide = BandersnatchCurveNoble.add(O_kPoint, cO)
      const rightSide = BandersnatchCurveNoble.scalarMultiply(IPoint, sScalar)
      const theta0 = this.pointsEqual(leftSide, rightSide)

      // Step 4: Verify key commitment: R + c·Y_bar = s·G + s_b·B
      const cY_bar = BandersnatchCurveNoble.scalarMultiply(Y_barPoint, c)
      const leftSideKey = BandersnatchCurveNoble.add(RPoint, cY_bar)

      const G = BandersnatchNoble.fromAffine({
        x: BANDERSNATCH_PARAMS.GENERATOR.x,
        y: BANDERSNATCH_PARAMS.GENERATOR.y,
      })
      const B = this.getBlindingBase()
      const sG = BandersnatchCurveNoble.scalarMultiply(G, sScalar)
      const s_bB = BandersnatchCurveNoble.scalarMultiply(B, s_bScalar)
      const rightSideKey = BandersnatchCurveNoble.add(sG, s_bB)
      const theta1 = this.pointsEqual(leftSideKey, rightSideKey)

      // Step 5: Final result
      const isValid = theta0 && theta1

      logger.debug('Pedersen VRF verification details', {
        theta0,
        theta1,
        isValid,
        challenge: c.toString(16),
      })

      return isValid
    } catch (error) {
      logger.error(
        'Pedersen VRF proof verification with provided gamma failed',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      )
      return false
    }
  }
}
