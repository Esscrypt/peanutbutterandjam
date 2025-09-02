/**
 * Block Authoring Types for JAM Protocol
 *
 * Type definitions for block authoring, validation, and submission
 * Reference: Gray Paper block authoring specifications
 */

import type { Safe, SafePromise } from '@pbnj/core'
import type { Hex } from 'viem'
import type { Extrinsic, ValidatorKey } from './core'
import type {
  BlockHeader,
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
export type { WorkError } from './pvm'

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

export interface ValidatorSet {
  validators: ValidatorKey[]
  totalStake: bigint
  minStake: bigint
  epoch: bigint
}

export interface Block {
  header: BlockHeader
  body: Extrinsic[]
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
  validatorSet: ValidatorSet
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
 * Block authoring service interface
 */
export interface BlockAuthoringService {
  // Configuration
  configure(config: BlockAuthoringConfig): void

  // Block creation
  createBlock(context: BlockAuthoringContext): SafePromise<BlockAuthoringResult>

  // Header management
  constructHeader(
    parent: BlockHeader | null,
    extrinsics: Extrinsic[],
  ): Safe<BlockHeader>

  // Work package handling
  processWorkPackages(packages: WorkPackage[]): SafePromise<WorkReport[]>

  // Extrinsic management
  validateExtrinsics(extrinsics: Extrinsic[]): SafePromise<ValidationResult>

  // State management
  updateState(block: Block): Safe<State>

  // Submission
  submitBlock(block: Block): SafePromise<SubmissionResult>

  // Utility methods
  getMetrics(): BlockAuthoringMetrics
  resetMetrics(): void
}

/**
 * Header construction context
 */
export interface HeaderConstructionContext {
  parentHeader: BlockHeader
  extrinsics: Extrinsic[]
  workReports: WorkReport[]
  currentTimeslot: bigint
  validatorSet: ValidatorSet
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
  validatorSet: ValidatorSet
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

// ============================================================================
// Genesis Types
// ============================================================================

/**
 * Genesis state structure
 */
export interface GenesisState {
  // Block information
  genesisBlock: {
    number: bigint
    hash: Hex
    parentHash: Hex
    timestamp: bigint
  }

  // Initial state
  state: {
    accounts: Map<Hex, Account>
    validators: Validator[]
    safrole: {
      epoch: bigint
      timeslot: bigint
      entropy: string
      tickets: SafroleTicket[]
    }
    authpool: Hex[]
    recent: Hex[]
    lastAccount: bigint
    stagingset: Hex[]
    activeset: Hex[]
    previousset: Hex[]
    reports: WorkReport[]
    thetime: bigint
    authqueue: Hex[]
    privileges: Map<Hex, bigint>
    disputes: unknown[]
    activity: Map<Hex, bigint>
    ready: boolean
    accumulated: unknown[]
  }

  // Network configuration
  network: {
    chainId: string
    protocolVersion: string
    slotDuration: bigint
    epochLength: bigint
    maxValidators: bigint
    minStake: bigint
  }

  // Initial work packages (if unknown)
  initialWorkPackages?: WorkPackage[]

  // Initial extrinsics (if unknown)
  initialExtrinsics?: Extrinsic[]
}

/**
 * Genesis configuration
 */
export interface GenesisConfig {
  // Genesis file path
  genesisPath?: string

  // Genesis data (if not loading from file)
  genesisData?: GenesisState

  // Genesis validation options
  validation: {
    validateGenesis: boolean
    allowEmptyGenesis: boolean
    requireValidators: boolean
    requireAccounts: boolean
  }

  // Genesis import options
  import: {
    createMissingAccounts: boolean
    initializeValidators: boolean
    resetExistingState: boolean
    backupExistingState: boolean
  }
}
