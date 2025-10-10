import type { Safe } from '@pbnj/core'
import type { Hex } from 'viem'

/**
 * Core Types for JAM Protocol
 *
 * Fundamental types used throughout the JAM protocol implementation
 * Reference: Gray Paper core specifications
 */

// Basic type aliases

/**
 * Alternative name without display prefix
 * The raw base32-encoded value derived from Ed25519 public key
 */
export type AlternativeName = `e${string}`

/**
 * Alternative name formatted for display with $e prefix
 */
export type DisplayAlternativeName = `$e${string}`

export type Optional<T> = T | null
export type Tuple<T extends readonly unknown[]> = T
export type Sequence<T> = T[]
export type Dictionary<K extends string, V> = Record<K, V>

export type FixedLengthSize = 1n | 2n | 4n | 8n | 16n | 32n

export type Encoder<T> = (data: T) => Safe<Uint8Array>

export type Decoder<T> = (data: Uint8Array) => Safe<{
  value: T
  remaining: Uint8Array
}>

export interface Extrinsic {
  hash: Hex
  data: Uint8Array
  signature?: Uint8Array
}

export interface KeyPair {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

// Result type
export interface Result<T, E = Error> {
  success: boolean
  data?: T
  error?: E
}

// Constants
export const GRAY_PAPER_CONSTANTS = {
  MAX_BLOCK_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_EXTRINSICS_PER_BLOCK: 1000,
} as const
