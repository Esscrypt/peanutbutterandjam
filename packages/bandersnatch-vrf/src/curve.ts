/**
 * Bandersnatch Curve Implementation
 *
 * Implements basic curve operations for the Bandersnatch curve
 * Reference: submodules/ark-vrf/src/suites/bandersnatch/
 */

import { bytesToBigInt } from '@pbnj/core'
import { BANDERSNATCH_PARAMS } from './config'

/**
 * Bandersnatch curve point representation
 */
export interface CurvePoint {
  x: bigint
  y: bigint
  isInfinity: boolean
}

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

    // Bandersnatch curve addition formula
    // For points P1 = (x1, y1) and P2 = (x2, y2)
    // λ = (y2 - y1) / (x2 - x1) mod p
    // x3 = λ² - x1 - x2 mod p
    // y3 = λ(x1 - x3) - y1 mod p

    const x1 = p1.x
    const y1 = p1.y
    const x2 = p2.x
    const y2 = p2.y

    // Handle point doubling case
    if (x1 === x2) {
      if (y1 === y2) {
        return this.double(p1)
      } else {
        return this.INFINITY // Points are inverses
      }
    }

    // Calculate λ = (y2 - y1) / (x2 - x1) mod p
    const numerator = (y2 - y1 + this.FIELD_MODULUS) % this.FIELD_MODULUS
    const denominator = (x2 - x1 + this.FIELD_MODULUS) % this.FIELD_MODULUS
    const lambda =
      (this.modInverse(denominator, this.FIELD_MODULUS) * numerator) %
      this.FIELD_MODULUS

    // Calculate x3 = λ² - x1 - x2 mod p
    const lambdaSquared = (lambda * lambda) % this.FIELD_MODULUS
    const x3 =
      (lambdaSquared - x1 - x2 + this.FIELD_MODULUS) % this.FIELD_MODULUS

    // Calculate y3 = λ(x1 - x3) - y1 mod p
    const y3 =
      (lambda * (x1 - x3 + this.FIELD_MODULUS) - y1 + this.FIELD_MODULUS) %
      this.FIELD_MODULUS

    return { x: x3, y: y3, isInfinity: false }
  }

  /**
   * Double a curve point
   */
  static double(point: CurvePoint): CurvePoint {
    if (point.isInfinity) return this.INFINITY

    const x = point.x
    const y = point.y

    // Point doubling formula for Bandersnatch curve
    // λ = (3x²) / (2y) mod p
    // x3 = λ² - 2x mod p
    // y3 = λ(x - x3) - y mod p

    // Calculate λ = (3x²) / (2y) mod p
    const threeXSquared = (3n * x * x) % this.FIELD_MODULUS
    const twoY = (2n * y) % this.FIELD_MODULUS
    const lambda =
      (this.modInverse(twoY, this.FIELD_MODULUS) * threeXSquared) %
      this.FIELD_MODULUS

    // Calculate x3 = λ² - 2x mod p
    const lambdaSquared = (lambda * lambda) % this.FIELD_MODULUS
    const x3 =
      (lambdaSquared - 2n * x + this.FIELD_MODULUS) % this.FIELD_MODULUS

    // Calculate y3 = λ(x - x3) - y mod p
    const y3 =
      (lambda * (x - x3 + this.FIELD_MODULUS) - y + this.FIELD_MODULUS) %
      this.FIELD_MODULUS

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

    // Bandersnatch curve equation: y² = x³ + ax + b
    // For Bandersnatch: a = 0, b = 5
    const leftSide = (y * y) % this.FIELD_MODULUS
    const rightSide = (x * x * x + 5n + this.FIELD_MODULUS) % this.FIELD_MODULUS

    return leftSide === rightSide
  }

  /**
   * Convert point to Uint8Array
   */
  static pointToBytes(point: CurvePoint): Uint8Array {
    if (point.isInfinity) {
      return new Uint8Array(64).fill(0)
    }

    // Serialize as (x, y) coordinates, each 32 Uint8Array
    const xUint8Array = this.bigintToUint8Array(point.x, 32)
    const yUint8Array = this.bigintToUint8Array(point.y, 32)

    return new Uint8Array([...xUint8Array, ...yUint8Array])
  }

  /**
   * Convert Uint8Array to point
   */
  static bytesToPoint(bytes: Uint8Array): CurvePoint {
    if (bytes.length !== 64) {
      // Try to handle shorter Uint8Array by padding
      if (bytes.length < 64) {
        const paddedUint8Array = new Uint8Array(64)
        paddedUint8Array.set(bytes, 0)
        bytes = paddedUint8Array
      } else {
        throw new Error('Invalid point bytes length')
      }
    }

    const xUint8Array = bytes.slice(0, 32)
    const yUint8Array = bytes.slice(32, 64)

    const x = bytesToBigInt(xUint8Array)
    const y = bytesToBigInt(yUint8Array)

    // Check if this is the infinity point
    if (x === 0n && y === 0n) {
      return this.INFINITY
    }

    return { x, y, isInfinity: false }
  }

  /**
   * Convert bigint to Uint8Array
   */
  private static bigintToUint8Array(value: bigint, length: number): Uint8Array {
    const bytes = new Uint8Array(length)
    let temp = value

    for (let i = length - 1; i >= 0; i--) {
      bytes[i] = Number(temp & 0xffn)
      temp = temp >> 8n
    }

    return bytes
  }

  /**
   * Hash to curve function (H1)
   * Maps arbitrary data to a curve point
   */
  static hashToCurve(data: Uint8Array): CurvePoint {
    // Use try-and-increment method for hash-to-curve
    let counter = 0
    const maxAttempts = 100

    while (counter < maxAttempts) {
      // Create hash input with counter
      const hashInput = new Uint8Array(data.length + 4)
      hashInput.set(data, 0)
      hashInput.set(
        new Uint8Array([
          counter & 0xff,
          (counter >> 8) & 0xff,
          (counter >> 16) & 0xff,
          (counter >> 24) & 0xff,
        ]),
        data.length,
      )

      // Hash the input
      const hash = this.sha256(hashInput)

      // Use first 32 Uint8Array as x-coordinate
      const x = bytesToBigInt(hash.slice(0, 32)) % this.FIELD_MODULUS

      // Try to solve for y: y² = x³ + 5
      const rightSide =
        (x * x * x + 5n + this.FIELD_MODULUS) % this.FIELD_MODULUS

      // Check if right side is a quadratic residue
      if (this.isQuadraticResidue(rightSide)) {
        const y = this.modSqrt(rightSide)
        const point = { x, y, isInfinity: false }

        if (this.isOnCurve(point)) {
          return point
        }
      }

      counter++
    }

    throw new Error('Failed to hash to curve after maximum attempts')
  }

  /**
   * Hash curve point (H2)
   * Maps a curve point to a hash
   */
  static hashPoint(point: CurvePoint): Uint8Array {
    const bytes = this.pointToBytes(point)
    return this.sha256(bytes)
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
   * Check if a number is a quadratic residue modulo p
   */
  private static isQuadraticResidue(n: bigint): boolean {
    // Use Euler's criterion: n^((p-1)/2) ≡ 1 (mod p) if n is a quadratic residue
    const exponent = (this.FIELD_MODULUS - 1n) / 2n
    const result = this.modPow(n, exponent, this.FIELD_MODULUS)
    return result === 1n
  }

  /**
   * Modular square root using Tonelli-Shanks algorithm
   */
  private static modSqrt(n: bigint): bigint {
    if (n === 0n) return 0n
    if (n === 1n) return 1n

    // Find Q and S such that p-1 = Q * 2^S
    let Q = this.FIELD_MODULUS - 1n
    let S = 0n
    while (Q % 2n === 0n) {
      Q = Q / 2n
      S = S + 1n
    }

    // Find a quadratic non-residue z
    let z = 2n
    while (this.isQuadraticResidue(z)) {
      z = z + 1n
    }

    let M = S
    let c = this.modPow(z, Q, this.FIELD_MODULUS)
    let t = this.modPow(n, Q, this.FIELD_MODULUS)
    let R = this.modPow(n, (Q + 1n) / 2n, this.FIELD_MODULUS)

    while (t !== 1n) {
      let i = 0n
      let temp = t
      while (temp !== 1n && i < M) {
        temp = this.modPow(temp, 2n, this.FIELD_MODULUS)
        i = i + 1n
      }

      const b = this.modPow(c, 1n << (M - i - 1n), this.FIELD_MODULUS)
      M = i
      c = this.modPow(b, 2n, this.FIELD_MODULUS)
      t = (t * c) % this.FIELD_MODULUS
      R = (R * b) % this.FIELD_MODULUS
    }

    return R
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

  /**
   * SHA-256 hash function
   */
  private static sha256(data: Uint8Array): Uint8Array {
    // Simple SHA-256 implementation for now
    // In production, use a proper cryptographic library
    const hash = new Uint8Array(32)

    // Simple hash function for demonstration
    let h = 0n
    for (let i = 0; i < data.length; i++) {
      h = (h * 31n + BigInt(data[i])) % (1n << 256n)
    }

    // Convert to Uint8Array
    for (let i = 0; i < 32; i++) {
      hash[i] = Number((h >> (BigInt(i) * 8n)) & 0xffn)
    }

    return hash
  }
}
