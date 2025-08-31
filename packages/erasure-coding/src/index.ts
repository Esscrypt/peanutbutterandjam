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
  ErasureCodingValidationResult,
  FieldElement,
  Polynomial,
} from '@pbnj/types'
// Export constants from shared types package
export {
  BLOB_ERASURE_CODING_PARAMS,
  CANTOR_BASIS,
  DEFAULT_ERASURE_CODING_PARAMS,
  FIELD_GENERATOR,
  SEGMENT_ERASURE_CODING_PARAMS,
} from '@pbnj/types'
// Reference TypeScript blob path
export {
  type ChunkWithIndex,
  type EncodedBlob,
  encodeBlobReference,
  recoverBlobReference,
} from './blob-reference'
// Layout utilities (H.3/H.4)
export { PIECE_BYTES, WORD_BYTES } from './config'
// Field operations
export {
  cantorToPoly,
  gfAdd,
  gfDivide,
  gfInverse,
  gfMultiply,
  gfPow,
  mapIndexToField,
  polyToCantor,
} from './gf16'
export {
  joinWordsLE,
  padBlobToPieceMultiple,
  splitWordsLE,
  transposeWords,
} from './layout'
// Reference TypeScript RS(1023,342) for single piece
export {
  encodePieceReference,
  type IndexedWord,
  recoverPieceReference,
} from './rs-reference'
// Export Rust implementation
export {
  createRustReedSolomonCoder,
  isRustModuleAvailable,
  RustReedSolomonCoder,
  testRustAgainstJAM,
} from './rust-wrapper'

// Default export - create Rust Reed-Solomon coder
import { createRustReedSolomonCoder } from './rust-wrapper'
export default createRustReedSolomonCoder
