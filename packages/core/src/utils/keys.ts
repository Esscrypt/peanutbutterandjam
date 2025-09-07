/**
 * Cryptographic Key Management for JAMNP-S
 *
 * Provides Ed25519 key pair generation and signing functionality
 */

import {
  generateKeyPair as generateEd25519KeyPair,
  sign,
  verify,
} from '@stablelib/ed25519'

/**
 * Key pair structure
 */
export interface KeyPair {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

/**
 * Generate Ed25519 key pair
 */
export function generateKeyPair(): KeyPair {
  const keyPair = generateEd25519KeyPair()
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.secretKey,
  }
}

/**
 * Sign message with Ed25519 private key
 */
export function signMessage(
  privateKey: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  return sign(privateKey, message)
}

/**
 * Verify Ed25519 signature
 */
export function verifySignature(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  return verify(publicKey, message, signature)
}
