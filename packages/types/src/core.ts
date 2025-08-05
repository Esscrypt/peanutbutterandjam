/**
 * Core Types for JAM Protocol
 *
 * Fundamental types used throughout the JAM protocol implementation
 * Reference: Gray Paper core specifications
 */

// Basic type aliases
export type Bytes = Uint8Array
export type Hash = string
export type Natural = bigint
export type OctetSequence = number[]
export type VariableOctetSequence = number[]
export type FixedOctetSequence = number[]
export type BitSequence = boolean[]
export type HashValue = string
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

export interface FixedLengthSize {
  size: number
  isFixed: true
}

export interface Encoder<T> {
  encode(data: T): SerializationResult
}

export interface Decoder<_T> {
  decode(data: Uint8Array): DeserializationResult
}

export interface OptionalEncoder<T> {
  encode(data: T | null): SerializationResult
}

export interface OptionalDecoder<_T> {
  decode(data: Uint8Array): DeserializationResult
}

// Block types
export interface BlockHeader {
  number: number
  parentHash: Hash
  timestamp: number
  author: string
  stateRoot: Hash
  extrinsicsRoot: Hash
  digest: string[]
}

export interface Extrinsic {
  hash: Hash
  data: Bytes
  signature?: Bytes
}

// Validator types
export interface ValidatorKey {
  publicKey: Bytes
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
