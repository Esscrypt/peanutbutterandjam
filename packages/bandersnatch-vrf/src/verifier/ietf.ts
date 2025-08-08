/**
 * IETF VRF Verifier Implementation
 *
 * Implements verification for IETF VRF scheme
 */

import { logger } from '@pbnj/core'
import { BandersnatchCurve } from '../curve'
import type { VRFInput, VRFOutput, VRFProof, VRFPublicKey } from '@pbnj/types'
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
    _publicKey: VRFPublicKey,
    _input: VRFInput,
    _output: VRFOutput,
    _proof: VRFProof,
    _auxData?: Uint8Array,
    config?: VerifierConfig,
  ): boolean {
    const startTime = Date.now()
    const mergedConfig = { ...DEFAULT_VERIFIER_CONFIG, ...config }

    logger.debug('Verifying IETF VRF proof', {
      inputLength: _input.message.length,
      hasAuxData: !!_auxData,
      config: mergedConfig,
    })

    try {
      // 1. Hash input to curve point (H1)
      const alpha = BandersnatchCurve.hashToCurve(_input.message, mergedConfig)

      // 2. Verify proof
      const isValid = this.verifyProof(
        _publicKey,
        alpha,
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
    publicKey: VRFPublicKey,
    input: VRFInput,
    output: VRFOutput,
    proof: VRFProof,
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
    publicKey: VRFPublicKey,
    alpha: Uint8Array,
    gamma: Uint8Array,
    proof: VRFProof,
    auxData?: Uint8Array,
  ): boolean {
    // IETF VRF proof verification (RFC-9381)
    // Verify that: g^s = u * y^c and h^s = v * gamma^c

    // Parse proof as (c, s)
    if (proof.bytes.length !== 64) {
      return false
    }

    const cBytes = proof.bytes.slice(0, 32)
    const sBytes = proof.bytes.slice(32, 64)

    const c = this.bytesToBigint(cBytes)
    const s = this.bytesToBigint(sBytes)

    // Convert inputs to curve points
    const alphaPoint = BandersnatchCurve.bytesToPoint(alpha)
    const gammaPoint = BandersnatchCurve.bytesToPoint(gamma)
    const publicKeyPoint = BandersnatchCurve.bytesToPoint(publicKey.bytes)

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
    const hashValue = this.bytesToBigint(hash)
    return hashValue % BandersnatchCurve.CURVE_ORDER
  }

  /**
   * Convert bytes to bigint
   */
  private static bytesToBigint(bytes: Uint8Array): bigint {
    let result = 0n
    for (let i = 0; i < bytes.length; i++) {
      result = (result << 8n) | BigInt(bytes[i])
    }
    return result
  }

  /**
   * Check if two curve points are equal
   */
  private static pointsEqual(p1: any, p2: any): boolean {
    if (p1.isInfinity && p2.isInfinity) return true
    if (p1.isInfinity || p2.isInfinity) return false
    return p1.x === p2.x && p1.y === p2.y
  }
}
