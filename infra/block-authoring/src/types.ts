/**
 * Core types for Block Authoring Service
 *
 * Defines interfaces and types for block creation, validation, and submission
 * Reference: Gray Paper block authoring specifications
 */

import type {
  Bytes,
  BlockHeader as CoreBlockHeader,
  Extrinsic as CoreExtrinsic,
  Hash,
  ValidatorKey,
} from '@pbnj/core'

import type { Ticket as SafroleTicket } from '@pbnj/safrole'

// Define missing types that will be implemented
export interface WorkItem {
  serviceIndex: number
  codeHash: string
  payload: Bytes
  refGasLimit: number
  accGasLimit: number
  exportCount: number
  importSegments: [string, number][] // [hash, index] pairs
  extrinsics: [string, number][] // [hash, length] pairs
}

/**
 * Work package context
 */
export interface WorkPackageContext {
  lookupAnchorTime: number
  coreIndex: number
  validatorSet: ValidatorSet
  networkState: NetworkState
  timestamp: number
}

/**
 * Work package
 */
export interface WorkPackage {
  id: string
  data: Bytes
  author: string
  timestamp: number
  authToken: Bytes
  authCodeHost: number
  authCodeHash: string
  authConfig: Bytes
  context: WorkPackageContext
  workItems: WorkItem[]
}

/**
 * Work digest
 */
export interface WorkDigest {
  serviceIndex: number
  codeHash: string
  payloadHash: string
  gasLimit: number
  result: Uint8Array | WorkError
  gasUsed: number
  importCount: number
  exportCount: number
  extrinsicCount: number
  extrinsicSize: number
}

/**
 * Work error types
 */
export enum WorkError {
  OVERSIZE = 'oversize',
  BAD_EXPORTS = 'bad_exports',
  INVALID_RESULT = 'invalid_result',
  GAS_LIMIT_EXCEEDED = 'gas_limit_exceeded',
  AUTHORIZATION_FAILED = 'authorization_failed',
}

/**
 * Availability specification
 */
export interface AvailabilitySpec {
  packageHash: string
  bundleLength: number
  erasureRoot: string
  segmentRoot: string
  segmentCount: number
}

/**
 * Work report
 */
export interface WorkReport {
  id: string
  workPackageId: string
  availabilitySpec: AvailabilitySpec
  context: WorkPackageContext
  coreIndex: number
  authorizer: string
  authTrace: Bytes
  srLookup: Map<string, string> // segment root lookup
  digests: WorkDigest[]
  authGasUsed: number
  author: string
  timestamp: number
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

// Re-export core types with our own names
export type BlockHeader = CoreBlockHeader
export type Extrinsic = CoreExtrinsic

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
  memoryUsage: number // bytes
  cpuUsage: number // percentage

  // Block statistics
  extrinsicCount: number
  workPackageCount: number
  blockSize: number // bytes
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
  signature?: Bytes
  publicKey?: Bytes
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
  validatorKey: Bytes
  error?: string
}

// ============================================================================
// Account Types
// ============================================================================

/**
 * Account structure
 */
export interface Account {
  address: string
  balance: bigint
  nonce: number
  code?: Bytes
  storage?: Map<string, string>
  isValidator?: boolean
  validatorKey?: string
  stake?: bigint
}

export interface Validator {
  bandersnatch: string
  ed25519: string
  address?: string
  publicKey?: string
  stake?: bigint
  isActive?: boolean
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
    hash: string
    parentHash: string
    timestamp: number
  }

  // Initial state
  state: {
    accounts: Map<string, Account>
    validators: Validator[]
    safrole: {
      epoch: number
      timeslot: number
      entropy: string
      tickets: SafroleTicket[]
    }
    authpool: string[]
    recent: string[]
    lastAccount: number
    stagingset: string[]
    activeset: string[]
    previousset: string[]
    reports: WorkReport[]
    thetime: number
    authqueue: string[]
    privileges: Map<string, number>
    disputes: unknown[]
    activity: Map<string, number>
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
