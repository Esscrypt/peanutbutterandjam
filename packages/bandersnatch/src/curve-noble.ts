/**
 * Bandersnatch Curve Implementation using @noble/curves
 *
 * This uses the @noble/curves Twisted Edwards implementation as a base
 * and customizes it for Bandersnatch parameters
 */

import { type EdwardsPoint, edwards } from '@noble/curves/abstract/edwards.js'
import { Field } from '@noble/curves/abstract/modular'
// import { sha512 } from '@noble/hashes/sha2.js'
import { BANDERSNATCH_PARAMS } from './config'
import { elligator2HashToCurve } from './crypto/elligator2'

/**
 * Bandersnatch curve parameters for @noble/curves
 */
const BANDERSNATCH_CURVE = {
  // Field modulus (BLS12-381 scalar field)
  p: BANDERSNATCH_PARAMS.FIELD_MODULUS,

  // Curve order
  n: BANDERSNATCH_PARAMS.CURVE_ORDER,

  // Cofactor
  h: BANDERSNATCH_PARAMS.COFACTOR,

  // Twisted Edwards coefficients
  a:
    BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.a +
    BANDERSNATCH_PARAMS.FIELD_MODULUS, // Convert -5 to positive
  d: BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.d,

  // Generator point
  Gx: BANDERSNATCH_PARAMS.GENERATOR.x,
  Gy: BANDERSNATCH_PARAMS.GENERATOR.y,
}

/**
 * Create Bandersnatch curve using @noble/curves
 */
export const BandersnatchNoble = edwards(BANDERSNATCH_CURVE)

/**
 * Bandersnatch curve operations using @noble/curves
 */
export class BandersnatchCurveNoble {
  static Fp = Field(BANDERSNATCH_PARAMS.FIELD_MODULUS)

  /**
   * Hash input to curve point using Elligator2
   */
  static hashToCurve(message: Uint8Array): Uint8Array {
    // Use our existing Elligator2 implementation for now
    // TODO: Implement proper Elligator2 using @noble/curves
    const customPoint = elligator2HashToCurve(message)

    // Convert our custom CurvePoint to EdwardsPoint
    // Create a 32-byte representation of the point
    const xBytes = new Uint8Array(32)
    const yBytes = new Uint8Array(32)

    // Convert bigint to bytes (little-endian)
    let x = customPoint.x
    let y = customPoint.y
    for (let i = 0; i < 32; i++) {
      xBytes[i] = Number(x & 0xffn)
      yBytes[i] = Number(y & 0xffn)
      x >>= 8n
      y >>= 8n
    }

    // Combine x and y coordinates
    const pointBytes = new Uint8Array(64)
    pointBytes.set(xBytes, 0)
    pointBytes.set(yBytes, 32)

    return pointBytes
  }

  /**
   * Convert point bytes to curve point
   */
  static bytesToPoint(bytes: Uint8Array): EdwardsPoint {
    return BandersnatchNoble.fromBytes(bytes)
  }

  /**
   * Convert curve point to bytes
   */
  static pointToBytes(point: EdwardsPoint): Uint8Array {
    return point.toBytes()
  }

  /**
   * Scalar multiplication
   */
  static scalarMultiply(point: EdwardsPoint, scalar: bigint): EdwardsPoint {
    return point.multiply(scalar)
  }

  /**
   * Point addition
   */
  static add(p1: EdwardsPoint, p2: EdwardsPoint): EdwardsPoint {
    return p1.add(p2)
  }

  /**
   * Point doubling
   */
  static double(point: EdwardsPoint): EdwardsPoint {
    return point.double()
  }

  /**
   * Point negation
   */
  static negate(point: EdwardsPoint): EdwardsPoint {
    return point.negate()
  }

  /**
   * Check if point is on curve
   */
  static isOnCurve(point: EdwardsPoint): boolean {
    return point.isTorsionFree()
  }

  /**
   * Get generator point
   */
  static get GENERATOR() {
    return BandersnatchNoble.BASE
  }

  /**
   * Get infinity point
   */
  static get INFINITY() {
    return BandersnatchNoble.ZERO
  }

  /**
   * Hash point to bytes (for challenge generation)
   */
  static hashPoint(point: EdwardsPoint): Uint8Array {
    return point.toBytes()
  }
}
