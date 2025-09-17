/**
 * RFC-9381 Nonce Generation Implementation
 *
 * Implements proper nonce generation for VRF as specified in RFC-9381 Section 5.4.2.2
 * Reference: https://www.rfc-editor.org/rfc/rfc9381.html#section-5.4.2.2
 */

import { hmac } from '@noble/hashes/hmac'
import { sha512 } from '@noble/hashes/sha2'
import { BANDERSNATCH_PARAMS } from '@pbnj/bandersnatch'
import { bytesToBigInt, logger } from '@pbnj/core'

/**
 * Generate nonce according to RFC-9381 Section 5.4.2.2
 *
 * @param secretKey - The secret key (x)
 * @param input - The VRF input (alpha)
 * @returns The nonce scalar
 */
export function generateNonce(
  secretKey: Uint8Array,
  input: Uint8Array,
): Uint8Array {
  try {
    // RFC-9381 Section 5.4.2.2: nonce = VRF_nonce_generation(SK, alpha_string)
    // where VRF_nonce_generation is defined as:
    // nonce = hash_to_int(PRF(SK, VRF_string_to_int(alpha_string) || 0x01))

    // Step 1: Convert alpha to integer (VRF_string_to_int)
    const alphaInt = stringToInt(input)

    // Step 2: Create PRF input: alpha_int || 0x01
    const prfInput = new Uint8Array(alphaInt.length + 1)
    prfInput.set(alphaInt, 0)
    prfInput[alphaInt.length] = 0x01

    // Step 3: Apply PRF (HMAC-SHA512)
    const prfOutput = hmacSha512(secretKey, prfInput)

    // Step 4: Hash to integer (hash_to_int)
    const nonce = hashToInt(prfOutput)

    logger.debug('Generated nonce', {
      secretKeyLength: secretKey.length,
      inputLength: input.length,
      nonceLength: nonce.length,
    })

    return nonce
  } catch (error) {
    logger.error('Nonce generation failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error(
      `Nonce generation failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Convert string to integer according to RFC-9381
 *
 * @param input - Input string
 * @returns Integer representation as Uint8Array
 */
function stringToInt(input: Uint8Array): Uint8Array {
  // RFC-9381: VRF_string_to_int(alpha_string) = alpha_string
  // For our purposes, we just return the input as-is
  return input
}

/**
 * Hash to integer according to RFC-9381
 *
 * @param input - Input bytes
 * @returns Integer scalar
 */
function hashToInt(input: Uint8Array): Uint8Array {
  // RFC-9381: hash_to_int(X) = the integer whose octet string representation is X
  // We need to convert the hash output to a scalar in the curve order

  const hashValue = bytesToBigInt(input)
  const scalar = hashValue % BANDERSNATCH_PARAMS.CURVE_ORDER

  // Convert back to bytes
  return intToBytes(scalar)
}

/**
 * Convert integer to bytes
 *
 * @param value - Integer value
 * @returns Byte representation
 */
function intToBytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32) // 32 bytes for curve scalar
  let temp = value

  for (let i = bytes.length - 1; i >= 0; i--) {
    bytes[i] = Number(temp & 0xffn)
    temp = temp >> 8n
  }

  return bytes
}

/**
 * HMAC-SHA512 implementation
 *
 * @param key - HMAC key
 * @param data - Data to authenticate
 * @returns HMAC output
 */
function hmacSha512(key: Uint8Array, data: Uint8Array): Uint8Array {
  // Use @noble/hashes for HMAC-SHA512
  return hmac(sha512, key, data)
}
