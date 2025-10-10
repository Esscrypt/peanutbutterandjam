/**
 * IETF VRF Prover Implementation
 *
 * Implements RFC-9381 VRF proof generation
 */

import { BandersnatchCurveNoble } from '@pbnj/bandersnatch'
import { logger, mod, numberToBytes } from '@pbnj/core'
import {
  bytesToBigIntLittleEndian,
  curvePointToNoble,
  elligator2HashToCurve,
} from '../crypto/elligator2'
import { generateNonceRfc8032 } from '../crypto/nonce-rfc8032'
import { generateChallengeRfc9381 } from '../crypto/rfc9381'

/**
 * IETF VRF result
 */
export interface IETFVRFResult {
  /** VRF output gamma point */
  gamma: Uint8Array
  /** Serialized proof */
  proof: Uint8Array
}

/**
 * IETF VRF Prover
 * Implements RFC-9381 VRF proof generation
 */
export class IETFVRFProver {
  /**
   * Generate VRF proof and output
   */
  static prove(
    secretKey: Uint8Array,
    input: Uint8Array,
    auxData?: Uint8Array,
  ): IETFVRFResult {
    try {
      // 1. Hash input to curve point (H1)
      // According to ark-vrf implementation: h2c_data = salt || alpha
      const salt = new Uint8Array(0) // Empty salt as per test vectors
      const h2cData = new Uint8Array(salt.length + input.length)
      h2cData.set(salt, 0)
      h2cData.set(input, salt.length)

      const alpha = this.hashToCurve(h2cData)

      // 2. Scalar multiplication: gamma = alpha * secretKey
      const gamma = this.scalarMultiply(alpha, secretKey)

      // 3. Generate proof
      const proof = this.generateProof(secretKey, alpha, gamma, auxData)

      return {
        gamma,
        proof,
      }
    } catch (error) {
      logger.error('IETF VRF proof generation failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw new Error(
        `VRF proof generation failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Hash input to curve point (H1 function)
   */
  static hashToCurve(message: Uint8Array): Uint8Array {
    // Use Elligator2 for hash-to-curve as specified in the Bandersnatch VRF spec
    const point = elligator2HashToCurve(message)
    // Convert CurvePoint to bytes using the compression function from elligator2
    return BandersnatchCurveNoble.pointToBytes(curvePointToNoble(point))
  }

  /**
   * Scalar multiplication on Bandersnatch curve
   */
  private static scalarMultiply(
    pointUint8Array: Uint8Array,
    scalarUint8Array: Uint8Array,
  ): Uint8Array {
    const point = BandersnatchCurveNoble.bytesToPoint(pointUint8Array)
    const scalar = mod(
      bytesToBigIntLittleEndian(scalarUint8Array),
      BandersnatchCurveNoble.CURVE_ORDER,
    )
    const result = BandersnatchCurveNoble.scalarMultiply(point, scalar)
    // Use our arkworks-compatible compression instead of Noble's native compression
    return BandersnatchCurveNoble.pointToBytes(result)
  }

  /**
   * Generate VRF proof using RFC-9381 compliant procedures
   */
  private static generateProof(
    secretKey: Uint8Array,
    alpha: Uint8Array,
    gamma: Uint8Array,
    auxData?: Uint8Array,
  ): Uint8Array {
    // IETF VRF proof generation (RFC-9381)
    // Proof = (c, s) where:
    // c = challenge_rfc_9381(gamma, g^s, h^c, auxData)
    // s = k + c * x (mod q)

    // Convert alpha and gamma to curve points
    const alphaPoint = BandersnatchCurveNoble.bytesToPoint(alpha)
    const gammaPoint = BandersnatchCurveNoble.bytesToPoint(gamma)

    // Generate nonce k using RFC-8032
    const kBytes = generateNonceRfc8032(secretKey, alpha)
    const k = mod(
      bytesToBigIntLittleEndian(kBytes),
      BandersnatchCurveNoble.CURVE_ORDER,
    )

    // Calculate g^s (where g is the generator)
    const gToS = BandersnatchCurveNoble.scalarMultiply(
      BandersnatchCurveNoble.GENERATOR,
      k,
    )

    // Calculate h^c (where h is alpha)
    const hToC = BandersnatchCurveNoble.scalarMultiply(alphaPoint, k)

    // Calculate challenge c using RFC-9381
    // Use arkworks-compatible compression for all challenge points
    const challengePoints = [
      BandersnatchCurveNoble.pointToBytes(gammaPoint),
      BandersnatchCurveNoble.pointToBytes(gToS),
      BandersnatchCurveNoble.pointToBytes(hToC),
    ]

    const c = generateChallengeRfc9381(challengePoints, auxData)

    // Calculate s = k + c * x (mod q)
    const x = mod(
      bytesToBigIntLittleEndian(secretKey),
      BandersnatchCurveNoble.CURVE_ORDER,
    )
    const s = mod(k + c * x, BandersnatchCurveNoble.CURVE_ORDER)

    // Serialize proof as (gamma, c, s) - each field element must be exactly 32 bytes
    // Gray Paper: bssignature{k}{c}{m} ⊂ blob[96] = 32 + 32 + 32 bytes
    const padTo32Bytes = (bytes: Uint8Array): Uint8Array => {
      if (bytes.length >= 32) return bytes.slice(-32) // Take last 32 bytes if longer
      const padded = new Uint8Array(32)
      padded.set(bytes, 32 - bytes.length) // Right-pad with zeros
      return padded
    }

    const gammaBytes = padTo32Bytes(gamma) // VRF output point (32 bytes)
    const cBytes = padTo32Bytes(numberToBytes(c)) // Challenge scalar (32 bytes)
    const sBytes = padTo32Bytes(numberToBytes(s)) // Response scalar (32 bytes)

    const proofUint8Array = new Uint8Array([
      ...gammaBytes,
      ...cBytes,
      ...sBytes,
    ])

    return proofUint8Array
  }
}
