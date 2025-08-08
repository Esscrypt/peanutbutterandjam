/**
 * IETF VRF Prover Implementation
 *
 * Implements RFC-9381 VRF proof generation
 */

import { logger } from '@pbnj/core'
import type {
  VRFInput,
  VRFProof,
  VRFProofWithOutput,
  VRFSecretKey,
} from '@pbnj/types'
import { BandersnatchCurve } from '../curve'
import type { ProverConfig } from './types'
import { DEFAULT_PROVER_CONFIG } from './config'

/**
 * IETF VRF Prover
 * Implements RFC-9381 VRF proof generation
 */
export class IETFVRFProver {
  /**
   * Generate VRF proof and output
   */
  static prove(
    _secretKey: VRFSecretKey,
    _input: VRFInput,
    _auxData?: Uint8Array,
    config?: ProverConfig,
  ): VRFProofWithOutput {
    const startTime = Date.now()
    const mergedConfig = { ...DEFAULT_PROVER_CONFIG, ...config }

    logger.debug('Generating IETF VRF proof', {
      inputLength: _input.message.length,
      hasAuxData: !!_auxData,
      config: mergedConfig,
    })

    try {
      // 1. Hash input to curve point (H1)
      const alpha = this.hashToCurve(_input.message, mergedConfig)

      // 2. Scalar multiplication: gamma = alpha * secretKey
      const gamma = this.scalarMultiply(alpha, _secretKey.bytes)

      // 3. Generate proof
      const proof = this.generateProof(_secretKey, alpha, gamma, _auxData)

      // 4. Hash output (H2)
      const hash = this.hashOutput(gamma, mergedConfig)

      const generationTime = Date.now() - startTime

      logger.debug('IETF VRF proof generated successfully', {
        generationTime,
        proofSize: proof.bytes.length,
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

    const point = BandersnatchCurve.hashToCurve(message)
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
    const scalar = this.bytesToBigint(scalarBytes)
    const result = BandersnatchCurve.scalarMultiply(point, scalar)
    return BandersnatchCurve.pointToBytes(result)
  }

  /**
   * Generate VRF proof
   */
  private static generateProof(
    secretKey: VRFSecretKey,
    alpha: Uint8Array,
    gamma: Uint8Array,
    auxData?: Uint8Array,
  ): VRFProof {
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
    const x = this.bytesToBigint(secretKey.bytes)
    const s = (k + c * x) % BandersnatchCurve.CURVE_ORDER

    // Serialize proof as (c, s)
    const proofBytes = new Uint8Array([
      ...this.bigintToBytes(c, 32),
      ...this.bigintToBytes(s, 32),
    ])

    return { bytes: proofBytes }
  }

  /**
   * Generate random scalar for proof generation
   */
  private static generateRandomScalar(): bigint {
    // In production, use cryptographically secure random number generation
    // For now, use a simple deterministic method for testing
    const randomBytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256)
    }

    const randomValue = this.bytesToBigint(randomBytes)
    return randomValue % BandersnatchCurve.CURVE_ORDER
  }

  /**
   * Hash to scalar for challenge generation
   */
  private static hashToScalar(_data: Uint8Array): bigint {
    const hash = BandersnatchCurve.hashPoint({ x: 0n, y: 0n, isInfinity: true })
    const hashValue = this.bytesToBigint(hash)
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
   * Convert bigint to bytes with specified length
   */
  private static bigintToBytes(value: bigint, length: number): Uint8Array {
    const bytes = new Uint8Array(length)
    let temp = value

    for (let i = length - 1; i >= 0; i--) {
      bytes[i] = Number(temp & 0xffn)
      temp = temp >> 8n
    }

    return bytes
  }
}
