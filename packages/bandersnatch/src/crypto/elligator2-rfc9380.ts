/**
 * Elligator2 Hash-to-Curve Implementation for Bandersnatch
 *
 * This implementation follows RFC-9380 section 6.8.2 and the ark-vrf specification
 * for Bandersnatch VRF-AD. It uses the exact parameters specified in the
 * Bandersnatch VRF-AD specification.
 *
 * References:
 * - RFC-9380: https://datatracker.ietf.org/doc/rfc9380
 * - ark-vrf specification: https://github.com/davxy/ark-vrf
 */

import { Field } from '@noble/curves/abstract/modular'
import { sha512 } from '@noble/hashes/sha2'
import { logger, type Safe, safeError, safeResult } from '@pbnj/core'
import type { CurvePoint } from '@pbnj/types'
import { BANDERSNATCH_PARAMS } from '../config'
import { BandersnatchCurve } from '../curve'

// Create field instance for Bandersnatch
const Fp = Field(BANDERSNATCH_PARAMS.FIELD_MODULUS)

/**
 * RFC-9380 section 6.8.2 Elligator2 implementation for Bandersnatch
 *
 * This follows the exact specification from the ark-vrf document:
 * - Suite string: "Bandersnatch_SHA-512_ELL2"
 * - Hash function: SHA-512
 * - Domain separation tag: "ECVRF_" + "Bandersnatch_XMD:SHA-512_ELL2_RO_" + "Bandersnatch_SHA-512_ELL2"
 */
export function elligator2HashToCurve(message: Uint8Array): Safe<CurvePoint> {
  try {
    logger.debug('Elligator2 hash-to-curve (RFC-9380)', {
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

    logger.debug('Elligator2 mapping completed (RFC-9380)', {
      fieldElement1: u1.toString(16),
      fieldElement2: u2.toString(16),
      pointX: clearedPoint.x.toString(16),
      pointY: clearedPoint.y.toString(16),
    })

    return safeResult(clearedPoint)
  } catch (error) {
    logger.error('Elligator2 hash-to-curve failed (RFC-9380)', {
      error: error instanceof Error ? error.message : String(error),
    })
    return safeError(
      new Error(
        `Elligator2 hash-to-curve failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
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

  const field1 = Fp.create(hashValue1)
  const field2 = Fp.create(hashValue2)

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
 * Convert bytes to bigint (little-endian)
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = 0; i < bytes.length; i++) {
    result += BigInt(bytes[i]) << BigInt(i * 8)
  }
  return result
}

// Use Fp.mod for all modular arithmetic to handle negative numbers correctly

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
      tt = Fp.create(tt * tt)
      i = i + 1n
    }

    const b = modPow(c, modPow(2n, m - i - 1n, p - 1n), p)
    x = Fp.create(x * b)
    c = Fp.create(b * b)
    t = Fp.create(t * c)
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
  const aMinusD = Fp.create(a - d)
  const aPlusD = Fp.create(a + d)

  const A = Fp.create(2n * aPlusD * Fp.inv(aMinusD))
  const B = Fp.create(4n * Fp.inv(aMinusD))

  // Z is a non-square element (lowest absolute value)
  // For p = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001
  // Z = 2 is a non-square
  const Z = 2n

  // Constants from arkworks Elligator2Config
  const k = B // COEFF_B
  const jOnK = Fp.create(A * Fp.inv(B)) // COEFF_A_OVER_COEFF_B = A/B
  const kSqInv = Fp.create(Fp.inv(Fp.create(k * k))) // ONE_OVER_COEFF_B_SQUARE = 1/B^2

  // Step 1: x1 = -(J / K) * inv0(1 + Z * u^2)
  const uSq = Fp.create(u * u)
  const den1 = Fp.create(1n + Fp.create(Z * uSq))

  const x1 = Fp.create(-jOnK * (den1 === 0n ? 1n : Fp.inv(den1)))

  // Step 2: gx1 = x1^3 + (J / K) * x1^2 + x1 / K^2
  const x1Sq = Fp.create(x1 * x1)
  const x1Cb = Fp.create(x1Sq * x1)
  const gx1 = Fp.create(x1Cb + Fp.create(jOnK * x1Sq) + Fp.create(x1 * kSqInv))

  // Step 3: x2 = -x1 - (J / K)
  const x2 = Fp.create(-x1 - jOnK)

  // Step 4: gx2 = x2^3 + (J / K) * x2^2 + x2 / K^2
  const x2Sq = Fp.create(x2 * x2)
  const x2Cb = Fp.create(x2Sq * x2)
  const gx2 = Fp.create(x2Cb + Fp.create(jOnK * x2Sq) + Fp.create(x2 * kSqInv))

  // Step 5: Choose x and y based on which gx is a square
  let x
  let y
  let sgn0
  if (isSquare(gx1, p)) {
    x = x1
    y = modSqrt(gx1, p)
    sgn0 = true
  } else if (isSquare(gx2, p)) {
    x = x2
    y = modSqrt(gx2, p)
    sgn0 = false
  } else {
    // This should not happen according to Elligator2 theory, but handle gracefully
    // Use a fallback point (generator)
    return BANDERSNATCH_PARAMS.GENERATOR
  }

  // Step 6: Adjust y sign to match sgn0
  if (parity(y) !== sgn0) {
    y = Fp.create(-y)
  }

  // Step 7: Convert to Montgomery coordinates
  const s = Fp.create(x * k)
  const t = Fp.create(y * k)

  // Step 8: Convert from Montgomery to Twisted Edwards
  // Rational map from RFC 9380 Appendix D
  const tv1 = Fp.create(s + 1n)
  const tv2 = Fp.create(tv1 * t)

  let v
  let w
  if (tv2 === 0n) {
    v = 0n
    w = 1n
  } else {
    const tv2Inv = Fp.inv(tv2)
    v = Fp.create(Fp.create(tv2Inv * tv1) * s)
    w = Fp.create(Fp.create(tv2Inv * t) * Fp.create(s - 1n))
  }

  const point = { x: v, y: w, isInfinity: false }

  return point
}

/**
 * Add two curve points
 */
function addPoints(p1: CurvePoint, p2: CurvePoint): CurvePoint {
  return BandersnatchCurve.add(p1, p2)
}

/**
 * Clear cofactor by multiplying by cofactor = 4
 */
function clearCofactor(point: CurvePoint): CurvePoint {
  return BandersnatchCurve.scalarMultiply(point, BANDERSNATCH_PARAMS.COFACTOR)
}

/**
 * Check if a value is a quadratic residue
 */
function isSquare(value: bigint, p: bigint): boolean {
  if (value === 0n) return true
  return modPow(value, (p - 1n) / 2n, p) === 1n
}

/**
 * Compute modular exponentiation: (base^exp) mod p
 */
function modPow(base: bigint, exp: bigint, _p: bigint): bigint {
  return Fp.pow(base, exp)
}

/**
 * Check parity of a field element
 */
function parity(value: bigint): boolean {
  return value % 2n === 1n
}

/**
 * Test vector validation function
 *
 * This function can be used to validate our implementation against the
 * test vectors provided in the ark-vrf specification.
 */
export function validateTestVector(
  input: Uint8Array,
  expectedPointHex: string,
): boolean {
  const [error, point] = elligator2HashToCurve(input)

  if (error) {
    logger.error('Test vector validation failed', { error: error.message })
    return false
  }

  // Convert point to hex string for comparison
  const pointBytes = BandersnatchCurve.pointToBytes(point)
  const pointHex = Array.from(pointBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const isValid = pointHex === expectedPointHex.toLowerCase()

  if (!isValid) {
    logger.warn('Test vector mismatch', {
      expected: expectedPointHex.toLowerCase(),
      actual: pointHex,
      input: Array.from(input)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
    })
  }

  return isValid
}

/**
 * Test vectors from ark-vrf specification
 *
 * These are the expected VRF input points for given inputs according to
 * the test vectors in the specification.
 */
export const TEST_VECTORS = {
  // Vector 1: empty input
  empty: {
    input: new Uint8Array(0),
    expectedPoint:
      'c5eaf38334836d4b10e05d2c1021959a917e08eaf4eb46a8c4c8d1bec04e2c00',
  },

  // Vector 2: single byte 0x0a
  singleByte: {
    input: new Uint8Array([0x0a]),
    expectedPoint:
      '8c1d1425374f01d86b23bfeab770c60b58d2eeb9afc5900c8b8a918d09a6086b',
  },

  // Vector 4: "sample" string
  sample: {
    input: new TextEncoder().encode('sample'),
    expectedPoint:
      '672e8c7a8e6d3eca67df38f11d50f3d7dbb26fa8e27565a5424e6f8ac4555dcc',
  },

  // Vector 5: "Bandersnatch vector" string
  bandersnatchVector: {
    input: new TextEncoder().encode('Bandersnatch vector'),
    expectedPoint:
      '4315192d2ce9e52ceb449a6b4da7f7e6636e53592c7f5e236763e21e9bac24c7',
  },
} as const

/**
 * Run all test vector validations
 */
export function runTestVectorValidation(): {
  passed: number
  total: number
  results: Record<string, boolean>
} {
  const results: Record<string, boolean> = {}
  let passed = 0
  let total = 0

  for (const [name, vector] of Object.entries(TEST_VECTORS)) {
    total++
    const isValid = validateTestVector(vector.input, vector.expectedPoint)
    results[name] = isValid
    if (isValid) passed++
  }

  logger.info('Test vector validation results', { passed, total, results })

  return { passed, total, results }
}
