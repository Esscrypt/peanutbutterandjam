/**
 * IETF VRF Verifier Implementation
 *
 * Implements verification for IETF VRF scheme
 */

import { BandersnatchCurveNoble } from '@pbnj/bandersnatch'
import { bytesToBigInt, logger } from '@pbnj/core'
import { compressPoint, elligator2HashToCurve } from '../crypto/elligator2'
import { generateChallengeRfc9381 } from '../crypto/rfc9381'

/**
 * IETF VRF Verifier
 * Implements RFC-9381 VRF proof verification
 */
export class IETFVRFVerifier {
  /**
   * Verify VRF proof
   */
  static verify(
    publicKey: Uint8Array,
    input: Uint8Array,
    proof: Uint8Array,
    auxData?: Uint8Array,
  ): boolean {
    try {
      // 1. Hash input to curve point (H1)
      const alphaPoint = elligator2HashToCurve(input)
      const alphaBytes = new Uint8Array(
        Buffer.from(compressPoint(alphaPoint), 'hex'),
      )

      // 2. Verify proof
      const isValid = this.verifyProof(publicKey, alphaBytes, proof, auxData)

      if (!isValid) {
        logger.error('IETF VRF proof verification failed')
      } else {
        logger.debug('IETF VRF proof verified successfully', {})
      }

      return isValid
    } catch (error) {
      logger.error('IETF VRF proof verification failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Verify VRF proof
   */
  private static verifyProof(
    publicKey: Uint8Array,
    alpha: Uint8Array,
    proof: Uint8Array,
    auxData?: Uint8Array,
  ): boolean {
    // IETF VRF proof verification (RFC-9381)
    // Verify that: g^s = u + y^c and h^s = v + gamma^c

    // Parse proof as (gamma, c, s) - Gray Paper: blob[96] = 32 + 32 + 32 bytes
    if (proof.length !== 96) {
      return false
    }

    const gammaFromProof = proof.slice(0, 32) // VRF output point
    const cUint8Array = proof.slice(32, 64) // Challenge scalar
    const sUint8Array = proof.slice(64, 96) // Response scalar

    const c = bytesToBigInt(cUint8Array)
    const s = bytesToBigInt(sUint8Array)

    // Convert inputs to curve points
    const alphaPoint = BandersnatchCurveNoble.bytesToPoint(alpha)
    const gammaPoint = BandersnatchCurveNoble.bytesToPoint(gammaFromProof) // Use gamma from proof
    const publicKeyPoint = BandersnatchCurveNoble.bytesToPoint(publicKey)

    // Calculate u and v (reconstructed R points from proof)
    // Based on IETF VRF: u = g^s - y^c, v = h^s - gamma^c
    const gToS = BandersnatchCurveNoble.scalarMultiply(
      BandersnatchCurveNoble.GENERATOR,
      s,
    )
    const yToC = BandersnatchCurveNoble.scalarMultiply(publicKeyPoint, c)
    const u = BandersnatchCurveNoble.add(
      gToS,
      BandersnatchCurveNoble.negate(yToC),
    )

    const hToS = BandersnatchCurveNoble.scalarMultiply(alphaPoint, s)
    const gammaToC = BandersnatchCurveNoble.scalarMultiply(gammaPoint, c)
    const v = BandersnatchCurveNoble.add(
      hToS,
      BandersnatchCurveNoble.negate(gammaToC),
    )

    // Recreate challenge c from u, v, and other components
    const challengePoints = [
      BandersnatchCurveNoble.pointToBytes(gammaPoint),
      BandersnatchCurveNoble.pointToBytes(u),
      BandersnatchCurveNoble.pointToBytes(v),
    ]

    const expectedC = this.hashToScalar(
      challengePoints,
      auxData || new Uint8Array(0),
    )
    return c === expectedC
  }

  /**
   * Hash to scalar for challenge verification
   * Implements the challenge generation per IETF RFC-9381
   */
  private static hashToScalar(
    points: Uint8Array[],
    auxData: Uint8Array = new Uint8Array(0),
  ): bigint {
    // Use RFC-9381 challenge generation which implements proper hash-to-scalar
    return generateChallengeRfc9381(points, auxData)
  }
}
