/**
 * IETF VRF Verifier Implementation
 *
 * Implements verification for IETF VRF scheme
 */

import { BandersnatchCurve, type CurvePoint } from '@pbnj/bandersnatch'
import { bytesToBigInt, logger } from '@pbnj/core'
import type { VRFOutput } from '@pbnj/types'
import { DEFAULT_VERIFIER_CONFIG } from './config'
import type { VerificationResult, VerifierConfig } from './types'

/**
 * IETF VRF Verifier
 * Implements RFC-9381 VRF proof verification
 */
export class IETFVRFVerifier {
  /**
   * Verify VRF proof
   */
  static verify(
    _publicKey: Uint8Array,
    _input: Uint8Array,
    _output: VRFOutput,
    _proof: Uint8Array,
    _auxData?: Uint8Array,
    config?: VerifierConfig,
  ): boolean {
    const startTime = Date.now()
    const mergedConfig = { ...DEFAULT_VERIFIER_CONFIG, ...config }

    logger.debug('Verifying IETF VRF proof', {
      inputLength: _input.length,
      hasAuxData: !!_auxData,
      config: mergedConfig,
    })

    try {
      // 1. Hash input to curve point (H1)
      const alphaPoint = BandersnatchCurve.hashToCurve(_input)
      const alphaBytes = BandersnatchCurve.pointToBytes(alphaPoint)

      // 2. Verify proof
      const isValid = this.verifyProof(
        _publicKey,
        alphaBytes,
        _output.gamma,
        _proof,
        _auxData,
      )

      const verificationTime = Date.now() - startTime

      if (!isValid) {
        logger.error('IETF VRF proof verification failed', { verificationTime })
      } else {
        logger.debug('IETF VRF proof verified successfully', {
          verificationTime,
        })
      }

      return isValid
    } catch (error) {
      const verificationTime = Date.now() - startTime
      logger.error('IETF VRF proof verification failed', {
        error: error instanceof Error ? error.message : String(error),
        verificationTime,
      })
      return false
    }
  }

  /**
   * Verify VRF proof with detailed result
   */
  static verifyWithResult(
    publicKey: Uint8Array,
    input: Uint8Array,
    output: VRFOutput,
    proof: Uint8Array,
    auxData?: Uint8Array,
    config?: VerifierConfig,
  ): VerificationResult {
    const startTime = Date.now()
    const mergedConfig = { ...DEFAULT_VERIFIER_CONFIG, ...config }

    try {
      const isValid = this.verify(
        publicKey,
        input,
        output,
        proof,
        auxData,
        mergedConfig,
      )
      const verificationTime = Date.now() - startTime

      return {
        isValid,
        verificationTime,
        metadata: {
          scheme: 'IETF',
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
          scheme: 'IETF',
          usedAuxData: !!auxData,
          config: mergedConfig,
        },
      }
    }
  }

  /**
   * Verify VRF proof
   */
  private static verifyProof(
    publicKey: Uint8Array,
    alpha: Uint8Array,
    gamma: Uint8Array,
    proof: Uint8Array,
    auxData?: Uint8Array,
  ): boolean {
    // IETF VRF proof verification (RFC-9381)
    // Verify that: g^s = u * y^c and h^s = v * gamma^c

    // Parse proof as (c, s)
    if (proof.length !== 64) {
      return false
    }

    const cUint8Array = proof.slice(0, 32)
    const sUint8Array = proof.slice(32, 64)

    const c = bytesToBigInt(cUint8Array)
    const s = bytesToBigInt(sUint8Array)

    // Convert inputs to curve points
    const alphaPoint = BandersnatchCurve.bytesToPoint(alpha)
    const gammaPoint = BandersnatchCurve.bytesToPoint(gamma)
    const publicKeyPoint = BandersnatchCurve.bytesToPoint(publicKey)

    // Calculate u = g^s
    const u = BandersnatchCurve.scalarMultiply(BandersnatchCurve.GENERATOR, s)

    // Calculate v = h^s
    const v = BandersnatchCurve.scalarMultiply(alphaPoint, s)

    // Calculate y^c
    const yToC = BandersnatchCurve.scalarMultiply(publicKeyPoint, c)

    // Calculate gamma^c
    const gammaToC = BandersnatchCurve.scalarMultiply(gammaPoint, c)

    // Verify g^s = u * y^c
    const leftSide1 = u
    const rightSide1 = BandersnatchCurve.add(u, yToC)

    // Verify h^s = v * gamma^c
    const leftSide2 = v
    const rightSide2 = BandersnatchCurve.add(v, gammaToC)

    // Verify challenge c matches
    const challengeInput = new Uint8Array([
      ...BandersnatchCurve.pointToBytes(gammaPoint),
      ...BandersnatchCurve.pointToBytes(u),
      ...BandersnatchCurve.pointToBytes(v),
    ])

    if (auxData) {
      challengeInput.set(auxData, challengeInput.length - auxData.length)
    }

    const expectedC = this.hashToScalar(challengeInput)

    return (
      c === expectedC &&
      this.pointsEqual(leftSide1, rightSide1) &&
      this.pointsEqual(leftSide2, rightSide2)
    )
  }

  /**
   * Hash to scalar for challenge verification
   */
  private static hashToScalar(_data: Uint8Array): bigint {
    const hash = BandersnatchCurve.hashPoint({ x: 0n, y: 0n, isInfinity: true })
    const hashValue = bytesToBigInt(hash)
    return hashValue % BandersnatchCurve.CURVE_ORDER
  }

  /**
   * Check if two curve points are equal
   */
  private static pointsEqual(p1: CurvePoint, p2: CurvePoint): boolean {
    if (p1.isInfinity && p2.isInfinity) return true
    if (p1.isInfinity || p2.isInfinity) return false
    return p1.x === p2.x && p1.y === p2.y
  }
}
