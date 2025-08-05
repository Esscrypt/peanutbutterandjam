/**
 * Common Types for JAM Protocol
 *
 * Shared types used across all packages
 * Reference: Gray Paper specifications
 */

import type { Hex } from 'viem'

/**
 * Hash type - 32-byte hash
 */
export type Hash = Hex

/**
 * Block header structure
 */
export interface BlockHeader {
  /** Block number */
  number: number
  /** Parent block hash */
  parentHash: Hash
  /** State root hash */
  stateRoot: Hash
  /** Extrinsics root hash */
  extrinsicsRoot: Hash
  /** Block timestamp */
  timestamp: number
  /** Block author */
  author: string
  /** Block signature */
  signature: string
}

/**
 * Block structure
 */
export interface Block {
  /** Block header */
  header: BlockHeader
  /** Block body (extrinsics) */
  body: Extrinsic[]
}

/**
 * Extrinsic (transaction) structure
 */
export interface Extrinsic {
  /** Extrinsic ID */
  id: string
  /** Extrinsic data */
  data: Uint8Array
  /** Extrinsic signature */
  signature: string
  /** Extrinsic author */
  author: string
}

/**
 * Validator information
 */
export interface Validator {
  /** Validator ID */
  id: string
  /** Validator public key */
  publicKey: string
  /** Validator stake */
  stake: bigint
  /** Validator commission */
  commission: number
}

/**
 * Network peer information
 */
export interface Peer {
  /** Peer ID */
  id: string
  /** Peer address */
  address: string
  /** Peer port */
  port: number
  /** Peer protocol version */
  protocolVersion: string
  /** Peer capabilities */
  capabilities: string[]
}

/**
 * Error types
 */
export interface ProtocolError {
  /** Error code */
  code: number
  /** Error message */
  message: string
  /** Error context */
  context?: Record<string, unknown>
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = ProtocolError> =
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Optional type
 */
export type Optional<T> = T | null | undefined

/**
 * Bytes type
 */
export type Bytes = Uint8Array

/**
 * Hex string type - use viem's Hex type
 */
export type HexString = Hex

/**
 * Timestamp type
 */
export type Timestamp = number

/**
 * Slot number type
 */
export type SlotNumber = number

/**
 * Epoch number type
 */
export type EpochNumber = number

// ============================================================================
// Additional Common Types for Centralization
// ============================================================================

/**
 * Natural number type (0 to 2^64-1)
 */
export type Natural = bigint

/**
 * Octet sequence (byte array) - alias for Bytes
 */
export type OctetSequence = Bytes

/**
 * Variable-length octet sequence
 */
export type VariableOctetSequence = OctetSequence

/**
 * Fixed-length octet sequence
 */
export type FixedOctetSequence = OctetSequence

/**
 * Bit sequence
 */
export type BitSequence = Uint8Array

/**
 * Hash value (32 bytes) - alias for Hash
 */
export type HashValue = Hash

/**
 * Tuple type
 */
export type Tuple<T extends readonly unknown[]> = readonly [...T]

/**
 * Sequence type
 */
export type Sequence<T> = T[]

/**
 * Dictionary type
 */
export type Dictionary<K, V> = Map<K, V>

/**
 * Set type
 */
export type Set<T> = globalThis.Set<T>

/**
 * Serialization result
 */
export interface SerializationResult {
  data: OctetSequence
  length: number
}

/**
 * Deserialization result
 */
export interface DeserializationResult<T> {
  value: T
  remaining: OctetSequence
}

/**
 * Serialization error
 */
export interface SerializationError {
  message: string
  position?: number
  expected?: string
  actual?: string
}

/**
 * Serialization context for tracking position and errors
 */
export interface SerializationContext {
  position: number
  errors: SerializationError[]
}

/**
 * Deserialization context for tracking position and errors
 */
export interface DeserializationContext {
  position: number
  errors: SerializationError[]
  data: OctetSequence
}

/**
 * Supported fixed-length sizes
 */
export type FixedLengthSize = 1 | 2 | 4 | 8

/**
 * Gray Paper serialization constants
 */
export const GRAY_PAPER_CONSTANTS = {
  /** Maximum natural number value (2^64 - 1) */
  MAX_NATURAL: 2n ** 64n - 1n,
  /** Maximum 32-bit value */
  MAX_UINT32: 2n ** 32n - 1n,
  /** Maximum 16-bit value */
  MAX_UINT16: 2n ** 16n - 1n,
  /** Maximum 8-bit value */
  MAX_UINT8: 2n ** 8n - 1n,
  /** Maximum variable-length encoding (9 bytes) */
  MAX_VARIABLE_LENGTH: 9,
  /** Minimum variable-length encoding (1 byte) */
  MIN_VARIABLE_LENGTH: 1,
} as const

/**
 * Encoder function type
 */
export type Encoder<T> = (value: T) => OctetSequence

/**
 * Decoder function type
 */
export type Decoder<T> = (data: OctetSequence) => DeserializationResult<T>

/**
 * Optional encoder function type
 */
export type OptionalEncoder<T> = (value: T) => OctetSequence

/**
 * Optional decoder function type
 */
export type OptionalDecoder<T> = (
  data: OctetSequence,
) => DeserializationResult<T>
