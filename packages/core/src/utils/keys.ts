/**
 * Cryptographic Key Management for JAMNP-S
 *
 * Provides Ed25519, BLS, and Bandersnatch key pair generation and signing functionality
 * Implements Gray Paper validator key structure (336 bytes total)
 */

import { bls12_381 } from '@noble/curves/bls12-381'
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2'
import { BandersnatchCurveNoble } from '@pbnj/bandersnatch'
import type {
  ConnectionEndpoint,
  KeyPair,
  ValidatorCredentials,
} from '@pbnj/types'
import {
  deriveSecretSeeds,
  generateEd25519KeyPairFromSeed,
  generateTrivialSeed,
  mod,
} from '../crypto'
import { type Safe, safeError, safeResult } from '../safe'

/**
 * Generate BLS key pair from seed (deterministic)
 * Note: JIP-5 does not specify BLS key derivation, so we use a consistent
 * deterministic method using BLAKE2b hashing similar to JIP-5 principles
 */
export function generateBLSKeyPairFromSeed(
  blsSecretSeed: Uint8Array,
): Safe<KeyPair> {
  const privateKey = blsSecretSeed

  // Generate public key from private key
  const blss = bls12_381.shortSignatures
  const publicKey = blss.getPublicKey(privateKey).toBytes(false)

  return safeResult({
    publicKey,
    privateKey,
  })
}

/**
 * Generate Bandersnatch key pair from seed (deterministic)
 * Follows JIP-5 specification: SHA512 hash + little-endian interpretation + modulo reduction
 */
export function generateBandersnatchKeyPairFromSeed(
  bandersnatchSecretSeed: Uint8Array,
): Safe<KeyPair> {
  try {
    // Step 1: SHA512 hash the seed
    const hashBytes = sha512(bandersnatchSecretSeed)

    // Step 2: Interpret the hash as little-endian to get "v"
    let v = 0n
    for (let i = 0; i < hashBytes.length; i++) {
      v += BigInt(hashBytes[i]) << (8n * BigInt(i))
    }

    // Step 3: Reduce "v" modulo the prime order of the field to get the secret
    const privateKeyScalar = mod(v, BandersnatchCurveNoble.CURVE_ORDER)

    // Ensure the scalar is not zero (invalid for bandersnatch)
    if (privateKeyScalar === 0n) {
      return safeError(
        new Error(
          'Generated scalar is zero, which is invalid for bandersnatch',
        ),
      )
    }

    // Generate public key using BandersnatchCurveNoble
    const publicKeyPoint = BandersnatchCurveNoble.scalarMultiply(
      BandersnatchCurveNoble.GENERATOR,
      privateKeyScalar,
    )

    // Convert public key point to bytes (32 bytes as per Gray Paper)
    const publicKey = BandersnatchCurveNoble.pointToBytes(publicKeyPoint)

    return safeResult({
      publicKey,
      privateKey: bandersnatchSecretSeed,
    })
  } catch (error) {
    return safeError(
      new Error(
        `Failed to generate Bandersnatch key pair: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    )
  }
}

/**
 * Sign message with Ed25519 private key
 */
export function signEd25519Message(
  privateKey: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  // @noble/ed25519 expects 64-byte private key
  return ed.sign(privateKey, message)
}

/**
 * Verify Ed25519 signature
 */
export function verifySignature(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  return ed.verify(publicKey, message, signature)
}

/**
 * Generate BLS12-381 key pair
 * Returns 144-byte public key and 32-byte private key as per Gray Paper
 */
// export function generateBLSKeyPair(): Safe<KeyPair> {
//   // Generate private key (32 bytes)
//   const privateKey = new Uint8Array(32)
//   crypto.getRandomValues(privateKey)

//   // Generate public key from private key using G1 point
//   const blss = bls12_381.shortSignatures
//   const publicKey = blss.getPublicKey(privateKey).toBytes(false) // false = uncompressed

//   // Pad to 144 bytes as required by Gray Paper
//   const paddedPublicKey = new Uint8Array(144)
//   if (publicKey.length <= 144) {
//     paddedPublicKey.set(publicKey, 0)
//   } else {
//     // If public key is larger than 144 bytes, truncate it
//     paddedPublicKey.set(publicKey.slice(0, 144), 0)
//   }

//   return safeResult({
//     publicKey: paddedPublicKey,
//     privateKey,
//   })
// }

/**
 * Sign message with BLS private key
 */
export function signBLSMessage(
  privateKey: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  const blss = bls12_381.shortSignatures
  // BLS requires the message to be hashed to G1 curve
  const hashedMessage = bls12_381.G1.hashToCurve(message)
  const signature = blss.sign(hashedMessage, privateKey)
  // Convert Point to bytes
  return signature.toBytes()
}

/**
 * Verify BLS signature
 */
export function verifyBLSSignature(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  try {
    const blss = bls12_381.shortSignatures
    // BLS requires the message to be hashed to G1 curve
    const hashedMessage = bls12_381.G1.hashToCurve(message)
    // Convert signature bytes back to Point for verification
    const signaturePoint = bls12_381.G1.encodeToCurve(signature)
    // Convert public key bytes back to Point for verification
    const publicKeyPoint = bls12_381.G2.encodeToCurve(publicKey.slice(0, 96)) // Use first 96 bytes
    return blss.verify(signaturePoint, hashedMessage, publicKeyPoint)
  } catch {
    return false
  }
}

/**
 * Generate dev account seed according to JIP-5 specification
 * The 256-bit seed is generated by encoding the validator index as unsigned 32-bit
 * little endian integer and repeating that sequence 8 times.
 */
export function generateDevAccountSeed(
  validatorIndex: number,
): Safe<Uint8Array> {
  return generateTrivialSeed(validatorIndex)
}

/**
 * Generate deterministic validator key pair from seed
 */
export function generateValidatorKeyPairFromSeed(
  seed: Uint8Array,
  connectionEndpoint?: ConnectionEndpoint,
): Safe<ValidatorCredentials> {
  const [error, secretSeeds] = deriveSecretSeeds(seed)
  if (error) {
    return safeError(error)
  }
  // Generate deterministic Ed25519 key
  const [ed25519Error, ed25519KeyPair] = generateEd25519KeyPairFromSeed(
    secretSeeds.ed25519SecretSeed,
  )
  if (ed25519Error) {
    return safeError(ed25519Error)
  }

  // Generate deterministic BLS key
  const [blsError, blsKeyPair] = generateBLSKeyPairFromSeed(
    secretSeeds.blsSecretSeed,
  )
  if (blsError) {
    return safeError(blsError)
  }

  // Generate deterministic Bandersnatch key
  const [bandersnatchError, bandersnatchKeyPair] =
    generateBandersnatchKeyPairFromSeed(secretSeeds.bandersnatchSecretSeed)
  if (bandersnatchError) {
    return safeError(bandersnatchError)
  }

  // Generate metadata
  const metadata = new Uint8Array(128)
  if (connectionEndpoint) {
    const hostBytes = new TextEncoder().encode(connectionEndpoint.host)
    const portBytes = new TextEncoder().encode(
      connectionEndpoint.port.toString().padStart(4, '0'),
    )
    metadata.set(hostBytes.slice(0, 16), 0)
    metadata.set(portBytes.slice(0, 4), 16)
  }

  return safeResult({
    bandersnatchKeyPair: bandersnatchKeyPair,
    ed25519KeyPair: ed25519KeyPair,
    blsKeyPair: blsKeyPair,
    seed: seed,
    metadata: metadata,
  })
}

/**
 * Generate dev account validator key pair from validator index
 */
export function generateDevAccountValidatorKeyPair(
  validatorIndex: number,
): Safe<ValidatorCredentials> {
  // Generate dev account seed according to JIP-5
  const [seedError, seed] = generateDevAccountSeed(validatorIndex)
  if (seedError) {
    return safeError(seedError)
  }

  return generateValidatorKeyPairFromSeed(seed)
}
