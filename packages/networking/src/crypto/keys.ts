/**
 * Cryptographic Key Management for JAMNP-S
 *
 * Provides Ed25519 key pair generation and signing functionality
 */

import type { Bytes } from '@pbnj/types'
import {
  generateKeyPair as generateEd25519KeyPair,
  sign,
  verify,
} from '@stablelib/ed25519'

/**
 * Key pair structure
 */
export interface KeyPair {
  publicKey: Bytes
  privateKey: Bytes
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
export function signMessage(privateKey: Bytes, message: Bytes): Bytes {
  return sign(privateKey, message)
}

/**
 * Verify Ed25519 signature
 */
export function verifySignature(
  publicKey: Bytes,
  message: Bytes,
  signature: Bytes,
): boolean {
  return verify(publicKey, message, signature)
}
