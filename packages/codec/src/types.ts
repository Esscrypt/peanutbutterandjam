/**
 * Codec Types and Interfaces
 *
 * Core types for data encoding and decoding in the JAM protocol
 */

// import { logger } from '@pbnj/core' // Removed

/**
 * Supported encoding formats
 */
export enum EncodingFormat {
  BINARY = 'BINARY',
  JSON = 'JSON',
  ASN1 = 'ASN1',
}

/**
 * Validation result for codec operations
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Core codec interface for encoding and decoding data
 */
export interface Codec<T> {
  encode(data: T, format: EncodingFormat): Uint8Array
  decode(data: Uint8Array, format: EncodingFormat): T
  validate(data: T): ValidationResult
}

/**
 * Schema definition for data validation
 */
export interface Schema<T> {
  name: string
  version: string
  validate(data: unknown): ValidationResult
  encode(data: T, format: EncodingFormat): Uint8Array
  decode(data: Uint8Array, format: EncodingFormat): T
}

/**
 * Block header structure
 */
export interface BlockHeader {
  /** Block number */
  number: number
  /** Parent block hash */
  parentHash: string
  /** Block timestamp */
  timestamp: number
  /** Block author */
  author: string
  /** Block state root */
  stateRoot: string
  /** Block extrinsics root */
  extrinsicsRoot: string
  /** Block digest */
  digest: string[]
}

/**
 * Block body structure
 */
export interface BlockBody {
  /** Block extrinsics */
  extrinsics: Uint8Array[]
}

/**
 * Complete block structure
 */
export interface Block {
  /** Block header */
  header: BlockHeader
  /** Block body */
  body: BlockBody
}

/**
 * Transaction structure
 */
export interface Transaction {
  /** Transaction hash */
  hash: string
  /** Transaction sender */
  sender: string
  /** Transaction recipient */
  recipient: string
  /** Transaction amount */
  amount: bigint
  /** Transaction nonce */
  nonce: number
  /** Transaction signature */
  signature: string
  /** Transaction data */
  data: Uint8Array
}

/**
 * Network message structure
 */
export interface NetworkMessage {
  /** Message type */
  type: string
  /** Message payload */
  payload: Uint8Array
  /** Message timestamp */
  timestamp: number
  /** Message signature */
  signature?: string
}

/**
 * State structure
 */
export interface State {
  /** State version */
  version: number
  /** State data */
  data: Record<string, unknown>
  /** State metadata */
  metadata: Record<string, unknown>
}

/**
 * Codec error types
 */
export enum CodecError {
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  ENCODING_ERROR = 'ENCODING_ERROR',
  DECODING_ERROR = 'DECODING_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Codec error with context
 */
export interface CodecErrorWithContext {
  error: CodecError
  message: string
  context?: Record<string, unknown>
}

/**
 * Codec configuration
 */
export interface CodecConfig {
  /** Default encoding format */
  defaultFormat: EncodingFormat
  /** Enable validation */
  enableValidation: boolean
  /** Enable compression */
  enableCompression: boolean
  /** Maximum data size */
  maxDataSize: number
  /** Timeout for operations */
  timeout: number
}

/**
 * Default codec configuration
 */
export const DEFAULT_CODEC_CONFIG: CodecConfig = {
  defaultFormat: EncodingFormat.BINARY,
  enableValidation: true,
  enableCompression: false,
  maxDataSize: 1024 * 1024 * 10, // 10MB
  timeout: 5000, // 5 seconds
}
