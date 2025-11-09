/**
 * Bandersnatch Curve Implementation using @noble/curves
 *
 * This uses the @noble/curves Twisted Edwards implementation as a base
 * and customizes it for Bandersnatch parameters
 */

import { type EdwardsPoint, edwards } from '@noble/curves/abstract/edwards.js'
import { Field } from '@noble/curves/abstract/modular'
import { mod, modInverse, modSqrt } from '@pbnj/core'
import { BANDERSNATCH_PARAMS } from './config'

// Elligator2 hash-to-curve moved to bandersnatch-vrf package

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
   * Convert Noble EdwardsPoint to arkworks-compatible compressed bytes
   *
   * This implements the exact arkworks Twisted Edwards point compression algorithm
   * (Compress::Yes mode):
   * 1. Extract affine coordinates (x, y) from the point
   * 2. Determine x-coordinate sign using TEFlags::from_x_coordinate logic
   * 3. Serialize y-coordinate in little-endian format (32 bytes)
   * 4. Encode x-coordinate sign in the MSB (bit 7) of the last byte
   *
   * This always uses compressed form (32 bytes) as required by the Bandersnatch VRF spec
   * section 2.1 for `point_to_string` function. This matches arkworks' `Compress::Yes` mode.
   *
   * Reference: arkworks-algebra/ec/src/models/twisted_edwards/serialization_flags.rs
   * Reference: arkworks-algebra/ec/src/models/twisted_edwards/mod.rs (serialize_with_mode)
   *
   * @param noblePoint - Noble EdwardsPoint to compress
   * @returns Compressed point bytes (32 bytes, arkworks-compatible, compressed format)
   */
  static pointToBytes(noblePoint: EdwardsPoint): Uint8Array {
    const { x, y } = noblePoint.toAffine()
    // Fp.toBytes() allows non-canonical encoding of y (>= p).
    const bytes = BandersnatchNoble.Fp.toBytes(y)
    // Each y has 2 valid points: (x, y), (x,-y).
    // When compressing, it's enough to store y and use the last byte to encode sign of x
    // Use arkworks TEFlags logic: x > -x determines sign bit
    const negX = mod(
      BANDERSNATCH_PARAMS.FIELD_MODULUS - x,
      BANDERSNATCH_PARAMS.FIELD_MODULUS,
    )
    const xIsNegative = x > negX // TEFlags::XIsNegative if x > -x
    bytes[bytes.length - 1] |= xIsNegative ? 0x80 : 0
    return bytes
  }

  /**
   * Decompress arkworks-compatible point bytes to Noble EdwardsPoint
   * This is the inverse of compressNoblePoint - it handles arkworks sign bit logic
   *
   * @param bytes - Compressed point bytes (arkworks format)
   * @returns Noble EdwardsPoint
   */
  static bytesToPoint(bytes: Uint8Array): EdwardsPoint {
    if (bytes.length !== 32) {
      throw new Error(
        `Invalid compressed point length: ${bytes.length}, expected 32`,
      )
    }

    // Extract sign bit (bit 7 of last byte) - arkworks TEFlags format
    const lastByte = bytes[31]
    const signBit = (lastByte & 0x80) !== 0

    // Clear sign bit to get pure y-coordinate
    const yBytes = new Uint8Array(bytes)
    yBytes[31] = lastByte & 0x7f

    // Convert little-endian y-coordinate to bigint
    let y = 0n
    for (let i = 0; i < 32; i++) {
      y += BigInt(yBytes[i]) << (8n * BigInt(i))
    }

    // Validate y is in field
    if (y >= BANDERSNATCH_PARAMS.FIELD_MODULUS) {
      throw new Error('Invalid y-coordinate: exceeds field modulus')
    }

    // Calculate x from y using curve equation: a*x^2 + y^2 = 1 + d*x^2*y^2
    // Rearranged: x^2 = (y^2 - 1) / (d*y^2 - a)
    const { a, d } = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS
    const p = BANDERSNATCH_PARAMS.FIELD_MODULUS

    const y2 = mod(y * y, p)
    const numerator = mod(y2 - 1n, p)
    const denominator = mod(d * y2 - a, p)

    // Calculate modular inverse of denominator
    const denominatorInv = modInverse(denominator, p)
    const x2 = mod(numerator * denominatorInv, p)

    // Calculate square root
    const x = modSqrt(x2, p, BandersnatchNoble.Fp)
    if (x === null) {
      throw new Error('Point is not on curve: no square root exists')
    }

    // Apply arkworks sign bit logic
    // Rust: if flags.is_negative() { (neg_x, y) } else { (x, y) }
    // The flag is set (signBit = true) when the original x satisfied x > -x (XIsNegative)
    // We computed x from y, but we need to determine which of the two possible x values
    // matches the flag. The flag tells us which x was originally used.
    const negX = mod(p - x, p)
    const xIsNegative = x > negX // Check if computed x satisfies x > -x

    // Choose correct x based on sign bit
    // If signBit matches xIsNegative, use x; otherwise use negX
    const finalX = signBit === xIsNegative ? x : negX

    // Create Noble point from affine coordinates
    const point = BandersnatchNoble.fromAffine({ x: finalX, y })

    // Validate point is in prime subgroup as required by bandersnatch-vrf-spec section 2.1:
    // "This function MUST outputs 'INVALID' if the octet-string does not decode
    // to a point on the prime subgroup G"
    // A point is in the prime subgroup if and only if multiplying by the curve order
    // gives the identity point (infinity)
    // Since @noble/curves requires 1 <= scalar < curve.n, we use CURVE_ORDER - 1
    // and then add the point once more: point * CURVE_ORDER = point * (CURVE_ORDER - 1) + point
    const curveOrderMinusOne = BANDERSNATCH_PARAMS.CURVE_ORDER - 1n
    const pointTimesOrderMinusOne = this.scalarMultiply(
      point,
      curveOrderMinusOne,
    )
    const pointTimesOrder = this.add(pointTimesOrderMinusOne, point)
    const isInPrimeSubgroup = pointTimesOrder.equals(BandersnatchNoble.ZERO)

    if (!isInPrimeSubgroup) {
      throw new Error(
        'Point is not in prime subgroup: decoded point is not in G',
      )
    }

    return point
  }

  /**
   * Scalar multiplication
   * Handles edge cases: scalar 0, negative scalars, and scalars >= curve order
   */
  static scalarMultiply(point: EdwardsPoint, scalar: bigint): EdwardsPoint {
    // Handle scalar 0: return identity point
    if (scalar === 0n) {
      return BandersnatchNoble.ZERO
    }

    // Handle negative scalars: negate point and use positive scalar
    if (scalar < 0n) {
      const negPoint = point.negate()
      const positiveScalar = -scalar
      // Reduce modulo curve order
      const reducedScalar = positiveScalar % BANDERSNATCH_PARAMS.CURVE_ORDER
      if (reducedScalar === 0n) {
        return BandersnatchNoble.ZERO
      }
      return negPoint.multiply(reducedScalar)
    }

    // Reduce scalar modulo curve order if it's >= curve order
    // @noble/curves requires 1 <= scalar < curve.n
    const reducedScalar = scalar % BANDERSNATCH_PARAMS.CURVE_ORDER
    if (reducedScalar === 0n) {
      return BandersnatchNoble.ZERO
    }

    return point.multiply(reducedScalar)
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

  /**
   * Get curve order
   */
  static get CURVE_ORDER() {
    return BANDERSNATCH_PARAMS.CURVE_ORDER
  }
}
