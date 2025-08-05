/**
 * Erasure Coding Package
 *
 * Main exports for the JAM protocol erasure coding implementation
 */

// Algorithm implementations
export {
  GF2_16,
  PolynomialOps,
  ReedSolomon,
} from './algorithms'

// Main erasure coding implementation
export { JAMErasureCoder } from './core'
// Core types and interfaces
export * from './types'
// Default configurations
export {
  BLOB_ERASURE_CODING_PARAMS,
  DEFAULT_ERASURE_CODING_PARAMS,
  SEGMENT_ERASURE_CODING_PARAMS,
} from './types'
// Validation implementations
export {
  DecodingValidation,
  EncodingValidation,
} from './validation'
