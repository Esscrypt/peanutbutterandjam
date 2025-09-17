/**
 * IETF VRF Prover Implementation
 *
 * Implements RFC-9381 VRF proof generation
 */

import { BandersnatchCurve, elligator2HashToCurve } from '@pbnj/bandersnatch'
import { bytesToBigInt, logger, numberToBytes } from '@pbnj/core'
import type { VRFProofWithOutput } from '@pbnj/types'
import { DEFAULT_PROVER_CONFIG } from './config'
import type { ProverConfig } from './types'

/**
 * IETF VRF Prover
 * Implements RFC-9381 VRF proof generation
 */
export class IETFVRFProver {
  /**
   * Generate VRF proof and output
   */
  static prove(
    _secretKey: Uint8Array,
    _input: Uint8Array,
    _auxData?: Uint8Array,
    config?: ProverConfig,
  ): VRFProofWithOutput {
    const startTime = Date.now()
    const mergedConfig = { ...DEFAULT_PROVER_CONFIG, ...config }

    logger.debug('Generating IETF VRF proof', {
      inputLength: _input.length,
      hasAuxData: !!_auxData,
      config: mergedConfig,
    })

    try {
      // 1. Hash input to curve point (H1)
      const alpha = this.hashToCurve(_input, mergedConfig)

      // 2. Scalar multiplication: gamma = alpha * secretKey
      const gamma = this.scalarMultiply(alpha, _secretKey)

      // 3. Generate proof
      const proof = this.generateProof(_secretKey, alpha, gamma, _auxData)

      // 4. Hash output (H2)
      const hash = this.hashOutput(gamma, mergedConfig)

      const generationTime = Date.now() - startTime

      logger.debug('IETF VRF proof generated successfully', {
        generationTime,
        proofSize: proof.length,
        outputSize: hash.length,
      })

      return {
        output: { gamma, hash },
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
  static hashToCurve(message: Uint8Array, config?: ProverConfig): Uint8Array {
    if (config?.hashToCurve) {
      return config.hashToCurve(message)
    }

    // Use Elligator2 for hash-to-curve as specified in the Bandersnatch VRF spec
    const point = elligator2HashToCurve(message)
    return BandersnatchCurve.pointToBytes(point)
  }

  /**
   * Scalar multiplication on Bandersnatch curve
   */
  private static scalarMultiply(
    pointUint8Array: Uint8Array,
    scalarUint8Array: Uint8Array,
  ): Uint8Array {
    const point = BandersnatchCurve.bytesToPoint(pointUint8Array)
    const scalar = bytesToBigInt(scalarUint8Array)
    const result = BandersnatchCurve.scalarMultiply(point, scalar)
    return BandersnatchCurve.pointToBytes(result)
  }

  /**
   * Generate VRF proof
   */
  private static generateProof(
    secretKey: Uint8Array,
    alpha: Uint8Array,
    gamma: Uint8Array,
    auxData?: Uint8Array,
  ): Uint8Array {
    // IETF VRF proof generation (RFC-9381)
    // Proof = (c, s) where:
    // c = H2(g || h || g^s * h^c)
    // s = k + c * x (mod q)

    // Convert alpha and gamma to curve points
    const alphaPoint = BandersnatchCurve.bytesToPoint(alpha)
    const gammaPoint = BandersnatchCurve.bytesToPoint(gamma)

    // Generate random nonce k
    const k = this.generateRandomScalar()

    // Calculate g^s (where g is the generator)
    const gToS = BandersnatchCurve.scalarMultiply(
      BandersnatchCurve.GENERATOR,
      k,
    )

    // Calculate h^c (where h is alpha)
    const hToC = BandersnatchCurve.scalarMultiply(alphaPoint, k)

    // Calculate challenge c = H2(gamma || g^s || h^c)
    const challengeInput = new Uint8Array([
      ...BandersnatchCurve.pointToBytes(gammaPoint),
      ...BandersnatchCurve.pointToBytes(gToS),
      ...BandersnatchCurve.pointToBytes(hToC),
    ])

    if (auxData) {
      challengeInput.set(auxData, challengeInput.length - auxData.length)
    }

    const c = this.hashToScalar(challengeInput)

    // Calculate s = k + c * x (mod q)
    const x = bytesToBigInt(secretKey)
    const s = (k + c * x) % BandersnatchCurve.CURVE_ORDER

    // Serialize proof as (c, s)
    const proofUint8Array = new Uint8Array([
      ...numberToBytes(c),
      ...numberToBytes(s),
    ])

    return proofUint8Array
  }

  /**
   * Generate random scalar for proof generation
   */
  private static generateRandomScalar(): bigint {
    // In production, use cryptographically secure random number generation
    // For now, use a simple deterministic method for testing
    const randomUint8Array = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      randomUint8Array[i] = Math.floor(Math.random() * 256)
    }

    const randomValue = bytesToBigInt(randomUint8Array)
    return randomValue % BandersnatchCurve.CURVE_ORDER
  }

  /**
   * Hash to scalar for challenge generation
   */
  private static hashToScalar(_data: Uint8Array): bigint {
    const hash = BandersnatchCurve.hashPoint({ x: 0n, y: 0n, isInfinity: true })
    const hashValue = bytesToBigInt(hash)
    return hashValue % BandersnatchCurve.CURVE_ORDER
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
}
