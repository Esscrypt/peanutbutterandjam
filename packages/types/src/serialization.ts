/**
 * Serialization Types for JAM Protocol
 *
 * Type definitions for serialization functions and data structures
 * Reference: Gray Paper Appendix D - Serialization
 */

import type {
  BitSequence,
  Decoder,
  DeserializationContext,
  DeserializationResult,
  Dictionary,
  Encoder,
  FixedLengthSize,
  FixedOctetSequence,
  HashValue,
  Natural,
  OctetSequence,
  Optional,
  OptionalDecoder,
  OptionalEncoder,
  Sequence,
  SerializationContext,
  SerializationError,
  SerializationResult,
  Tuple,
  VariableOctetSequence,
} from './core'

// Re-export common types from core
export type {
  Natural,
  OctetSequence,
  VariableOctetSequence,
  FixedOctetSequence,
  BitSequence,
  HashValue,
  Optional,
  Tuple,
  Sequence,
  Dictionary,
  SerializationResult,
  DeserializationResult,
  SerializationError,
  SerializationContext,
  DeserializationContext,
  FixedLengthSize,
  Encoder,
  Decoder,
  OptionalEncoder,
  OptionalDecoder,
}

// Re-export constants
export { GRAY_PAPER_CONSTANTS } from './core'
