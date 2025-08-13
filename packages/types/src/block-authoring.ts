/**
 * Block Authoring Types for JAM Protocol
 *
 * Type definitions for block authoring, validation, and submission
 * Reference: Gray Paper block authoring specifications
 */

import type {
  Extrinsic,
  Hash,
  HashValue,
  HexString,
  ValidatorKey,
} from './core'
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
export { WorkError } from './serialization'

/**
 * Availability specification
 */
export interface AvailabilitySpec {
  packageHash: HashValue
  bundleLength: number
  erasureRoot: HashValue
  segmentRoot: HashValue
  segmentCount: number
}

export interface State {
  blockNumber: number
  stateRoot: Hash
  timestamp: number
  validators: ValidatorKey[]
}

export interface ValidatorSet {
  validators: ValidatorKey[]
  totalStake: bigint
  minStake: bigint
  epoch: number
}

export type Timeslot = number

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
  slotDuration: number // 6 seconds
  epochLength: number // 600 slots

  // Performance settings
  maxExtrinsicsPerBlock: number
  maxWorkPackagesPerBlock: number

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
  currentTimeslot: Timeslot

  // Validator information
  validatorSet: ValidatorSet
  authorIndex: number

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
  connectedPeers: number

  // Network latency
  averageLatency: number

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
  creationTime: number // milliseconds
  validationTime: number // milliseconds
  submissionTime: number // milliseconds

  // Resource usage
  memoryUsage: number // Uint8Array
  cpuUsage: number // percentage

  // Block statistics
  extrinsicCount: number
  workPackageCount: number
  blockSize: number // Uint8Array
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
  extrinsicIndex?: number
  field?: string
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string
  message: string
  extrinsicIndex?: number
  field?: string
}

/**
 * Submission result
 */
export interface SubmissionResult {
  success: boolean
  blockHash?: Hash
  error?: BlockAuthoringError
  propagationStatus: PropagationStatus
}

/**
 * Block authoring service interface
 */
export interface BlockAuthoringService {
  // Configuration
  configure(config: BlockAuthoringConfig): void

  // Block creation
  createBlock(context: BlockAuthoringContext): Promise<BlockAuthoringResult>

  // Header management
  constructHeader(
    parent: BlockHeader | null,
    extrinsics: Extrinsic[],
  ): Promise<BlockHeader>

  // Work package handling
  processWorkPackages(packages: WorkPackage[]): Promise<WorkReport[]>

  // Extrinsic management
  validateExtrinsics(extrinsics: Extrinsic[]): Promise<ValidationResult>

  // State management
  updateState(block: Block): Promise<State>

  // Submission
  submitBlock(block: Block): Promise<SubmissionResult>

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
  currentTimeslot: Timeslot
  validatorSet: ValidatorSet
  authorIndex: number
}

/**
 * Work package processing context
 */
export interface WorkPackageProcessingContext {
  packages: WorkPackage[]
  state: State
  gasLimit: bigint
  timeLimit: number // milliseconds
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
  retryCount: number
  timeout: number // milliseconds
}

/**
 * Ticket validation result
 */
export interface TicketValidationResult {
  valid: boolean
  ticket?: SafroleTicket
  score?: number
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
  currentTimeslot: Timeslot
  blockTimeslot: Timeslot
  error?: string
}

/**
 * Author validation result
 */
export interface AuthorValidationResult {
  valid: boolean
  authorIndex: number
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
  address: HexString
  balance: bigint
  nonce: number
  code?: Uint8Array
  storage?: Map<HexString, HexString>
  isValidator?: boolean
  validatorKey?: HexString
  stake?: bigint
}

export interface Validator {
  address: HexString
  publicKey: HexString
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
    number: number
    hash: HexString
    parentHash: HexString
    timestamp: number
  }

  // Initial state
  state: {
    accounts: Map<HexString, Account>
    validators: Validator[]
    safrole: {
      epoch: number
      timeslot: number
      entropy: string
      tickets: SafroleTicket[]
    }
    authpool: HexString[]
    recent: HexString[]
    lastAccount: number
    stagingset: HexString[]
    activeset: HexString[]
    previousset: HexString[]
    reports: WorkReport[]
    thetime: number
    authqueue: HexString[]
    privileges: Map<HexString, number>
    disputes: unknown[]
    activity: Map<HexString, number>
    ready: boolean
    accumulated: unknown[]
  }

  // Network configuration
  network: {
    chainId: string
    protocolVersion: string
    slotDuration: number
    epochLength: number
    maxValidators: number
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
