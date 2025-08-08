/**
 * Centralized Type Definitions for JAM Protocol
 *
 * This package contains all type definitions used across the JAM protocol
 * implementation. It serves as a single source of truth for all interfaces,
 * types, and enums used throughout the codebase.
 */

// Block authoring types - export specific types to avoid conflicts
export type {
  Account,
  AuthorValidationResult,
  AvailabilitySpec,
  Block as BlockAuthoringBlock,
  BlockAuthoringConfig,
  BlockAuthoringContext,
  BlockAuthoringError,
  BlockAuthoringErrorType,
  BlockAuthoringMetrics,
  BlockAuthoringResult,
  BlockAuthoringService,
  BlockSubmissionContext,
  ExtrinsicValidationContext,
  FinalizationStatus,
  GenesisConfig,
  GenesisState,
  HeaderConstructionContext,
  NetworkState,
  PropagationStatus,
  SignatureValidationResult,
  State as BlockAuthoringState,
  StateTransitionContext,
  SubmissionResult,
  TicketValidationResult,
  Timeslot,
  TimeslotValidationResult,
  ValidationError,
  ValidationResult as BlockAuthoringValidationResult,
  ValidationWarning,
  Validator,
  ValidatorSet,
  WorkDigest,
  WorkError as BlockAuthoringWorkError,
  WorkItem as BlockAuthoringWorkItem,
  WorkPackage as BlockAuthoringWorkPackage,
  WorkPackageContext,
  WorkPackageProcessingContext,
  WorkReport,
} from './block-authoring'
// CLI types
export * from './cli'
// Codec types - export specific types to avoid conflicts
export type {
  Block as CodecBlock,
  BlockBody,
  BlockHeader as CodecBlockHeader,
  Codec,
  CodecConfig,
  CodecErrorWithContext,
  NetworkMessage as CodecNetworkMessage,
  Schema,
  State as CodecState,
  Transaction,
  ValidationResult as CodecValidationResult,
  // Format-specific types
  FormatCodec,
  BaseConfig,
  BinaryConfig,
  JsonConfig,
  Asn1Config,
  BinaryData,
  JsonData,
  Asn1Data,
} from './codec'
export {
  CodecError,
  DEFAULT_CODEC_CONFIG,
  EncodingFormat,
} from './codec'
// Consensus types
export * from './consensus'
// Core types
export * from './core'
// Erasure coding types
export * from './erasure-coding'
// Network types
export * from './network'
// JAMNP-S types
export * from './jamnp'
// PVM types
export * from './pvm'
// Serialization types - export specific types to avoid conflicts
export type {
  BlockHeader as SerializationBlockHeader,
  BlockBody as SerializationBlockBody,
  WorkItem as SerializationWorkItem,
  WorkPackage as SerializationWorkPackage,
  ExtrinsicReference as SerializationExtrinsicReference,
  SafroleTicket,
  SafroleState,
  Dispute,
  WorkReport as SerializationWorkReport,
  Privileges,
  ActivityStats,
  ReadyItem,
  AccumulatedItem,
  LastAccountOut,
  ServiceAccount,
  GenesisState as SerializationGenesisState,
  StateTrieEntry,
  StateTrie,
  ValidatorKeyTuple,
  EpochMark,
  SafroleTicketSingle,
  SafroleTicketArray,
} from './serialization'
export {
  isTicketsMarkArray,
  isTicketsMarkSingle,
} from './serialization'
// State types
export * from './state'
// VRF types
export * from './vrf'
