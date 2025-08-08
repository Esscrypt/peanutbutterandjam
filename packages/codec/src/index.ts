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
// Core codec functionality
export { JAMCodec } from './core'

// Format-specific codecs
export { JsonCodec } from './formats/json'
export { BinaryCodec } from './formats/binary'
export { JamAsn1Codec, JamAsn1Decoder } from './formats/jam-asn1'
export { JamCodec, JamDecoder } from './formats/jam-codec'

// JAM-specific types
export type {
  JamValidatorKeys,
  JamEpochMark,
  JamHeader,
  JamBlock,
  JamCodecConfig
} from './formats/jam-codec'

// ASN.1 types
export type {
  Asn1TagClass,
  Asn1UniversalTag,
  Asn1LengthType,
  Asn1TLV
} from './formats/jam-asn1'

// Export utilities
export * from './utils'
