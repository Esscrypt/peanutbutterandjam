/**
 * RFC-9381 Challenge Generation Implementation
 *
 * Implements challenge generation as specified in RFC-9381 for VRF
 * Reference: https://datatracker.ietf.org/doc/rfc9381/
 */

import { sha512 } from '@noble/hashes/sha2'
import { BANDERSNATCH_PARAMS } from '@pbnj/bandersnatch'
import { bytesToBigInt, logger, mod } from '@pbnj/core'

/**
 * Generate challenge according to RFC-9381
 *
 * This implements the challenge generation procedure from RFC-9381 Section 5.4.2.1
 * which is used in the Bandersnatch VRF specification.
 *
 * @param points - Array of curve points to include in challenge
 * @param additionalData - Additional data to include in challenge
 * @returns The challenge scalar
 */
export function generateChallengeRfc9381(
  points: Uint8Array[],
  additionalData: Uint8Array = new Uint8Array(0),
): bigint {
  try {
    logger.debug('Generating RFC-9381 challenge', {
      pointsCount: points.length,
      additionalDataLength: additionalData.length,
    })

    // Step 1: str_0 = suite_string || 0x02
    const suiteString = 'Bandersnatch_SHA-512_ELL2'
    const str0 = new Uint8Array(suiteString.length + 1)
    str0.set(new TextEncoder().encode(suiteString), 0)
    str0[str0.length - 1] = 0x02

    // Step 2: str_i = str_{i-1} || point_to_string(P_{i-1}), i = 1 ... n
    let currentStr = str0
    for (const point of points) {
      const newStr = new Uint8Array(currentStr.length + point.length)
      newStr.set(currentStr, 0)
      newStr.set(point, currentStr.length)
      currentStr = newStr
    }

    // Step 3: h = hash(str_n || ad || 0x00)
    const hashInput = new Uint8Array(
      currentStr.length + additionalData.length + 1,
    )
    hashInput.set(currentStr, 0)
    hashInput.set(additionalData, currentStr.length)
    hashInput[hashInput.length - 1] = 0x00

    const h = sha512(hashInput)

    // Step 4: c = string_to_int(h_{0 ... cLen - 1})
    // For Bandersnatch, cLen is 32 bytes (256 bits)
    const cLen = 32
    const cBytes = h.slice(0, cLen)
    const c = mod(bytesToBigInt(cBytes), BANDERSNATCH_PARAMS.CURVE_ORDER)

    logger.debug('RFC-9381 challenge generated', {
      challenge: c.toString(16),
    })

    return c
  } catch (error) {
    logger.error('RFC-9381 challenge generation failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error(
      `RFC-9381 challenge generation failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Point-to-hash according to RFC-9381
 *
 * This implements the point-to-hash procedure from RFC-9381 Section 5.4.2.3
 * which is used in the Bandersnatch VRF specification.
 *
 * @param point - Curve point to hash
 * @param mulByCofactor - Whether to multiply by cofactor
 * @returns The hash output
 */
export function pointToHashRfc9381(
  point: Uint8Array,
  mulByCofactor = false,
): Uint8Array {
  try {
    logger.debug('Generating RFC-9381 point-to-hash', {
      pointLength: point.length,
      mulByCofactor,
    })

    // Step 1: str_0 = suite_string || 0x03
    const suiteString = 'Bandersnatch_SHA-512_ELL2'
    const str0 = new Uint8Array(suiteString.length + 1)
    str0.set(new TextEncoder().encode(suiteString), 0)
    str0[str0.length - 1] = 0x03

    // Step 2: str_1 = str_0 || point_to_string(P)
    const str1 = new Uint8Array(str0.length + point.length)
    str1.set(str0, 0)
    str1.set(point, str0.length)

    // Step 3: str_2 = str_1 || 0x00
    const str2 = new Uint8Array(str1.length + 1)
    str2.set(str1, 0)
    str2[str2.length - 1] = 0x00

    // Step 4: h = hash(str_2)
    const h = sha512(str2)

    logger.debug('RFC-9381 point-to-hash generated', {
      hashLength: h.length,
    })

    return h
  } catch (error) {
    logger.error('RFC-9381 point-to-hash failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error(
      `RFC-9381 point-to-hash failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
