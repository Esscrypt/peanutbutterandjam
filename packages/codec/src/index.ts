/**
 * JAM Protocol Codec Package
 *
 * Encoding and decoding utilities for various formats
 * Reference: Gray Paper codec specifications
 */

// Re-export specific types from centralized types package to avoid conflicts
export type {
  BlockBody,
  CodecBlock as Block,
  CodecBlockHeader as BlockHeader,
  CodecConfig,
  CodecErrorWithContext,
  CodecNetworkMessage as NetworkMessage,
  CodecState as State,
  CodecValidationResult as ValidationResult,
  Transaction,
} from '@pbnj/types'
// Re-export values (enums and constants) from centralized types package
export {
  CodecError,
  DEFAULT_CODEC_CONFIG,
  EncodingFormat,
} from '@pbnj/types'
// Export core codec functionality
export * from './core'
// Export format-specific codecs
export * from './formats'
// Export utilities
export * from './utils'

// Schema exports (to be implemented)
// export * from './schemas'
