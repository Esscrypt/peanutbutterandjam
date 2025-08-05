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
// Network types
export * from './network'
// PVM types
export * from './pvm'
// Serialization types
export * from './serialization'
// VRF types
export * from './vrf'
