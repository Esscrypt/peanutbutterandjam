/**
 * Erasure Coding Package for JAM Protocol
 *
 * This package provides JAM-compliant erasure coding functionality using
 * a native Rust implementation with reed-solomon-simd for optimal performance.
 */

// Export types from shared types package
export type {
  EncodedData,
  ErasureCoder,
  ErasureCodingParams,
  FieldElement,
  Polynomial,
} from '@pbnjam/types'
// Export constants from shared types package
export {
  BLOB_ERASURE_CODING_PARAMS,
  CANTOR_BASIS,
  DEFAULT_ERASURE_CODING_PARAMS,
  FIELD_GENERATOR,
  IRREDUCIBLE_POLYNOMIAL,
  SEGMENT_ERASURE_CODING_PARAMS,
} from '@pbnjam/types'
// Export Rust implementation
export {
  isRustModuleAvailable,
  RustReedSolomonCoder,
} from './rust-wrapper'

// Default export - create Rust Reed-Solomon coder
import { RustReedSolomonCoder } from './rust-wrapper'
export default RustReedSolomonCoder
