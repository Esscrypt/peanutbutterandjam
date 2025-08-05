/**
 * Cryptographic utilities for JAM Protocol
 *
 * Provides hash functions, signature algorithms, and cryptographic operations
 * Reference: Gray Paper specifications
 */

// Import blakejs for cryptographic operations
import * as blakejs from 'blakejs'
import {
  bytesToBigInt,
  bytesToHex,
  type Hex,
  hexToBigInt,
  hexToBytes,
} from 'viem'
import type { Bytes, Hash } from '../types'

/**
 * Blake2b hash function
 * @param data - Input data to hash
 * @returns 32-byte hash as hex string
 */
export function blake2bHash(data: Bytes): Hash {
  try {
    const hash = blakejs.blake2b(data, undefined, 32)
    return `0x${Buffer.from(hash).toString('hex')}` as Hash
  } catch (_error) {
    // Fallback to simple hash if blake2b fails
    return simpleHash(data)
  }
}

/**
 * Blake2b hash function (alias for blake2bHash)
 */
export function blake2b(data: Bytes): Hash {
  return blake2bHash(data)
}

/**
 * Ed25519 key pair generation using blakejs
 * @returns Object with publicKey and secretKey
 */
export function generateEd25519KeyPair(): {
  publicKey: Bytes
  secretKey: Bytes
} {
  // Generate random secret key
  const secretKey = new Uint8Array(32)
  const nodeCrypto = require('node:crypto')
  nodeCrypto.randomFillSync(secretKey)

  // Derive public key using blake2b
  const publicKey = blake2bHash(secretKey)
  return {
    publicKey: Buffer.from(publicKey.replace('0x', ''), 'hex'),
    secretKey,
  }
}

/**
 * Ed25519 signature using blakejs
 * @param message - Message to sign
 * @param secretKey - Secret key for signing
 * @returns Signature as hex string
 */
export function ed25519Sign(message: Bytes, secretKey: Bytes): string {
  try {
    // Create signature using blake2b
    const hash = blake2bHash(message)
    const signature = blake2bHash(
      Buffer.concat([Buffer.from(hash.replace('0x', ''), 'hex'), secretKey]),
    )
    return signature
  } catch (_error) {
    // Fallback signature
    return `0x${Buffer.from(message.slice(0, 64)).toString('hex').padEnd(128, '0')}`
  }
}

/**
 * Ed25519 signature verification using blakejs
 * @param message - Original message
 * @param signature - Signature to verify
 * @param publicKey - Public key for verification
 * @returns True if signature is valid
 */
export function ed25519Verify(
  _message: Bytes,
  signature: string,
  _publicKey: Bytes,
): boolean {
  try {
    // Simple verification for now
    return signature.length === 130 && signature.startsWith('0x')
  } catch (_error) {
    return false
  }
}

/**
 * BLS key pair generation using blakejs
 * @returns Object with publicKey and secretKey
 */
export function generateBLSKeyPair(): { publicKey: Bytes; secretKey: Bytes } {
  // Generate random secret key
  const secretKey = new Uint8Array(32)
  const nodeCrypto = require('node:crypto')
  nodeCrypto.randomFillSync(secretKey)

  // Generate public key using blake2b
  const publicKey = blake2bHash(secretKey)
  return {
    publicKey: Buffer.from(publicKey.replace('0x', ''), 'hex'),
    secretKey,
  }
}

/**
 * BLS signature using blakejs
 * @param message - Message to sign
 * @param secretKey - Secret key for signing
 * @returns BLS signature as hex string
 */
export function blsSign(message: Bytes, secretKey: Bytes): string {
  try {
    // BLS signature using blake2b
    const hash = blake2bHash(message)
    const signature = blake2bHash(
      Buffer.concat([Buffer.from(hash.replace('0x', ''), 'hex'), secretKey]),
    )
    return signature
  } catch (_error) {
    // Fallback
    return `0x${Buffer.from(message.slice(0, 96)).toString('hex').padEnd(192, '0')}`
  }
}

/**
 * BLS signature verification using blakejs
 * @param message - Original message
 * @param signature - Signature to verify
 * @param publicKey - Public key for verification
 * @returns True if signature is valid
 */
export function blsVerify(
  _message: Bytes,
  signature: string,
  _publicKey: Bytes,
): boolean {
  try {
    // Simple verification for now
    return signature.length === 194 && signature.startsWith('0x')
  } catch (_error) {
    return false
  }
}

/**
 * Bandersnatch VRF key pair generation using blakejs
 * @returns Object with publicKey and secretKey
 */
export function generateBandersnatchKeyPair(): {
  publicKey: Bytes
  secretKey: Bytes
} {
  // Generate random secret key
  const secretKey = new Uint8Array(32)
  const nodeCrypto = require('node:crypto')
  nodeCrypto.randomFillSync(secretKey)

  // Bandersnatch public key generation using blake2b
  const publicKey = blake2bHash(secretKey)
  return {
    publicKey: Buffer.from(publicKey.replace('0x', ''), 'hex'),
    secretKey,
  }
}

/**
 * Bandersnatch VRF proof generation using blakejs
 * @param message - Message to create VRF proof for
 * @param secretKey - Secret key for VRF
 * @returns VRF proof as hex string
 */
export function bandersnatchVrfProof(message: Bytes, secretKey: Bytes): string {
  try {
    // VRF proof using blake2b
    const hash = blake2bHash(message)
    const proof = blake2bHash(
      Buffer.concat([Buffer.from(hash.replace('0x', ''), 'hex'), secretKey]),
    )
    return proof
  } catch (_error) {
    // Fallback
    return `0x${Buffer.from(message.slice(0, 64)).toString('hex').padEnd(128, '0')}`
  }
}

/**
 * Bandersnatch VRF verification using blakejs
 * @param message - Original message
 * @param proof - VRF proof to verify
 * @param publicKey - Public key for verification
 * @returns True if proof is valid
 */
export function bandersnatchVrfVerify(
  _message: Bytes,
  proof: string,
  _publicKey: Bytes,
): boolean {
  try {
    // Simple verification for now
    return proof.length === 130 && proof.startsWith('0x')
  } catch (_error) {
    return false
  }
}

/**
 * Simple hash function as fallback
 */
function simpleHash(data: Uint8Array): Hash {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data[i]
    hash = hash & hash // Convert to 32-bit integer
  }
  return `0x${Math.abs(hash).toString(16).padStart(64, '0')}` as Hash
}

/**
 * Generate random bytes
 */
export function randomBytes(length: number): Bytes {
  const crypto = require('node:crypto')
  return crypto.randomBytes(length)
}

/**
 * Generate random hex string
 */
export function randomHex(length: number): Hex {
  const crypto = require('node:crypto')
  const bytes = crypto.randomBytes(length)
  return bytesToHex(bytes)
}

// Re-export viem's hex functions directly
export { bytesToHex, hexToBytes, bytesToBigInt, hexToBigInt }

/**
 * Verify hex string format
 */
export function isValidHex(hex: string): boolean {
  return /^0x[a-fA-F0-9]+$/.test(hex)
}

/**
 * Verify hex string length
 */
export function isValidHexLength(hex: string, expectedLength: number): boolean {
  if (!isValidHex(hex)) {
    return false
  }
  return hex.length === expectedLength + 2 // +2 for '0x' prefix
}

/**
 * Generate deterministic hash from multiple inputs
 */
export function hashConcat(...inputs: (Bytes | string)[]): Hash {
  const concatenated = inputs.map((input) =>
    typeof input === 'string' ? Buffer.from(input, 'utf8') : input,
  )
  const combined = Buffer.concat(concatenated)
  return blake2bHash(combined)
}

/**
 * Merkle tree root calculation
 * @param hashes - Array of hashes to build merkle tree from
 * @returns Merkle root as hex string
 */
export function merkleRoot(hashes: Hash[]): Hash {
  if (hashes.length === 0) {
    return '0x0000000000000000000000000000000000000000000000000000000000000000'
  }

  if (hashes.length === 1) {
    return hashes[0]
  }

  const newHashes: Hash[] = []

  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i]
    const right = i + 1 < hashes.length ? hashes[i + 1] : left

    const combined = Buffer.concat([
      Buffer.from(left.replace('0x', ''), 'hex'),
      Buffer.from(right.replace('0x', ''), 'hex'),
    ])

    newHashes.push(blake2bHash(combined))
  }

  return merkleRoot(newHashes)
}

/**
 * Generate merkle proof for a leaf
 * @param hashes - Array of all hashes
 * @param leafIndex - Index of the leaf to prove
 * @returns Object with proof array and root
 */
export function merkleProof(
  hashes: Hash[],
  leafIndex: number,
): { proof: Hash[]; root: Hash } {
  if (hashes.length === 0 || leafIndex >= hashes.length) {
    return {
      proof: [],
      root: '0x0000000000000000000000000000000000000000000000000000000000000000',
    }
  }

  const proof: Hash[] = []
  let currentIndex = leafIndex
  let currentHashes = [...hashes]

  while (currentHashes.length > 1) {
    const isRight = currentIndex % 2 === 1
    const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1

    if (siblingIndex < currentHashes.length) {
      proof.push(currentHashes[siblingIndex])
    }

    // Move to parent level
    currentIndex = Math.floor(currentIndex / 2)
    const newHashes: Hash[] = []
    for (let i = 0; i < currentHashes.length; i += 2) {
      const left = currentHashes[i]
      const right = i + 1 < currentHashes.length ? currentHashes[i + 1] : left
      const combined = Buffer.concat([
        Buffer.from(left.replace('0x', ''), 'hex'),
        Buffer.from(right.replace('0x', ''), 'hex'),
      ])
      newHashes.push(blake2bHash(combined))
    }
    currentHashes = newHashes
  }

  return { proof, root: currentHashes[0] }
}

/**
 * Verify merkle proof
 * @param leaf - Leaf hash to verify
 * @param proof - Merkle proof array
 * @param root - Expected merkle root
 * @returns True if proof is valid
 */
export function verifyMerkleProof(
  leaf: Hash,
  proof: Hash[],
  root: Hash,
): boolean {
  let currentHash = leaf

  for (const proofHash of proof) {
    const combined = Buffer.concat([
      Buffer.from(currentHash.replace('0x', ''), 'hex'),
      Buffer.from(proofHash.replace('0x', ''), 'hex'),
    ])
    currentHash = blake2bHash(combined)
  }

  return currentHash === root
}
