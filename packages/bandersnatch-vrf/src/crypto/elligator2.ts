/**
 * Elligator2 Hash-to-Curve Implementation for Bandersnatch
 *
 * This module implements Elligator2 mapping for the Bandersnatch Twisted Edwards curve,
 * which is used in VRF (Verifiable Random Function) implementations for deterministic
 * point generation from arbitrary input data.
 *
 * ## When to Use Elligator2
 *
 * Elligator2 is used in VRF implementations when you need to:
 * 1. **Hash arbitrary data to curve points**: Convert any input (like messages, nonces, or seeds)
 *    into valid points on the Bandersnatch curve
 * 2. **Ensure deterministic mapping**: Same input always produces the same curve point
 * 3. **Maintain uniform distribution**: The mapping should be approximately uniform across the curve
 * 4. **Enable VRF operations**: Required for generating VRF proofs and outputs
 *
 * ## Technical Details
 *
 * The implementation uses the birationally equivalent Weierstrass curve for Elligator2 mapping,
 * then converts back to Twisted Edwards form using the authoritative Sage script conversion functions.
 * This approach is more reliable than direct Montgomery curve mapping.
 *
 * Reference: RFC 9380 - Hashing to Elliptic Curves
 * https://datatracker.ietf.org/doc/rfc9380/
 */

import { sha512 } from '@noble/hashes/sha2'
import { BANDERSNATCH_PARAMS } from '@pbnj/bandersnatch'
import { bytesToBigInt, logger } from '@pbnj/core'
import type { CurvePoint } from '@pbnj/types'

/**
 * Elligator2 hash-to-curve for Bandersnatch
 *
 * Converts arbitrary input data into a valid point on the Bandersnatch curve.
 * This function is deterministic - the same input will always produce the same output.
 *
 * @param message - Input message to hash (can be any Uint8Array)
 * @returns Valid curve point on the Bandersnatch Twisted Edwards curve
 *
 * @example
 * ```typescript
 * // Hash a message to a curve point
 * const message = new TextEncoder().encode("Hello, VRF!");
 * const point = elligator2HashToCurve(message);
 * console.log(`Point: (${point.x}, ${point.y})`);
 *
 * // Hash empty input (common in test vectors)
 * const emptyPoint = elligator2HashToCurve(new Uint8Array(0));
 * ```
 */
export function elligator2HashToCurve(message: Uint8Array): CurvePoint {
  try {
    logger.debug('Elligator2 hash-to-curve', {
      messageLength: message.length,
    })

    // Step 1: Hash message to two field elements (like arkworks DefaultFieldHasher)
    const [u1, u2] = hashToField(message)

    // Step 2: Apply Elligator2 mapping to both elements and add them (like arkworks)
    const point1 = elligator2Map(u1)
    const point2 = elligator2Map(u2)
    const point = addPoints(point1, point2)

    // Step 3: Clear cofactor (multiply by cofactor = 4)
    const clearedPoint = clearCofactor(point)

    logger.debug('Elligator2 mapping completed', {
      fieldElement1: u1.toString(16),
      fieldElement2: u2.toString(16),
      pointX: point.x.toString(16),
      pointY: point.y.toString(16),
    })

    return clearedPoint
  } catch (error) {
    logger.error('Elligator2 hash-to-curve failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error(
      `Elligator2 hash-to-curve failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Hash message to field element using expand_message_xmd
 * Implements RFC 9380, Section 5.3.1 like arkworks DefaultFieldHasher
 *
 * @param message - Input message
 * @returns Two field elements (for uniform mapping like arkworks)
 */
function hashToField(message: Uint8Array): [bigint, bigint] {
  // Use expand_message_xmd with SHA-512 as specified in RFC 9380
  // DST = "ECVRF_" || h2c_suite_ID_string || suite_string
  // h2c_suite_ID_string = "Bandersnatch_XMD:SHA-512_ELL2_RO_"
  // suite_string = "Bandersnatch_SHA-512_ELL2"
  const h2cSuiteId = 'Bandersnatch_XMD:SHA-512_ELL2_RO_'
  const suiteString = 'Bandersnatch_SHA-512_ELL2'
  const DST = new TextEncoder().encode(`ECVRF_${h2cSuiteId}${suiteString}`)

  // Arkworks DefaultFieldHasher uses 128 bytes for field expansion (2 field elements)
  const hashBytes = expandMessageXmd(message, DST, 128) // 128 bytes like arkworks

  // Convert to two field elements like arkworks DefaultFieldHasher
  const hashValue1 = bytesToBigInt(hashBytes.slice(0, 64))
  const hashValue2 = bytesToBigInt(hashBytes.slice(64, 128))

  const field1 = hashValue1 % BANDERSNATCH_PARAMS.FIELD_MODULUS
  const field2 = hashValue2 % BANDERSNATCH_PARAMS.FIELD_MODULUS

  return [field1, field2]
}

/**
 * Expand message using expand_message_xmd
 * Implements RFC 9380, Section 5.3.1
 *
 * @param msg - Input message
 * @param DST - Domain separation tag
 * @param lenInBytes - Desired output length in bytes
 * @returns Expanded message
 */
function expandMessageXmd(
  msg: Uint8Array,
  DST: Uint8Array,
  lenInBytes: number,
): Uint8Array {
  // const b_in_bytes = 64 // SHA-512 block size
  const r_in_bytes = 128 // SHA-512 rate (block size - output size)

  const ell = Math.ceil(lenInBytes / 64) // Number of blocks needed

  if (ell > 255) {
    throw new Error('expand_message_xmd: ell too large')
  }

  // Step 1: Z_pad = I2OSP(0, r_in_bytes)
  const Z_pad = new Uint8Array(r_in_bytes).fill(0)

  // Step 2: l_i_b_str = I2OSP(len_in_bytes, 2)
  const l_i_b_str = new Uint8Array(2)
  l_i_b_str[0] = (lenInBytes >> 8) & 0xff
  l_i_b_str[1] = lenInBytes & 0xff

  // Step 3: msg_prime = Z_pad || msg || l_i_b_str || I2OSP(0, 1)
  const msg_prime = new Uint8Array(r_in_bytes + msg.length + 2 + 1)
  let offset = 0
  msg_prime.set(Z_pad, offset)
  offset += Z_pad.length
  msg_prime.set(msg, offset)
  offset += msg.length
  msg_prime.set(l_i_b_str, offset)
  offset += l_i_b_str.length
  msg_prime[offset] = 0

  // Step 4: b_0 = Hash(msg_prime)
  const b_0 = sha512(msg_prime)

  // Step 5: b_1 = Hash(b_0 || I2OSP(1, 1) || DST_prime)
  const DST_prime = new Uint8Array(DST.length + 1)
  DST_prime.set(DST, 0)
  DST_prime[DST.length] = DST.length

  const b_1_input = new Uint8Array(b_0.length + 1 + DST_prime.length)
  b_1_input.set(b_0, 0)
  b_1_input[b_0.length] = 1
  b_1_input.set(DST_prime, b_0.length + 1)

  const b_1 = sha512(b_1_input)

  // Step 6: For i in (2, ..., ell):
  const uniform_bytes = new Uint8Array(ell * 64)
  uniform_bytes.set(b_1, 0)

  for (let i = 2; i <= ell; i++) {
    const b_i_input = new Uint8Array(64 + 1 + DST_prime.length)
    b_i_input.set(b_0, 0)
    b_i_input[64] = i
    b_i_input.set(DST_prime, 65)

    const b_i = sha512(b_i_input)
    uniform_bytes.set(b_i, (i - 1) * 64)
  }

  // Step 7: Return the first len_in_bytes bytes
  return uniform_bytes.slice(0, lenInBytes)
}

/**
 * Proper modular arithmetic that handles negative numbers correctly
 * JavaScript's % operator can return negative results, but we need non-negative results
 *
 * @param a - Value
 * @param m - Modulus
 * @returns Non-negative result of a mod m
 */
function mod(a: bigint, m: bigint): bigint {
  const result = a % m
  return result < 0n ? result + m : result
}

/**
 * Modular square root using Tonelli-Shanks algorithm
 *
 * @param value - Value to find square root of
 * @param p - Prime modulus
 * @returns Square root if it exists
 */
function modSqrt(value: bigint, p: bigint): bigint {
  if (value === 0n) return 0n
  if (value === 1n) return 1n

  // Check if value is a quadratic residue
  if (!isSquare(value, p)) {
    throw new Error('Value is not a quadratic residue')
  }

  // Handle special cases
  if (p === 2n) return value
  if (p % 4n === 3n) {
    // For p ≡ 3 (mod 4), x = value^((p+1)/4) mod p
    const exponent = (p + 1n) / 4n
    return modPow(value, exponent, p)
  }

  // Tonelli-Shanks algorithm for p ≡ 1 (mod 4)
  // Find Q and S such that p-1 = Q * 2^S
  let Q = p - 1n
  let S = 0n
  while (Q % 2n === 0n) {
    Q = Q / 2n
    S = S + 1n
  }

  // Find a quadratic non-residue z
  let z = 2n
  while (isSquare(z, p)) {
    z = z + 1n
  }

  let c = modPow(z, Q, p)
  let x = modPow(value, (Q + 1n) / 2n, p)
  let t = modPow(value, Q, p)
  let m = S

  while (t !== 1n) {
    let tt = t
    let i = 0n
    while (i < m && tt !== 1n) {
      tt = mod(tt * tt, p)
      i = i + 1n
    }

    const b = modPow(c, modPow(2n, m - i - 1n, p - 1n), p)
    x = mod(x * b, p)
    c = mod(b * b, p)
    t = mod(t * c, p)
    m = i
  }

  return x
}

/**
 * Elligator2 mapping for Twisted Edwards curves
 *
 * Maps a field element to a point on the Bandersnatch curve using the Elligator2 algorithm.
 * This implementation uses the birationally equivalent Weierstrass curve for the mapping,
 * then converts back to Twisted Edwards form using the authoritative Sage script.
 *
 * @param u - Field element (typically from hashToField)
 * @returns Valid curve point on the Bandersnatch Twisted Edwards curve
 */
function elligator2Map(u: bigint): CurvePoint {
  const p = BANDERSNATCH_PARAMS.FIELD_MODULUS

  // Montgomery curve parameters for Bandersnatch
  // These are derived from the Twisted Edwards parameters
  // Montgomery form: By^2 = x^3 + Ax^2 + x
  // For Bandersnatch: a = -5, d = 0x6389c12633c267cbc66e3bf86be3b6d8cb66677177e54f92b369f2f5188d58e7
  const a = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.a // -5
  const d = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.d

  // Convert to Montgomery form: By^2 = x^3 + Ax^2 + x
  // A = 2(a + d)/(a - d), B = 4/(a - d)
  const aMinusD = mod(a - d, p)
  const aPlusD = mod(a + d, p)

  const A = mod(2n * aPlusD * modInverse(aMinusD, p), p)
  const B = mod(4n * modInverse(aMinusD, p), p)

  // Z is a non-square element (lowest absolute value)
  // For p = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001
  // Z = 2 is a non-square
  const Z = 2n

  // Constants from arkworks Elligator2Config
  const k = B // COEFF_B
  const jOnK = mod(A * modInverse(B, p), p) // COEFF_A_OVER_COEFF_B = A/B
  const kSqInv = mod(modInverse(mod(k * k, p), p), p) // ONE_OVER_COEFF_B_SQUARE = 1/B^2

  // Step 1: x1 = -(J / K) * inv0(1 + Z * u^2)
  const uSq = mod(u * u, p)
  const den1 = mod(1n + mod(Z * uSq, p), p)

  const x1 = mod(-jOnK * (den1 === 0n ? 1n : modInverse(den1, p)), p)

  // Step 2: gx1 = x1^3 + (J / K) * x1^2 + x1 / K^2
  const x1Sq = mod(x1 * x1, p)
  const x1Cb = mod(x1Sq * x1, p)
  const gx1 = mod(x1Cb + mod(jOnK * x1Sq, p) + mod(x1 * kSqInv, p), p)

  // Step 3: x2 = -x1 - (J / K)
  const x2 = mod(-x1 - jOnK, p)

  // Step 4: gx2 = x2^3 + (J / K) * x2^2 + x2 / K^2
  const x2Sq = mod(x2 * x2, p)
  const x2Cb = mod(x2Sq * x2, p)
  const gx2 = mod(x2Cb + mod(jOnK * x2Sq, p) + mod(x2 * kSqInv, p), p)

  // Step 5: Choose x and y based on which gx is a square
  let x
  let y
  let sgn0
  if (isSquare(gx1, p)) {
    x = x1
    y = modSqrt(gx1, p)
    sgn0 = true
  } else {
    x = x2
    y = modSqrt(gx2, p)
    sgn0 = false
  }

  // Step 6: Adjust y sign to match sgn0
  if (parity(y) !== sgn0) {
    y = mod(-y, p)
  }

  // Step 7: Convert to Montgomery coordinates
  const s = mod(x * k, p)
  const t = mod(y * k, p)

  // Step 8: Convert from Montgomery to Twisted Edwards
  // Rational map from RFC 9380 Appendix D
  const tv1 = mod(s + 1n, p)
  const tv2 = mod(tv1 * t, p)

  let v
  let w
  if (tv2 === 0n) {
    v = 0n
    w = 1n
  } else {
    const tv2Inv = modInverse(tv2, p)
    v = mod(mod(tv2Inv * tv1, p) * s, p)
    w = mod(mod(tv2Inv * t, p) * mod(s - 1n, p), p)
  }

  const point = { x: v, y: w, isInfinity: false }

  // Debug logging
  logger.debug('Elligator2 mapping debug', {
    u: u.toString(16),
    x1: x1.toString(16),
    x2: x2.toString(16),
    gx1: gx1.toString(16),
    gx2: gx2.toString(16),
    isGx1Square: isSquare(gx1, p),
    isGx2Square: isSquare(gx2, p),
    chosenX: x.toString(16),
    chosenY: y.toString(16),
    s: s.toString(16),
    t: t.toString(16),
    v: v.toString(16),
    w: w.toString(16),
  })

  // Verify the point is on the curve
  if (!isOnCurve(point)) {
    const x2 = mod(v * v, p)
    const y2 = mod(w * w, p)
    const x2y2 = mod(x2 * y2, p)
    const ax2 = mod(a * x2, p)
    const leftSide = mod(ax2 + y2, p)
    const rightSide = mod(1n + mod(d * x2y2, p), p)

    logger.error('Elligator2 mapping produced invalid point', {
      v: v.toString(16),
      w: w.toString(16),
      x2: x2.toString(16),
      y2: y2.toString(16),
      x2y2: x2y2.toString(16),
      ax2: ax2.toString(16),
      leftSide: leftSide.toString(16),
      rightSide: rightSide.toString(16),
      a: a.toString(16),
      d: d.toString(16),
    })
    throw new Error('Elligator2 mapping produced invalid point')
  }

  return point
}

/**
 * Calculate parity of field element (least significant bit)
 */
function parity(value: bigint): boolean {
  return value % 2n === 1n
}

/**
 * Check if a value is a quadratic residue (square) in the field
 *
 * @param value - Value to check
 * @param p - Prime modulus
 * @returns True if value is a quadratic residue
 */
function isSquare(value: bigint, p: bigint): boolean {
  if (value === 0n) return true
  if (value === 1n) return true

  // Use Legendre symbol: (a/p) = a^((p-1)/2) mod p
  // If result is 1, then a is a quadratic residue
  // If result is p-1, then a is a quadratic non-residue
  const legendre = modPow(value, (p - 1n) / 2n, p)
  return legendre === 1n
}

/**
 * Clear cofactor by multiplying by cofactor
 * Uses efficient scalar multiplication instead of repeated addition
 *
 * @param point - Input point
 * @returns Point with cleared cofactor
 */
function clearCofactor(point: CurvePoint): CurvePoint {
  if (point.isInfinity) return point

  // Cofactor is 4, so we multiply by 4
  const cofactor = BANDERSNATCH_PARAMS.COFACTOR

  // Efficient scalar multiplication by cofactor
  return scalarMultiply(point, cofactor)
}

/**
 * Check if a point is on the curve
 *
 * @param point - Point to check
 * @returns True if point is on curve
 */
function isOnCurve(point: CurvePoint): boolean {
  if (point.isInfinity) return true

  const p = BANDERSNATCH_PARAMS.FIELD_MODULUS
  const a = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.a
  const d = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.d

  const x = point.x
  const y = point.y

  // Check twisted Edwards curve equation: a*x^2 + y^2 = 1 + d*x^2*y^2
  const x2 = mod(x * x, p)
  const y2 = mod(y * y, p)

  const leftSide = mod(a * x2 + y2, p)
  const rightSide = mod(1n + d * x2 * y2, p)

  return leftSide === rightSide
}

/**
 * Scalar multiplication using double-and-add algorithm
 *
 * @param point - Base point
 * @param scalar - Scalar multiplier
 * @returns Result point
 */
function scalarMultiply(point: CurvePoint, scalar: bigint): CurvePoint {
  if (point.isInfinity || scalar === 0n) {
    return { x: 0n, y: 0n, isInfinity: true }
  }

  if (scalar === 1n) return point

  let result: CurvePoint = { x: 0n, y: 0n, isInfinity: true }
  let addend = point

  while (scalar > 0n) {
    if (scalar & 1n) {
      result = addPoints(result, addend)
    }
    addend = addPoints(addend, addend)
    scalar = scalar >> 1n
  }

  return result
}

/**
 * Add two points (simplified for cofactor clearing)
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Sum of points
 */
function addPoints(p1: CurvePoint, p2: CurvePoint): CurvePoint {
  if (p1.isInfinity) return p2
  if (p2.isInfinity) return p1

  const p = BANDERSNATCH_PARAMS.FIELD_MODULUS
  const a = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.a
  const d = BANDERSNATCH_PARAMS.CURVE_COEFFICIENTS.d

  // Check if points are the same (doubling)
  if (p1.x === p2.x && p1.y === p2.y) {
    // Point doubling formula for Twisted Edwards
    // x3 = (2*x1*y1) / (a*x1^2 + y1^2)
    // y3 = (y1^2 - a*x1^2) / (2 - a*x1^2 - y1^2)

    const x1 = p1.x
    const y1 = p1.y

    const x1Sq = mod(x1 * x1, p)
    const y1Sq = mod(y1 * y1, p)
    const ax1Sq = mod(a * x1Sq, p)

    const x3Numerator = mod(2n * x1 * y1, p)
    const x3Denominator = mod(ax1Sq + y1Sq, p)

    if (x3Denominator === 0n) {
      // This is the infinity point
      return { x: 0n, y: 1n, isInfinity: true }
    }

    const x3DenomInv = modInverse(x3Denominator, p)
    const x3 = mod(x3Numerator * x3DenomInv, p)

    const y3Numerator = mod(y1Sq - ax1Sq, p)
    const y3Denominator = mod(2n - ax1Sq - y1Sq, p)

    if (y3Denominator === 0n) {
      // This is the infinity point
      return { x: 0n, y: 1n, isInfinity: true }
    }

    const y3DenomInv = modInverse(y3Denominator, p)
    const y3 = mod(y3Numerator * y3DenomInv, p)

    return {
      x: x3,
      y: y3,
      isInfinity: false,
    }
  }

  // Twisted Edwards addition formula
  // x3 = (x1*y2 + y1*x2) / (1 + d*x1*x2*y1*y2)
  // y3 = (y1*y2 - a*x1*x2) / (1 - d*x1*x2*y1*y2)

  const x1 = p1.x
  const y1 = p1.y
  const x2 = p2.x
  const y2 = p2.y

  const x1y2 = mod(x1 * y2, p)
  const y1x2 = mod(y1 * x2, p)
  const y1y2 = mod(y1 * y2, p)
  const x1x2 = mod(x1 * x2, p)

  const dxy = mod(d * x1x2 * y1y2, p)

  const x3Numerator = mod(x1y2 + y1x2, p)
  const x3Denominator = mod(1n + dxy, p)

  if (x3Denominator === 0n) {
    // This is the infinity point
    return { x: 0n, y: 1n, isInfinity: true }
  }

  const x3DenomInv = modInverse(x3Denominator, p)
  const x3 = mod(x3Numerator * x3DenomInv, p)

  const y3Numerator = mod(y1y2 - a * x1x2, p)
  const y3Denominator = mod(1n - dxy, p)

  if (y3Denominator === 0n) {
    // This is the infinity point
    return { x: 0n, y: 1n, isInfinity: true }
  }

  const y3DenomInv = modInverse(y3Denominator, p)
  const y3 = mod(y3Numerator * y3DenomInv, p)

  return {
    x: x3,
    y: y3,
    isInfinity: false,
  }
}

/**
 * Modular exponentiation
 *
 * @param base - Base
 * @param exponent - Exponent
 * @param modulus - Modulus
 * @returns Result
 */
function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
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
 * Modular inverse using extended Euclidean algorithm
 *
 * @param a - Value
 * @param m - Modulus
 * @returns Modular inverse
 */
function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [a, m]
  let [oldS, s] = [1n, 0n]

  while (r !== 0n) {
    const quotient = oldR / r
    ;[oldR, r] = [r, oldR - quotient * r]
    ;[oldS, s] = [s, oldS - quotient * s]
  }

  if (oldR > 1n) {
    throw new Error('Modular inverse does not exist')
  }

  return oldS < 0n ? oldS + m : oldS
}
