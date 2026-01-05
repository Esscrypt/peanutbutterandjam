/**
 * Cryptographic utilities for JAM Protocol
 *
 * Provides key derivation, alternative name generation, and other crypto functions
 * used across the JAM ecosystem.
 */

import {
  Field,
  FpIsSquare,
  FpSqrt,
  type IField,
} from '@noble/curves/abstract/modular.js'
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'
import { BANDERSNATCH_PARAMS } from '@pbnjam/bandersnatch'
import type { AlternativeName, FixedLengthSize, KeyPair } from '@pbnjam/types'
import { type Safe, safeError, safeResult } from '@pbnjam/types'
import { blake2bHash, hexToBytes } from './utils/crypto'

// Configure Ed25519 with SHA-512
ed.hashes.sha512 = (...m) => sha512(ed.etc.concatBytes(...m))

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

  return base32Alphabet[digit] + encodeBase32(remaining, l - 1)
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
  return `e${base32Encoded}`
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
    privateKey: keyPair.secretKey, // This is 64 bytes (32-byte seed + 32-byte public key)
  })
}

/**
 * Proper modular arithmetic that handles negative numbers correctly
 * JavaScript's % operator can return negative results, but we need non-negative results
 *
 * @param a - Value
 * @param m - Modulus
 * @returns Non-negative result of a mod m
 */
export function mod(a: bigint, m: bigint): bigint {
  const result = a % m
  return result < 0n ? result + m : result
}

// Helper function for modular exponentiation
export function modPow(
  base: bigint,
  exponent: bigint,
  modulus: bigint,
): bigint {
  if (modulus === 1n) return 0n

  let result = 1n
  base = mod(base, modulus)

  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      result = mod(result * base, modulus)
    }
    exponent = exponent >> 1n
    base = mod(base * base, modulus)
  }

  return result
}

// Create Bandersnatch field for noble package functions
export const BANDERSNATCH_FIELD = Field(BANDERSNATCH_PARAMS.FIELD_MODULUS)

/**
 * Modular square root using noble package FpSqrt
 *
 * @param value - Value to find square root of
 * @param p - Prime modulus
 * @returns Square root if it exists
 */
export function modSqrt(
  value: bigint,
  p: bigint,
  field: IField<bigint>,
): bigint {
  if (value === 0n) return 0n
  if (value === 1n) return 1n

  // Check if value is a quadratic residue using noble package
  if (!FpIsSquare(field, value)) {
    throw new Error('Value is not a quadratic residue')
  }

  // Use noble package FpSqrt for modular square root
  const sqrtFn = FpSqrt(p)
  return sqrtFn(field, value)
}

/**
 * Modular inverse using extended Euclidean algorithm
 *
 * @param a - Value
 * @param m - Modulus
 * @returns Modular inverse
 */
export function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [a, m]
  let [oldS, s] = [1n, 0n]

  while (r !== 0n) {
    const quotient = oldR / r
    ;[oldR, r] = [r, oldR - quotient * r]
    ;[oldS, s] = [s, oldS - quotient * s]
  }

  if (oldR > 1n) {
    throw new Error('Modular inverse does not exist')
  }

  return oldS < 0n ? oldS + m : oldS
}

export function numberToBytesLittleEndian(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32)
  const hex = value.toString(16).padStart(64, '0')
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number.parseInt(hex.slice(62 - i * 2, 64 - i * 2), 16)
  }
  return bytes
}
