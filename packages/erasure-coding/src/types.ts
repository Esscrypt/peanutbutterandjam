/**
 * Erasure Coding Types
 *
 * Core types for erasure coding implementation based on Gray Paper specifications
 */

/**
 * Erasure coding parameters
 */
export interface ErasureCodingParams {
  /** Number of data words (k) - default 342 */
  k: number
  /** Total number of code words (n) - default 1023 */
  n: number
  /** Field size - default 2^16 */
  fieldSize: number
}

/**
 * Encoded data structure
 */
export interface EncodedData {
  /** Original data length */
  originalLength: number
  /** Number of data words */
  k: number
  /** Total number of code words */
  n: number
  /** Encoded shards/chunks */
  shards: Uint8Array[]
  /** Indices of the shards */
  indices: number[]
}

/**
 * Validation result for erasure coding operations
 */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean
  /** Validation errors */
  errors: string[]
  /** Validation warnings */
  warnings: string[]
}

/**
 * Core erasure coding interface
 */
export interface ErasureCoder {
  /** Encode data into erasure coded shards */
  encode(data: Uint8Array, k?: number, n?: number): EncodedData
  /** Decode data from erasure coded shards */
  decode(encodedData: EncodedData, k?: number): Uint8Array
  /** Validate encoded data */
  validate(encodedData: EncodedData): ValidationResult
}

/**
 * Erasure coding error types
 */
export enum ErasureCodingError {
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  ENCODING_ERROR = 'ENCODING_ERROR',
  DECODING_ERROR = 'DECODING_ERROR',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Erasure coding error with context
 */
export interface ErasureCodingErrorWithContext {
  error: ErasureCodingError
  message: string
  context?: Record<string, unknown>
}

/**
 * Finite field element (GF(2^16))
 */
export type FieldElement = number

/**
 * Polynomial coefficients
 */
export type Polynomial = FieldElement[]

/**
 * Reed-Solomon encoding parameters
 */
export interface ReedSolomonParams {
  /** Generator polynomial */
  generator: Polynomial
  /** Field generator */
  fieldGenerator: FieldElement
  /** Irreducible polynomial */
  irreducible: number
}

/**
 * Default erasure coding parameters based on Gray Paper
 */
export const DEFAULT_ERASURE_CODING_PARAMS: ErasureCodingParams = {
  k: 342,
  n: 1023,
  fieldSize: 65536, // 2^16
}

/**
 * Segment encoding parameters for Import DA system
 */
export const SEGMENT_ERASURE_CODING_PARAMS: ErasureCodingParams = {
  k: 6,
  n: 1023,
  fieldSize: 65536, // 2^16
}

/**
 * Blob encoding parameters for Audit DA system
 */
export const BLOB_ERASURE_CODING_PARAMS: ErasureCodingParams = {
  k: 342,
  n: 1023,
  fieldSize: 65536, // 2^16
}
