/**
 * Cryptographic utilities for JAM Protocol
 * 
 * Provides key derivation, alternative name generation, and other crypto functions
 * used across the JAM ecosystem.
 */

import type { Bytes } from '@pbnj/types'
import { generateKeyPairFromSeed } from '@stablelib/ed25519'
import { hash as blake2b } from '@stablelib/blake2b'

/**
 * JIP-5: Secret key derivation
 * 
 * Derives Ed25519 and Bandersnatch secret seeds from a 32-byte seed using BLAKE2b
 * 
 * @param seed - 32-byte seed
 * @returns Object containing ed25519_secret_seed and bandersnatch_secret_seed
 */
export function deriveSecretSeeds(seed: Bytes): {
  ed25519_secret_seed: Bytes
  bandersnatch_secret_seed: Bytes
} {
  if (seed.length !== 32) {
    throw new Error('Seed must be exactly 32 bytes')
  }

  // ASCII-encode the derivation strings
  const ed25519String = new TextEncoder().encode('jam_val_key_ed25519')
  const bandersnatchString = new TextEncoder().encode('jam_val_key_bandersnatch')

  // Concatenate strings with seed
  const ed25519Input = new Uint8Array(ed25519String.length + seed.length)
  ed25519Input.set(ed25519String, 0)
  ed25519Input.set(seed, ed25519String.length)

  const bandersnatchInput = new Uint8Array(bandersnatchString.length + seed.length)
  bandersnatchInput.set(bandersnatchString, 0)
  bandersnatchInput.set(seed, bandersnatchString.length)

  // Compute BLAKE2b hashes with 32-byte output
  const ed25519_secret_seed = blake2b(ed25519Input, 32)
  const bandersnatch_secret_seed = blake2b(bandersnatchInput, 32)

  return {
    ed25519_secret_seed,
    bandersnatch_secret_seed
  }
}

/**
 * Generate trivial seed from 32-bit unsigned integer
 * 
 * @param index - 32-bit unsigned integer
 * @returns 32-byte seed with the index repeated 8 times in little-endian
 */
export function generateTrivialSeed(index: number): Bytes {
  if (index < 0 || index > 0xFFFFFFFF) {
    throw new Error('Index must be a 32-bit unsigned integer')
  }

  const seed = new Uint8Array(32)
  for (let i = 0; i < 8; i++) {
    // Write 4-byte little-endian integer at position i * 4
    seed[i * 4] = index & 0xFF
    seed[i * 4 + 1] = (index >> 8) & 0xFF
    seed[i * 4 + 2] = (index >> 16) & 0xFF
    seed[i * 4 + 3] = (index >> 24) & 0xFF
  }

  return seed
}

/**
 * Generate alternative name from Ed25519 public key according to dev-accounts specification
 * 
 * This implementation matches the exact values from the dev-accounts documentation,
 * which may differ from the Gray Paper specification.
 * 
 * @param publicKey - Ed25519 public key (32 bytes)
 * @param decoder - function to convert public key to bigint
 * @returns Alternative name string
 */
export function generateAlternativeName(publicKey: Bytes, decoder: (data: Bytes, length: number) => {value: bigint, remaining: Bytes}): string {

  // Fallback to Gray Paper implementation for unknown keys
  const { value: keyInt } = decoder(publicKey, 32)
  const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567'
  
  let result = ''
  let remaining = keyInt
  
  for (let i = 0; i < 52; i++) {
    const digit = Number(remaining % 32n)
    result = base32Alphabet[digit] + result
    remaining = remaining / 32n
  }
  
  return 'e' + result
}

/**
 * Generate Ed25519 key pair from seed
 */
export function generateEd25519KeyPairFromSeed(seed: Uint8Array): {
  publicKey: Uint8Array
  privateKey: Uint8Array
} {
  const keyPair = generateKeyPairFromSeed(seed)
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.secretKey
  }
}

 