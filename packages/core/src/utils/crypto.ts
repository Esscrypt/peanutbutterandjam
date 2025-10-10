/**
 * Cryptographic utilities for JAM Protocol
 *
 * Provides hash functions, signature algorithms, and cryptographic operations
 * Reference: Gray Paper specifications
 */

import { bls12_381 } from '@noble/curves/bls12-381'
import * as ed from '@noble/ed25519'
// Import blakejs for cryptographic operations
import { blake2b } from '@noble/hashes/blake2.js'
import { sha512 } from '@noble/hashes/sha2'

// Configure Ed25519 with SHA-512
ed.hashes.sha512 = (...m) => sha512(ed.etc.concatBytes(...m))

import {
  bytesToBigInt,
  bytesToHex,
  type Hex,
  hexToBigInt,
  hexToBytes,
  numberToBytes,
  stringToBytes,
  zeroAddress,
  zeroHash,
} from 'viem'
import { type Safe, safeError, safeResult } from '../safe'

// Re-export viem's hex functions directly
export {
  bytesToHex,
  hexToBytes,
  bytesToBigInt,
  hexToBigInt,
  numberToBytes,
  zeroHash,
  zeroAddress,
  stringToBytes,
  type Hex,
}

/**
 * Check if a string is a valid hex string
 */
export function isValidHex(value: string): boolean {
  return /^0x[0-9a-fA-F]*$/.test(value)
}

/**
 * Check if a hex string has a specific length
 */
export function isValidHexLength(value: string, length: number): boolean {
  return isValidHex(value) && value.length === length * 2 + 2 // +2 for '0x'
}

/**
 * Blake2b hash function (alias for blake2bHash)
 */
export function blake2bHash(data: Uint8Array): Safe<Hex> {
  try {
    const hash = blake2b(data, { dkLen: 32 })
    return safeResult(bytesToHex(hash))
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Sign data with Ed25519 private key
 */
export function signEd25519(
  data: Uint8Array,
  privateKey: Uint8Array,
): Safe<Uint8Array> {
  // The @noble/ed25519 library expects the secret key to be exactly 32 Uint8Array
  // The secretKey from generateKeyPair() is a 32-byte seed
  if (privateKey.length !== 32) {
    return safeError(
      new Error(
        `Ed25519 private key must be 32 Uint8Array, got ${privateKey.length}`,
      ),
    )
  }
  return safeResult(ed.sign(data, privateKey))
}

/**
 * Verify Ed25519 signature
 */
export function verifyEd25519(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): Safe<boolean> {
  if (signature.length !== 64) {
    return safeError(new Error('Signature must be 64 bytes'))
  }
  return safeResult(ed.verify(signature, data, publicKey))
}

export function generateEd25519KeyPairStable(): {
  publicKey: Uint8Array
  privateKey: Uint8Array
} {
  const keyPair = ed.keygen()
  return {
    publicKey: new Uint8Array(keyPair.publicKey),
    privateKey: new Uint8Array(keyPair.secretKey), // This is 64 Uint8Array (32 Uint8Array seed + 32 Uint8Array public key)
  }
}

/**
 * Validate Ed25519 public key
 */
export function validatePublicKey(publicKey: Uint8Array): boolean {
  return publicKey.length === 32
}

/**
 * Validate Ed25519 private key
 */
export function validatePrivateKey(privateKey: Uint8Array): boolean {
  return privateKey.length === 32
}

/**
 * Validate Ed25519 signature
 */
export function validateSignature(signature: Uint8Array): boolean {
  return signature.length === 64
}

/**
 * BLS signature using blakejs
 * @param message - Message to sign
 * @param secretKey - Secret key for signing
 * @returns BLS signature as hex string
 */
export function blsSign(
  message: Uint8Array,
  secretKey: Uint8Array,
): Safe<Uint8Array> {
  const blss = bls12_381.shortSignatures
  const digest = blss.hash(
    message,
    'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_',
  )
  const signature = blss.sign(digest, secretKey)
  return safeResult(signature.toBytes())
}

/**
 * BLS signature verification using blakejs
 * @param message - Original message
 * @param signature - Signature to verify
 * @param publicKey - Public key for verification
 * @returns True if signature is valid
 */
export function blsVerify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): Safe<boolean> {
  const blss = bls12_381.shortSignatures
  const publicKeyPoint = bls12_381.G1.encodeToCurve(publicKey).toBytes()
  const digest = blss.hash(
    message,
    'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_',
  )

  const isValid = blss.verify(signature, digest, publicKeyPoint)
  return safeResult(isValid)
}
