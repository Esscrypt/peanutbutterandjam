/**
 * Bandersnatch Curve Implementation
 *
 * Implements basic curve operations for the Bandersnatch curve
 * Reference: submodules/ark-vrf/src/suites/bandersnatch/
 *
 * NOTE: This custom implementation is deprecated in favor of BandersnatchCurveNoble
 * which uses @noble/curves for better compatibility and correctness.
 */

import { sha512 } from '@noble/hashes/sha2'
// import { bytesToBigInt } from '@pbnj/core'
import type { CurvePoint } from '@pbnj/types'
import { BANDERSNATCH_PARAMS } from './config'
import { elligator2HashToCurve } from './crypto/elligator2'

/**
 * Bandersnatch curve operations
 */
export class BandersnatchCurve {
  /**
   * Field modulus for Bandersnatch curve
   */
  static readonly FIELD_MODULUS = BANDERSNATCH_PARAMS.FIELD_MODULUS

  /**
   * Curve order for Bandersnatch curve
   */
  static readonly CURVE_ORDER = BANDERSNATCH_PARAMS.CURVE_ORDER

  /**
   * Generator point
   */
  static readonly GENERATOR: CurvePoint = {
    x: BANDERSNATCH_PARAMS.GENERATOR.x,
    y: BANDERSNATCH_PARAMS.GENERATOR.y,
    isInfinity: false,
  }

  /**
   * Infinity point
   */
  static readonly INFINITY: CurvePoint = {
    x: 0n,
    y: 0n,
    isInfinity: true,
  }

  /**
   * Add two curve points
   */
  static add(p1: CurvePoint, p2: CurvePoint): CurvePoint {
    if (p1.isInfinity) return p2
    if (p2.isInfinity) return p1

    const x1 = p1.x
    const y1 = p1.y
    const x2 = p2.x
    const y2 = p2.y

    // Check if P1 + P2 = O (infinity point)
    // This happens when P2 = -P1, i.e., x2 = x1 and y2 = -y1
    if (x1 === x2 && y1 === (-y2 + this.FIELD_MODULUS) % this.FIELD_MODULUS) {
      return this.INFINITY
    }

    // Twisted Edwards curve addition formula
    // For points P1 = (x1, y1) and P2 = (x2, y2)
    // x3 = (x1*y2 + y1*x2) / (1 + d*x1*x2*y1*y2) mod p
    // y3 = (y1*y2 - a*x1*x2) / (1 - d*x1*x2*y1*y2) mod p

    const a = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.a
    const d = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.d

    // Calculate intermediate values
    const x1y2 = (x1 * y2) % this.FIELD_MODULUS
    const y1x2 = (y1 * x2) % this.FIELD_MODULUS
    const y1y2 = (y1 * y2) % this.FIELD_MODULUS
    const x1x2 = (x1 * x2) % this.FIELD_MODULUS
    const dxy = (d * x1x2 * y1y2) % this.FIELD_MODULUS

    // Calculate x3 = (x1*y2 + y1*x2) / (1 + d*x1*x2*y1*y2) mod p
    const x3Numerator = (x1y2 + y1x2) % this.FIELD_MODULUS
    const x3Denominator = (1n + dxy) % this.FIELD_MODULUS
    const x3DenomInv = this.modInverse(x3Denominator, this.FIELD_MODULUS)
    const x3 = (x3Numerator * x3DenomInv) % this.FIELD_MODULUS

    // Calculate y3 = (y1*y2 - a*x1*x2) / (1 - d*x1*x2*y1*y2) mod p
    let y3Numerator = (y1y2 - a * x1x2) % this.FIELD_MODULUS
    if (y3Numerator < 0n) y3Numerator += this.FIELD_MODULUS
    let y3Denominator = (1n - dxy) % this.FIELD_MODULUS
    if (y3Denominator < 0n) y3Denominator += this.FIELD_MODULUS
    const y3DenomInv = this.modInverse(y3Denominator, this.FIELD_MODULUS)
    const y3 = (y3Numerator * y3DenomInv) % this.FIELD_MODULUS

    return { x: x3, y: y3, isInfinity: false }
  }

  /**
   * Double a curve point
   */
  static double(point: CurvePoint): CurvePoint {
    if (point.isInfinity) return this.INFINITY

    const x = point.x
    const y = point.y

    // Twisted Edwards curve doubling formula
    // For point P = (x, y), 2P = (x3, y3) where:
    // x3 = (2*x*y) / (1 + d*x²*y²) mod p
    // y3 = (y² - a*x²) / (1 - d*x²*y²) mod p

    const a = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.a
    const d = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.d

    const x2 = (x * x) % this.FIELD_MODULUS
    const y2 = (y * y) % this.FIELD_MODULUS
    const x2y2 = (x2 * y2) % this.FIELD_MODULUS
    const dxy = (d * x2y2) % this.FIELD_MODULUS

    // Calculate x3 = (2*x*y) / (1 + d*x²*y²) mod p
    const x3Numerator = (2n * x * y) % this.FIELD_MODULUS
    const x3Denominator = (1n + dxy) % this.FIELD_MODULUS
    const x3DenomInv = this.modInverse(x3Denominator, this.FIELD_MODULUS)
    const x3 = (x3Numerator * x3DenomInv) % this.FIELD_MODULUS

    // Calculate y3 = (y² - a*x²) / (1 - d*x²*y²) mod p
    let y3Numerator = (y2 - a * x2) % this.FIELD_MODULUS
    if (y3Numerator < 0n) y3Numerator += this.FIELD_MODULUS
    let y3Denominator = (1n - dxy) % this.FIELD_MODULUS
    if (y3Denominator < 0n) y3Denominator += this.FIELD_MODULUS
    const y3DenomInv = this.modInverse(y3Denominator, this.FIELD_MODULUS)
    const y3 = (y3Numerator * y3DenomInv) % this.FIELD_MODULUS

    return { x: x3, y: y3, isInfinity: false }
  }

  /**
   * Scalar multiplication: point * scalar
   */
  static scalarMultiply(point: CurvePoint, scalar: bigint): CurvePoint {
    if (point.isInfinity) return this.INFINITY
    if (scalar === 0n) return this.INFINITY

    // Use double-and-add algorithm for efficient scalar multiplication
    let result = this.INFINITY
    let current = point
    let remaining = scalar

    while (remaining > 0n) {
      if (remaining % 2n === 1n) {
        result = this.add(result, current)
      }
      current = this.double(current)
      remaining = remaining >> 1n
    }

    return result
  }

  /**
   * Negate a curve point
   */
  static negate(point: CurvePoint): CurvePoint {
    if (point.isInfinity) return this.INFINITY

    return {
      x: point.x,
      y: (-point.y + this.FIELD_MODULUS) % this.FIELD_MODULUS,
      isInfinity: false,
    }
  }

  /**
   * Check if a point is on the curve
   */
  static isOnCurve(point: CurvePoint): boolean {
    if (point.isInfinity) return true

    const x = point.x
    const y = point.y

    // Bandersnatch is a Twisted Edwards curve: ax² + y² = 1 + dx²y²
    const a = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.a
    const d = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.d

    const x2 = (x * x) % this.FIELD_MODULUS
    const y2 = (y * y) % this.FIELD_MODULUS
    const x2y2 = (x2 * y2) % this.FIELD_MODULUS

    // Handle negative numbers correctly in modular arithmetic
    let ax2 = (a * x2) % this.FIELD_MODULUS
    if (ax2 < 0n) ax2 += this.FIELD_MODULUS

    const leftSide = (ax2 + y2) % this.FIELD_MODULUS
    const rightSide = (1n + d * x2y2) % this.FIELD_MODULUS

    return leftSide === rightSide
  }

  /**
   * Convert point to Uint8Array (compressed format matching ark-vrf)
   * Uses 32-byte compressed format: y-coordinate (little-endian) + x sign bit in MSB
   * Based on ark-vrf specification: MSB indicates x's sign (1 if x > p/2, 0 if x <= p/2)
   */
  static pointToBytes(point: CurvePoint): Uint8Array {
    if (point.isInfinity) {
      return new Uint8Array(32).fill(0)
    }

    // Convert y to little-endian bytes
    const result = new Uint8Array(32)
    let y = point.y
    for (let i = 0; i < 32; i++) {
      result[i] = Number(y & 0xffn)
      y = y >> 8n
    }

    // Set MSB of last byte to indicate x parity (1 if x is odd, 0 if x is even)
    const xIsOdd = point.x & 1n
    if (xIsOdd) {
      result[31] |= 0x80 // Set MSB
    }

    return result
  }

  /**
   * Convert Uint8Array to point
   */
  static bytesToPoint(bytes: Uint8Array): CurvePoint {
    if (bytes.length !== 32) {
      throw new Error(
        `Invalid compressed point length: ${bytes.length}, expected 32`,
      )
    }

    // Check if all bytes are zero (infinity point)
    if (bytes.every((byte) => byte === 0)) {
      return this.INFINITY
    }

    // Extract x sign bit from MSB of last byte
    const xSignBit = (bytes[31] & 0x80) !== 0
    const yBytes = new Uint8Array(32)
    yBytes.set(bytes.slice(0, 31))
    yBytes[31] = bytes[31] & 0x7f // Clear MSB

    // Convert y from little-endian
    let y = 0n
    for (let i = 0; i < 32; i++) {
      y += BigInt(yBytes[i]) << (BigInt(i) * 8n)
    }

    // Solve for x: a*x^2 + y^2 = 1 + d*x^2*y^2
    const a = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.a
    const d = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.d
    const p = this.FIELD_MODULUS

    const y2 = (y * y) % p
    const dy2 = (d * y2) % p

    // x^2 = (1 - y^2) / (a - d*y^2)
    const numerator = (1n - y2 + p) % p
    const denominator = (a - dy2 + p) % p
    const denomInv = this.modInverse(denominator, p)
    const x2 = (numerator * denomInv) % p

    // Find square root
    const x = this.modSqrt(x2, p)

    // Choose the correct x based on the parity bit
    // If parity bit is set, x should be odd, otherwise x should be even
    const xIsOdd = x & 1n
    const finalX = xIsOdd === (xSignBit ? 1n : 0n) ? x : (p - x) % p

    return { x: finalX, y, isInfinity: false }
  }

  /**
   * Hash to curve function (H1)
   * Maps arbitrary data to a curve point using Elligator2
   *
   * This implementation follows the Bandersnatch VRF specification:
   * - Uses SHA-512 with expand_message_xmd (RFC 9380)
   * - Uses Elligator2 mapping (RFC 9380, Section 6.8.2)
   * - Generates two field elements for uniform distribution
   * - Clears cofactor for prime subgroup membership
   */
  static hashToCurve(data: Uint8Array): CurvePoint {
    return elligator2HashToCurve(data)
  }

  /**
   * Hash curve point (H2)
   * Maps a curve point to a hash
   */
  static hashPoint(point: CurvePoint): Uint8Array {
    const bytes = this.pointToBytes(point)
    return sha512(bytes)
  }

  /**
   * Modular inverse using extended Euclidean algorithm
   */
  private static modInverse(a: bigint, m: bigint): bigint {
    let [old_r, r] = [a, m]
    let [old_s, s] = [1n, 0n]
    let [old_t, t] = [0n, 1n]

    while (r !== 0n) {
      const quotient = old_r / r
      ;[old_r, r] = [r, old_r - quotient * r]
      ;[old_s, s] = [s, old_s - quotient * s]
      ;[old_t, t] = [t, old_t - quotient * t]
    }

    return ((old_s % m) + m) % m
  }

  /**
   * Modular square root using Tonelli-Shanks algorithm
   */
  private static modSqrt(n: bigint, p: bigint): bigint {
    if (n === 0n) return 0n
    if (n === 1n) return 1n

    // Find Q and S such that p-1 = Q * 2^S
    let Q = p - 1n
    let S = 0n
    while (Q % 2n === 0n) {
      Q = Q / 2n
      S = S + 1n
    }

    // Find a quadratic non-residue z
    let z = 2n
    while (this.isQuadraticResidue(z, p)) {
      z = z + 1n
    }

    let M = S
    let c = this.modPow(z, Q, p)
    let t = this.modPow(n, Q, p)
    let R = this.modPow(n, (Q + 1n) / 2n, p)

    while (t !== 1n) {
      let i = 0n
      let temp = t
      while (temp !== 1n && i < M) {
        temp = this.modPow(temp, 2n, p)
        i = i + 1n
      }

      const b = this.modPow(c, 1n << (M - i - 1n), p)
      M = i
      c = this.modPow(b, 2n, p)
      t = (t * c) % p
      R = (R * b) % p
    }

    return R
  }

  /**
   * Check if a number is a quadratic residue
   */
  private static isQuadraticResidue(n: bigint, p: bigint): boolean {
    const exponent = (p - 1n) / 2n
    const result = this.modPow(n, exponent, p)
    return result === 1n
  }

  /**
   * Modular exponentiation
   */
  private static modPow(
    base: bigint,
    exponent: bigint,
    modulus: bigint,
  ): bigint {
    if (modulus === 1n) return 0n

    let result = 1n
    base = base % modulus

    while (exponent > 0n) {
      if (exponent % 2n === 1n) {
        result = (result * base) % modulus
      }
      exponent = exponent >> 1n
      base = (base * base) % modulus
    }

    return result
  }
}
