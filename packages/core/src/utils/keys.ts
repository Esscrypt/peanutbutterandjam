/**
 * Cryptographic Key Management for JAMNP-S
 *
 * Provides Ed25519, BLS, and Bandersnatch key pair generation and signing functionality
 * Implements Gray Paper validator key structure (336 bytes total)
 */

import { bls12_381 } from '@noble/curves/bls12-381.js'
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'
import { BandersnatchCurve } from '@pbnjam/bandersnatch'
import type {
  ConnectionEndpoint,
  IConfigService,
  IKeyPairService,
  KeyPair,
  ValidatorCredentials,
  ValidatorPublicKeys,
} from '@pbnjam/types'
import { type Safe, safeError, safeResult } from '@pbnjam/types'
import { hexToBytes } from 'viem'
import {
  deriveSecretSeeds,
  generateEd25519KeyPairFromSeed,
  generateTrivialSeed,
  mod,
} from '../crypto'

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
    const privateKeyScalar = mod(v, BandersnatchCurve.CURVE_ORDER)

    // Ensure the scalar is not zero (invalid for bandersnatch)
    if (privateKeyScalar === 0n) {
      return safeError(
        new Error(
          'Generated scalar is zero, which is invalid for bandersnatch',
        ),
      )
    }

    // Generate public key using BandersnatchCurve
    const publicKeyPoint = BandersnatchCurve.scalarMultiply(
      BandersnatchCurve.GENERATOR,
      privateKeyScalar,
    )

    // Convert public key point to bytes (32 bytes as per Gray Paper)
    const publicKey = BandersnatchCurve.pointToBytes(publicKeyPoint)

    // Convert scalar to 32-byte little-endian format for private key
    const privateKeyBytes = new Uint8Array(32)
    let temp = privateKeyScalar
    for (let i = 0; i < 32; i++) {
      privateKeyBytes[i] = Number(temp & 0xffn)
      temp >>= 8n
    }

    return safeResult({
      publicKey,
      privateKey: privateKeyBytes,
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
  return ed.verify(signature, message, publicKey)
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
): Safe<boolean> {
  if (publicKey.length !== 96) {
    return safeError(new Error('Public key must be 96 bytes'))
  }
  const blss = bls12_381.shortSignatures
  // BLS requires the message to be hashed to G1 curve
  const hashedMessage = bls12_381.G1.hashToCurve(message)
  // Convert signature bytes back to Point for verification
  const signaturePoint = bls12_381.G1.encodeToCurve(signature)
  // Convert public key bytes back to Point for verification
  const publicKeyPoint = bls12_381.G2.encodeToCurve(publicKey.slice(0, 96)) // Use first 96 bytes
  return safeResult(blss.verify(signaturePoint, hashedMessage, publicKeyPoint))
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

/**
 * Get full validator credentials with fallback logic
 *
 * Priority order:
 * 1. If validatorIndex is set in configService, generate dev account key pair for that index
 * 2. Else use keyPairService.getLocalKeyPair()
 *
 * @param configService - Config service with optional validatorIndex
 * @param keyPairService - Key pair service (required if validatorIndex is not set)
 * @returns Safe result with full ValidatorCredentials (includes Bandersnatch, Ed25519, BLS keys)
 */
export function getValidatorCredentialsWithFallback(
  configService: IConfigService,
  keyPairService?: IKeyPairService,
): Safe<ValidatorCredentials> {
  if (configService.validatorIndex !== undefined) {
    // Generate dev account key pair for the validator index
    const validatorIndex = configService.validatorIndex
    const [keyPairError, keyPairs] =
      generateDevAccountValidatorKeyPair(validatorIndex)
    if (keyPairError || !keyPairs) {
      return safeError(
        new Error(
          `Failed to generate dev account key pair for validator index ${validatorIndex}: ${
            keyPairError?.message || 'Key pair is undefined'
          }`,
        ),
      )
    }
    return safeResult(keyPairs)
  } else if (keyPairService) {
    // Use KeyPairService
    const [localKeyPairError, localKeyPair] = keyPairService.getLocalKeyPair()
    if (localKeyPairError || !localKeyPair) {
      return safeError(
        new Error(
          `No local key pair available from KeyPairService: ${
            localKeyPairError?.message || 'Key pair is undefined'
          }`,
        ),
      )
    }
    return safeResult(localKeyPair)
  } else {
    return safeError(
      new Error(
        'Either validatorIndex must be set in configService or keyPairService must be provided',
      ),
    )
  }
}

/**
 * Get Ed25519 key pair with fallback logic
 *
 * Reuses getValidatorCredentialsWithFallback and extracts Ed25519 keys
 *
 * Priority order:
 * 1. If validatorIndex is set in configService, generate dev account key pair for that index
 * 2. Else use keyPairService.getLocalKeyPair()
 *
 * @param configService - Config service with optional validatorIndex
 * @param keyPairService - Key pair service (required if validatorIndex is not set)
 * @returns Safe result with Ed25519 key pair (publicKey and privateKey)
 */
export function getEd25519KeyPairWithFallback(
  configService: IConfigService,
  keyPairService?: IKeyPairService,
): Safe<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  const [credentialsError, credentials] = getValidatorCredentialsWithFallback(
    configService,
    keyPairService,
  )
  if (credentialsError || !credentials) {
    return safeError(
      credentialsError || new Error('Failed to get validator credentials'),
    )
  }
  return safeResult({
    publicKey: credentials.ed25519KeyPair.publicKey,
    privateKey: credentials.ed25519KeyPair.privateKey,
  })
}

/**
 * Extract connection endpoint from validator metadata
 *
 * Parses validator metadata to extract IPv6 address and port.
 * According to Gray Paper specification:
 * - First 16 bytes of metadata: IPv6 address
 * - Bytes 16-18: Port number in little-endian format
 *
 * @param validatorIndex - Validator index (for error messages)
 * @param validatorKeys - Validator public keys containing metadata
 * @returns Connection endpoint with host, port, and Ed25519 public key
 */
export function getConnectionEndpointFromMetadata(
  validatorIndex: number,
  validatorKeys: ValidatorPublicKeys,
): Safe<ConnectionEndpoint> {
  try {
    // Convert metadata hex string to bytes
    const metadataBytes = hexToBytes(validatorKeys.metadata)

    // Validate metadata length (should be 128 bytes)
    if (metadataBytes.length < 18) {
      return safeError(
        new Error(
          `Invalid metadata length for validator ${validatorIndex}: expected at least 18 bytes, got ${metadataBytes.length}`,
        ),
      )
    }

    // First 16 bytes: IPv6 address
    const ipv6Bytes = metadataBytes.slice(0, 16)

    // Bytes 16-18: Port in little-endian format
    const portBytes = metadataBytes.slice(16, 18)

    // Parse port as little-endian uint16
    const port = portBytes[0] | (portBytes[1] << 8)

    // Convert IPv6 bytes to string format
    // Handle IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
    let host: string
    if (
      ipv6Bytes[0] === 0 &&
      ipv6Bytes[1] === 0 &&
      ipv6Bytes[2] === 0 &&
      ipv6Bytes[3] === 0 &&
      ipv6Bytes[4] === 0 &&
      ipv6Bytes[5] === 0 &&
      ipv6Bytes[6] === 0 &&
      ipv6Bytes[7] === 0 &&
      ipv6Bytes[8] === 0 &&
      ipv6Bytes[9] === 0 &&
      ipv6Bytes[10] === 0xff &&
      ipv6Bytes[11] === 0xff
    ) {
      // IPv4-mapped IPv6: ::ffff:x.x.x.x -> extract IPv4
      host = `${ipv6Bytes[12]}.${ipv6Bytes[13]}.${ipv6Bytes[14]}.${ipv6Bytes[15]}`
    } else {
      // Full IPv6 address - convert to standard format
      const parts: string[] = []
      for (let i = 0; i < 16; i += 2) {
        const part = (ipv6Bytes[i] << 8) | ipv6Bytes[i + 1]
        parts.push(part.toString(16).padStart(4, '0'))
      }
      host = parts.join(':').replace(/(^|:)(0+:)+/g, '::')
    }

    // Convert Ed25519 public key to bytes
    const publicKey = hexToBytes(validatorKeys.ed25519)

    return safeResult({
      host,
      port,
      publicKey,
    })
  } catch (error) {
    return safeError(
      new Error(
        `Failed to parse connection endpoint from metadata for validator ${validatorIndex}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    )
  }
}
