/**
 * Core Types for Gray Paper Serialization
 *
 * Type definitions for serialization functions and data structures
 * Reference: Gray Paper Appendix D - Serialization
 */

// Re-export all types from the centralized types package
export type {
  // Basic types
  Natural,
  Uint8Array,
  VariableUint8Array,
  FixedUint8Array,
  BitSequence,
  HashValue,
  Optional,
  Tuple,
  Sequence,
  Dictionary,
  
  // Serialization types
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
  
  // Block types
  BlockHeader,
  BlockBody,
  
  // State types
  SafroleTicket,
  SafroleState,
  Dispute,
  WorkReport,
  Privileges,
  ActivityStats,
  ReadyItem,
  AccumulatedItem,
  LastAccountOut,
  ServiceAccount,
  GenesisState,
  StateTrieEntry,
  StateTrie,
} from '@pbnj/types'

// Work package types specific to serialization
export interface WorkItem {
  serviceIndex: Natural
  codeHash: HashValue
  refGasLimit: Natural
  accGasLimit: Natural
  exportCount: Natural
  payload: Uint8Array
  importSegments: any[] // TODO: Define proper type
  extrinsics: ExtrinsicReference[]
}

export interface ExtrinsicReference {
  hash: HashValue
  index: Natural
}

export interface WorkPackage {
  authCodeHost: Natural
  authCodeHash: HashValue
  context: any // TODO: Define proper type
  authToken: Uint8Array
  authConfig: Uint8Array
  workItems: WorkItem[]
}

// Re-export constants
export { GRAY_PAPER_CONSTANTS } from '@pbnj/core'