/**
 * Erasure Coding Types for JAM Protocol
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
export interface ErasureCodingValidationResult {
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
  validate(encodedData: EncodedData): ErasureCodingValidationResult
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

// ============================================================================
// Algorithm-specific types
// ============================================================================

/**
 * Finite field operations interface
 */
export interface FiniteField {
  /** Add two field elements */
  add(a: FieldElement, b: FieldElement): FieldElement
  /** Multiply two field elements */
  multiply(a: FieldElement, b: FieldElement): FieldElement
  /** Divide two field elements */
  divide(a: FieldElement, b: FieldElement): FieldElement
  /** Get multiplicative inverse */
  inverse(a: FieldElement): FieldElement
  /** Exponentiate field element */
  power(a: FieldElement, exponent: number): FieldElement
  /** Get field generator */
  getGenerator(): FieldElement
  /** Get field size */
  getSize(): number
}

/**
 * Polynomial operations interface
 */
export interface PolynomialOperations {
  /** Add two polynomials */
  add(a: Polynomial, b: Polynomial): Polynomial
  /** Multiply two polynomials */
  multiply(a: Polynomial, b: Polynomial): Polynomial
  /** Divide two polynomials */
  divide(
    a: Polynomial,
    b: Polynomial,
  ): { quotient: Polynomial; remainder: Polynomial }
  /** Evaluate polynomial at point */
  evaluate(poly: Polynomial, x: FieldElement): FieldElement
  /** Interpolate polynomial from points */
  interpolate(points: Array<{ x: FieldElement; y: FieldElement }>): Polynomial
  /** Get polynomial degree */
  degree(poly: Polynomial): number
}

/**
 * Reed-Solomon algorithm interface
 */
export interface ReedSolomonAlgorithm {
  /** Encode data using Reed-Solomon */
  encode(data: FieldElement[], k: number, n: number): FieldElement[]
  /** Decode data using Reed-Solomon */
  decode(encodedData: FieldElement[], k: number, n: number): FieldElement[]
  /** Generate encoding matrix */
  generateEncodingMatrix(k: number, n: number): FieldElement[][]
  /** Generate decoding matrix */
  generateDecodingMatrix(receivedIndices: number[], k: number): FieldElement[][]
}

/**
 * Algorithm configuration
 */
export interface AlgorithmConfig {
  /** Finite field implementation */
  field: FiniteField
  /** Polynomial operations implementation */
  polynomial: PolynomialOperations
  /** Reed-Solomon algorithm implementation */
  reedSolomon: ReedSolomonAlgorithm
}

/**
 * Cantor basis for GF(2^16) as specified in Gray Paper
 */
export const CANTOR_BASIS: FieldElement[] = [
  0x0001, // v_0 = 1
  0x8b5a, // v_1 = α^15 + α^13 + α^11 + α^10 + α^7 + α^6 + α^3 + α
  0x4c6e, // v_2 = α^13 + α^12 + α^11 + α^10 + α^3 + α^2 + α
  0x5a7b, // v_3 = α^12 + α^10 + α^9 + α^5 + α^4 + α^3 + α^2 + α
  0xc3a1, // v_4 = α^15 + α^14 + α^10 + α^8 + α^7 + α
  0xe7d5, // v_5 = α^15 + α^14 + α^13 + α^11 + α^10 + α^8 + α^5 + α^3 + α^2 + α
  0x9c46, // v_6 = α^15 + α^12 + α^8 + α^6 + α^3 + α^2
  0x5011, // v_7 = α^14 + α^4 + α
  0x6e7b, // v_8 = α^14 + α^13 + α^11 + α^10 + α^7 + α^4 + α^3
  0x4c74, // v_9 = α^12 + α^7 + α^6 + α^4 + α^3
  0x6e5a, // v_10 = α^14 + α^13 + α^11 + α^9 + α^6 + α^5 + α^4 + α
  0x9e08, // v_11 = α^15 + α^13 + α^12 + α^11 + α^8
  0xfe7a, // v_12 = α^15 + α^14 + α^13 + α^12 + α^11 + α^10 + α^8 + α^7 + α^5 + α^4 + α^3
  0xfe54, // v_13 = α^15 + α^14 + α^13 + α^12 + α^11 + α^9 + α^8 + α^5 + α^4 + α^2
  0xfe7a, // v_14 = α^15 + α^14 + α^13 + α^12 + α^11 + α^10 + α^9 + α^8 + α^5 + α^4 + α^3
  0x9c8e, // v_15 = α^15 + α^12 + α^11 + α^8 + α^4 + α^3 + α^2 + α
]

/**
 * Irreducible polynomial for GF(2^16) as specified in Gray Paper
 * x^16 + x^5 + x^3 + x^2 + 1
 */
export const IRREDUCIBLE_POLYNOMIAL = 0x1002d

/**
 * Field generator α (root of irreducible polynomial)
 */
export const FIELD_GENERATOR = 0x0002
