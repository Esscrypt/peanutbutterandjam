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
  // WorkItem is imported from serialization, not defined here
  WorkPackage as BlockAuthoringWorkPackage,
  WorkPackageContext,
  WorkPackageProcessingContext,
  WorkReport,
} from './block-authoring'
// CLI types
export * from './cli'
// Codec types - export specific types to avoid conflicts
export type {
  Asn1Config,
  Asn1Data,
  BaseConfig,
  BinaryConfig,
  BinaryData,
  Block as CodecBlock,
  BlockBody,
  BlockHeader as CodecBlockHeader,
  Codec,
  CodecConfig,
  CodecErrorWithContext,
  // Format-specific types
  FormatCodec,
  JsonConfig,
  JsonData,
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
// Consensus types - export ValidatorKey from consensus to avoid conflict
export type {
  ConsensusError,
  ConsensusErrorCode,
  ConsensusExtrinsic,
  ConsensusInput,
  ConsensusOutput,
  ConsensusState,
  ConsensusTicket,
  EpochMarker,
  SafroleError,
  SafroleInput,
  SafroleOutput,
  SafroleState as ConsensusSafroleState,
  Ticket,
  TicketProof,
  WinnerMarker,
} from './consensus'
export { SAFROLE_CONSTANTS, SafroleErrorCode } from './consensus'
// Core types - export ValidatorKey from core as CoreValidatorKey
export type {
  Address,
  Balance,
  BitSequence,
  BlockHeader,
  Bytes,
  Decoder,
  DeserializationContext,
  DeserializationResult,
  Dictionary,
  Encoder,
  Extrinsic,
  FixedLengthSize,
  FixedOctetSequence,
  Gas,
  Hash,
  HashValue,
  HexString,
  Natural,
  OctetSequence,
  Optional,
  OptionalDecoder,
  OptionalEncoder,
  PublicKey,
  Result,
  Sequence,
  SerializationContext,
  SerializationError,
  SerializationResult,
  ServiceId,
  Signature,
  Tuple,
  ValidatorKey as CoreValidatorKey,
  VariableOctetSequence,
} from './core'
// Erasure coding types
export * from './erasure-coding'
// JAMNP-S types
export * from './jamnp'
// Network types
export * from './network'
// Export PVM work types for compatibility
export type {
  ExportSegment as PVMExportSegment,
  ExtrinsicReference as PVMExtrinsicReference,
  ImportSegment as PVMImportSegment,
  IsAuthorizedResult,
  WorkContext as PVMWorkContext,
  WorkError,
  WorkItem as PVMWorkItem,
} from './pvm'
// PVM types
export * from './pvm'
// Serialization types - export specific types to avoid conflicts
export type {
  AccumulatedItem,
  ActivityStats,
  Assurance,
  Authorizer,
  AvailabilitySpecification,
  BlockBody as SerializationBlockBody,
  BlockHeader as SerializationBlockHeader,
  Credential,
  Dispute,
  EpochMark,
  ExtrinsicReference as SerializationExtrinsicReference,
  GenesisState as SerializationGenesisState,
  Guarantee,
  ImportSegment,
  JamHeader,
  Judgment,
  LastAccountOut,
  OperandTuple,
  Preimage,
  Privileges,
  ReadyItem,
  RuntimeWorkPackage,
  SafroleState as SerializationSafroleState,
  SafroleTicket,
  SafroleTicketArray,
  SafroleTicketCore,
  SafroleTicketHeader,
  SafroleTicketSingle,
  ServiceAccount,
  StateTrie,
  StateTrieEntry,
  ValidatorKeyPair,
  ValidatorKeyTuple,
  ValidityDispute,
  WorkContext,
  WorkError as SerializationWorkError,
  WorkItem as SerializationWorkItem,
  WorkPackage,
  WorkReport as SerializationWorkReport,
  WorkResult,
} from './serialization'
export {
  isTicketsMarkArray,
  isTicketsMarkSingle,
} from './serialization'
// State types
export * from './state'
// VRF types
export * from './vrf'
