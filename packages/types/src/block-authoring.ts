/**
 * Block Authoring Types for JAM Protocol
 *
 * Type definitions for block authoring, validation, and submission
 * Reference: Gray Paper block authoring specifications
 */

import type { Hex } from 'viem'
import type { ValidatorKey } from './consensus'
import type { Extrinsic } from './core'
import type { BlockHeader } from './global-state'
import type {
  Assurance,
  Dispute,
  Guarantee,
  Preimage,
  SafroleTicket,
  WorkDigest,
  WorkItem,
  WorkPackage,
  WorkPackageContext,
  WorkReport,
} from './serialization'

// ============================================================================
// Work Package Types (re-exported from serialization to avoid duplication)
// ============================================================================

// Re-export unified types from serialization
export type {
  WorkReport,
  WorkPackageContext,
  WorkDigest,
  WorkPackage,
  WorkItem,
}

/**
 * Availability specification
 */
export interface AvailabilitySpec {
  packageHash: Hex
  bundleLength: bigint
  erasureRoot: Hex
  segmentRoot: Hex
  segmentCount: bigint
}

export interface State {
  blockNumber: bigint
  stateRoot: Hex
  timestamp: bigint
  validators: ValidatorKey[]
}

// Note: ValidatorSet removed - Gray Paper uses separate stagingset, activeset, previousset
// Use those from GlobalState instead of a unified ValidatorSet abstraction

export interface Block {
  header: BlockHeader
  body: BlockBody
}

export interface BlockBody {
  /** XT_tickets: Safrole consensus tickets for slot sealing randomness */
  tickets: SafroleTicket[]

  /** XT_preimages: Data blobs referenced by hash in work packages */
  preimages: Preimage[]

  /** XT_guarantees: Validator attestations for work report validity */
  guarantees: Guarantee[]

  /** XT_assurances: Validator attestations for data availability */
  assurances: Assurance[]

  /** XT_disputes: Challenge proofs for invalid work or validator misbehavior */
  disputes: Dispute[]
}

/**
 * Block authoring service configuration
 */
export interface BlockAuthoringConfig {
  // Network settings
  networkId: string
  validatorKey: string

  // Timing settings
  slotDuration: bigint // 6 seconds
  epochLength: bigint // 600 slots

  // Performance settings
  maxExtrinsicsPerBlock: bigint
  maxWorkPackagesPerBlock: bigint

  // Validation settings
  enableStrictValidation: boolean
  enableAuditMode: boolean

  // Consensus settings
  enableSafroleValidation: boolean
  enableGrandpaFinalization: boolean
}

/**
 * Context for block authoring operations
 */
export interface BlockAuthoringContext {
  // Parent block information
  parentHeader: BlockHeader
  parentState: State

  // Current timeslot
  currentTimeslot: bigint

  // Validator information
  validatorSet: ValidatorKey[]
  authorIndex: bigint

  // Available extrinsics and work packages
  extrinsics: Extrinsic[]
  workPackages: WorkPackage[]

  // Network state
  networkState: NetworkState
}

/**
 * Network state information
 */
export interface NetworkState {
  // Connected peers
  connectedPeers: bigint

  // Network latency
  averageLatency: bigint

  // Block propagation status
  propagationStatus: PropagationStatus

  // Finalization status
  finalizationStatus: FinalizationStatus
}

/**
 * Block propagation status
 */
export enum PropagationStatus {
  PENDING = 'pending',
  PROPAGATING = 'propagating',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

/**
 * Block finalization status
 */
export enum FinalizationStatus {
  UNFINALIZED = 'unfinalized',
  FINALIZING = 'finalizing',
  FINALIZED = 'finalized',
}

/**
 * Result of block authoring operation
 */
export interface BlockAuthoringResult {
  // Success status
  success: boolean

  // Created block (if successful)
  block?: Block

  // Error information (if failed)
  error?: BlockAuthoringError

  // Performance metrics
  metrics: BlockAuthoringMetrics
}

/**
 * Block authoring performance metrics
 */
export interface BlockAuthoringMetrics {
  // Timing information
  creationTime: bigint // milliseconds
  validationTime: bigint // milliseconds
  submissionTime: bigint // milliseconds

  // Resource usage
  memoryUsage: bigint // Uint8Array
  cpuUsage: bigint // percentage

  // Block statistics
  extrinsicCount: bigint
  workPackageCount: bigint
  blockSize: bigint // Uint8Array
}

/**
 * Block authoring error types
 */
export enum BlockAuthoringErrorType {
  // Validation errors
  INVALID_HEADER = 'invalid_header',
  INVALID_EXTRINSICS = 'invalid_extrinsics',
  INVALID_WORK_PACKAGES = 'invalid_work_packages',
  INVALID_STATE = 'invalid_state',

  // Consensus errors
  INVALID_TICKET = 'invalid_ticket',
  INVALID_SIGNATURE = 'invalid_signature',
  INVALID_TIMESLOT = 'invalid_timeslot',
  INVALID_AUTHOR = 'invalid_author',

  // Network errors
  NETWORK_ERROR = 'network_error',
  SUBMISSION_FAILED = 'submission_failed',
  PROPAGATION_FAILED = 'propagation_failed',

  // State errors
  STATE_TRANSITION_FAILED = 'state_transition_failed',
  STATE_VALIDATION_FAILED = 'state_validation_failed',

  // Timeout errors
  CREATION_TIMEOUT = 'creation_timeout',
  VALIDATION_TIMEOUT = 'validation_timeout',
  SUBMISSION_TIMEOUT = 'submission_timeout',
}

/**
 * Block authoring error
 */
export interface BlockAuthoringError {
  type: BlockAuthoringErrorType
  message: string
  details?: Record<string, unknown>
  recoverable: boolean
}

/**
 * Validation result for extrinsics
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string
  message: string
  extrinsicIndex?: bigint
  field?: string
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string
  message: string
  extrinsicIndex?: bigint
  field?: string
}

/**
 * Submission result
 */
export interface SubmissionResult {
  blockHash: Hex
  propagationStatus: PropagationStatus
}

/**
 * Header construction context
 */
export interface HeaderConstructionContext {
  parentHeader: BlockHeader
  extrinsics: Extrinsic[]
  workReports: WorkReport[]
  currentTimeslot: bigint
  validatorSet: ValidatorKey[]
  authorIndex: bigint
}

/**
 * Work package processing context
 */
export interface WorkPackageProcessingContext {
  packages: WorkPackage[]
  state: State
  gasLimit: bigint
  timeLimit: bigint // milliseconds
}

/**
 * State transition context
 */
export interface StateTransitionContext {
  previousState: State
  block: Block
  extrinsics: Extrinsic[]
  workReports: WorkReport[]
}

/**
 * Extrinsic validation context
 */
export interface ExtrinsicValidationContext {
  extrinsics: Extrinsic[]
  state: State
  blockHeader: BlockHeader
  validatorSet: ValidatorKey[]
}

/**
 * Block submission context
 */
export interface BlockSubmissionContext {
  block: Block
  networkState: NetworkState
  retryCount: bigint
  timeout: bigint // milliseconds
}

/**
 * Ticket validation result
 */
export interface TicketValidationResult {
  valid: boolean
  ticket?: SafroleTicket
  score?: bigint
  error?: string
}

/**
 * Signature validation result
 */
export interface SignatureValidationResult {
  valid: boolean
  signature?: Uint8Array
  publicKey?: Uint8Array
  error?: string
}

/**
 * Timeslot validation result
 */
export interface TimeslotValidationResult {
  valid: boolean
  currentTimeslot: bigint
  blockTimeslot: bigint
  error?: string
}

/**
 * Author validation result
 */
export interface AuthorValidationResult {
  valid: boolean
  authorIndex: bigint
  validatorKey: Uint8Array
  error?: string
}

// ============================================================================
// Account Types
// ============================================================================

/**
 * Account structure
 */
export interface Account {
  address: Hex
  balance: bigint
  nonce: bigint
  code?: Uint8Array
  storage?: Map<Hex, Hex>
  isValidator?: boolean
  validatorKey?: Hex
  stake?: bigint
}

export interface Validator {
  address: Hex
  publicKey: Hex
  stake: bigint
  isActive: boolean
}

// Note: Genesis types moved to @pbnj/types/genesis and @pbnj/types/genesis-config
// for Gray Paper compliance. Use those instead of non-compliant types.
