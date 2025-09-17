/**
 * RFC-8032 Nonce Generation Implementation
 *
 * Implements nonce generation as specified in RFC-8032 and used in the Rust implementation
 * Reference: https://www.rfc-editor.org/rfc/rfc8032.html
 */

import { sha512 } from '@noble/hashes/sha2'
import { BANDERSNATCH_PARAMS } from '@pbnj/bandersnatch'
import { bytesToBigInt, logger, numberToBytes } from '@pbnj/core'

/**
 * Generate nonce according to RFC-8032 (matches Rust implementation)
 *
 * This is the nonce generation method used in the Rust bandersnatch-vrf-spec
 * and differs from the RFC-9381 method we initially implemented.
 *
 * @param secretKey - The secret key
 * @param inputPoint - The input point (serialized)
 * @returns The nonce scalar as bytes
 */
export function generateNonceRfc8032(
  secretKey: Uint8Array,
  inputPoint: Uint8Array,
): Uint8Array {
  try {
    // Step 1: Hash the secret key and take the second half
    const skHash = sha512(secretKey)
    const skHashSecondHalf = skHash.slice(32) // Take last 32 bytes

    // Step 2: Concatenate sk_hash + input_point
    const combined = new Uint8Array([...skHashSecondHalf, ...inputPoint])

    // Step 3: Hash the combination
    const h = sha512(combined)

    // Step 4: Convert to scalar modulo curve order
    const hashValue = bytesToBigInt(h)
    const scalar = hashValue % BANDERSNATCH_PARAMS.CURVE_ORDER

    const nonce = numberToBytes(scalar)

    logger.debug('Generated nonce (RFC-8032)', {
      secretKeyLength: secretKey.length,
      inputPointLength: inputPoint.length,
      nonceLength: nonce.length,
    })

    return nonce
  } catch (error) {
    logger.error('RFC-8032 nonce generation failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error(
      `RFC-8032 nonce generation failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
