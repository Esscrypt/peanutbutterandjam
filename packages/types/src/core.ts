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

// Serialization types
export interface SerializationResult {
  success: boolean
  data?: Uint8Array
  error?: string
}

export interface DeserializationResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface SerializationError {
  code: string
  message: string
  context?: Record<string, unknown>
}

export interface SerializationContext {
  format: string
  version: string
  options?: Record<string, unknown>
}

export interface DeserializationContext {
  format: string
  version: string
  options?: Record<string, unknown>
}

export type FixedLengthSize = 1n | 2n | 4n | 8n | 16n | 32n

export type Encoder<T> = (data: T) => Safe<Uint8Array>

export type Decoder<T> = (data: Uint8Array) => Safe<{
  value: T
  remaining: Uint8Array
}>

export interface OptionalEncoder<T> {
  encode(data: T | null): SerializationResult
}

export interface OptionalDecoder<_T> {
  decode(data: Uint8Array): DeserializationResult
}

// Block types
export interface BlockHeader {
  number: bigint
  parentHash: Hex
  timestamp: bigint
  author: string
  stateRoot: Hex
  extrinsicsRoot: Hex
  digest: string[]
}

export interface Extrinsic {
  hash: Hex
  data: Uint8Array
  signature?: Uint8Array
}

// Validator types
export interface ValidatorKey {
  publicKey: Uint8Array
  address: string
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
  SLOT_DURATION: 6000, // 6 seconds in milliseconds
  EPOCH_LENGTH: 600, // 600 slots
} as const
