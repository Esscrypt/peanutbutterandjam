/**
 * Cryptographic utilities for JAM Protocol
 *
 * Provides key derivation, alternative name generation, and other crypto functions
 * used across the JAM ecosystem.
 */

import * as ed from '@noble/ed25519'
import type { AlternativeName, FixedLengthSize, KeyPair } from '@pbnj/types'
import { type Safe, safeError, safeResult } from './safe'
import { blake2bHash, hexToBytes } from './utils/crypto'

/**
 * JIP-5: Secret key derivation
 *
 * Derives Ed25519 and Bandersnatch secret seeds from a 32-byte seed using BLAKE2b
 *
 * @param seed - 32-byte seed
 * @returns Object containing ed25519_secret_seed and bandersnatch_secret_seed
 */
export function deriveSecretSeeds(seed: Uint8Array): Safe<{
  ed25519SecretSeed: Uint8Array
  bandersnatchSecretSeed: Uint8Array
  blsSecretSeed: Uint8Array
}> {
  if (seed.length !== 32) {
    return safeError(new Error('Seed must be exactly 32 bytes'))
  }

  // ASCII-encode the derivation strings
  const ed25519String = new TextEncoder().encode('jam_val_key_ed25519')
  const bandersnatchString = new TextEncoder().encode(
    'jam_val_key_bandersnatch',
  )
  const blsString = new TextEncoder().encode('jam_val_key_bls')

  // Concatenate strings with seed
  const ed25519Input = new Uint8Array(ed25519String.length + seed.length)
  ed25519Input.set(ed25519String, 0)
  ed25519Input.set(seed, ed25519String.length)

  const bandersnatchInput = new Uint8Array(
    bandersnatchString.length + seed.length,
  )
  bandersnatchInput.set(bandersnatchString, 0)
  bandersnatchInput.set(seed, bandersnatchString.length)

  const blsInput = new Uint8Array(blsString.length + seed.length)
  blsInput.set(blsString, 0)
  blsInput.set(seed, blsString.length)

  // Compute BLAKE2b hashes with 32-byte output
  const [error, ed25519SecretSeed] = blake2bHash(ed25519Input)
  if (error) {
    return safeError(error)
  }
  const [error2, bandersnatchSecretSeed] = blake2bHash(bandersnatchInput)
  if (error2) {
    return safeError(error2)
  }
  const [error3, blsSecretSeed] = blake2bHash(blsInput)
  if (error3) {
    return safeError(error3)
  }

  return safeResult({
    ed25519SecretSeed: hexToBytes(ed25519SecretSeed),
    bandersnatchSecretSeed: hexToBytes(bandersnatchSecretSeed),
    blsSecretSeed: hexToBytes(blsSecretSeed),
  })
}

/**
 * Generate trivial seed from 32-bit unsigned integer
 *
 * @param index - 32-bit unsigned integer
 * @returns 32-byte seed with the index repeated 8 times in little-endian
 */
export function generateTrivialSeed(index: number): Safe<Uint8Array> {
  if (index < 0 || index > 0xffffffff) {
    return safeError(new Error('Index must be a 32-bit unsigned integer'))
  }

  const seed = new Uint8Array(32)
  for (let i = 0; i < 8; i++) {
    // Write 4-byte little-endian integer at position i * 4
    seed[i * 4] = index & 0xff
    seed[i * 4 + 1] = (index >> 8) & 0xff
    seed[i * 4 + 2] = (index >> 16) & 0xff
    seed[i * 4 + 3] = (index >> 24) & 0xff
  }

  return safeResult(seed)
}

export function concatBytes(bytes: Uint8Array[]): Uint8Array {
  const totalLength = bytes.reduce((acc, curr) => acc + curr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const byte of bytes) {
    result.set(byte, offset)
    offset += byte.length
  }
  return result
}

/**
 * Implements the B function from Gray Paper specification
 * B(n, l) ≡ [abcdefghijklmnopqrstuvwxyz234567[n mod 32]] ⌢ B(⌊n/32⌋, l-1)
 *
 * @param n - The number to encode
 * @param l - The length of the result string
 * @returns Base32 encoded string
 */
function encodeBase32(n: bigint, l: number): string {
  const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567'

  if (l === 0) {
    return ''
  }

  const digit = Number(n % 32n)
  const remaining = n / 32n

  return encodeBase32(remaining, l - 1) + base32Alphabet[digit]
}

/**
 * Implements the N function from Gray Paper specification
 * N(k) ≡ $e ⌢ B(ℰ₃₂⁻¹(k), 52)
 *
 * @param k - The Ed25519 public key as bigint
 * @returns Alternative name string
 */
function generateAlternativeNameFromKey(k: bigint): AlternativeName {
  const base32Encoded = encodeBase32(k, 52)
  return `e${base32Encoded}` as AlternativeName
}

/**
 * Generate alternative name from Ed25519 public key according to dev-accounts specification
 *
 * Implements the Gray Paper specification for alternative name generation:
 * N(k) ≡ $e ⌢ B(ℰ₃₂⁻¹(k), 52)
 * where B(n, l) ≡ [abcdefghijklmnopqrstuvwxyz234567[n mod 32]] ⌢ B(⌊n/32⌋, l-1)
 *
 * This implementation matches the exact values from the dev-accounts documentation,
 * which may differ from the Gray Paper specification.
 *
 * @param publicKey - Ed25519 public key (32 bytes)
 * @param decoder - optional function to convert public key to bigint (uses default if not provided)
 * @returns Alternative name string
 */
export function generateAlternativeName(
  ed25519PublicKey: Uint8Array,
  decoder: (
    data: Uint8Array,
    length: FixedLengthSize,
  ) => Safe<{ value: bigint; remaining: Uint8Array }>,
): Safe<AlternativeName> {
  // Decode the public key to bigint
  const [error, response] = decoder(ed25519PublicKey, 32n)
  if (error) {
    return safeError(error)
  }

  // Generate alternative name using the N function
  const alternativeName = generateAlternativeNameFromKey(response.value)
  return safeResult(alternativeName)
}

/**
 * Generate Ed25519 key pair from seed
 */
export function generateEd25519KeyPairFromSeed(
  seed: Uint8Array,
): Safe<KeyPair> {
  const keyPair = ed.keygen(seed)
  return safeResult({
    publicKey: keyPair.publicKey,
    privateKey: keyPair.secretKey,
  })
}
