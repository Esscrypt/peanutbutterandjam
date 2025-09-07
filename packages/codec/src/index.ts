/**
 * JAM Protocol Codec Package
 *
 * Encoding and decoding utilities for various formats
 * Reference: Gray Paper codec specifications
 */

// Re-export specific types from centralized types package to avoid conflicts
export type {
  Block,
  BlockBody,
  BlockHeader,
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
export { BinaryCodec } from './formats/binary'
// ASN.1 types
export type {
  Asn1LengthType,
  Asn1TagClass,
  Asn1TLV,
  Asn1UniversalTag,
} from './formats/jam-asn1'
export { JamAsn1Codec, JamAsn1Decoder } from './formats/jam-asn1'
// JAM-specific types
export type {
  JamBlock,
  JamCodecConfig,
  JamValidatorKeys,
} from './formats/jam-codec'
export { JamCodec, JamDecoder } from './formats/jam-codec'
// Format-specific codecs
export { JsonCodec } from './formats/json'

// Export utilities
export * from './utils'
