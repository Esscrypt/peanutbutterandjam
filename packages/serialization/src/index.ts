/**
 * Gray Paper Serialization Package
 *
 * Implements Gray Paper-compliant serialization functions from Appendix D
 * Reference: Gray Paper serialization specifications
 */

// Re-export specific types from centralized types package to avoid conflicts
export type {
  BlockHeader as CoreBlockHeader,
  Bytes,
  Extrinsic,
  GRAY_PAPER_CONSTANTS,
  Hash,
  Natural,
  Result,
  SerializationResult,
  ValidatorKey,
} from '@pbnj/types'
export * from './block/body'
// Block serialization
export * from './block/header'
export * from './core/discriminator'
export * from './core/fixed-length'
// Core serialization functions
export * from './core/natural-number'
export * from './core/sequence'
// Work package serialization
export * from './work-package/context'
