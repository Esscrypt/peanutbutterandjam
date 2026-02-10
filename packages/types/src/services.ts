import type { Hex } from 'viem'
import type { Block } from './block-authoring'
import type { ValidatorPublicKeys } from './consensus'
import type { Extrinsic } from './core'
import type { AncestryItem, JamVersion } from './fuzz'
import type {
  Activity,
  AuthQueue,
  BlockHeader,
  EntropyState,
  Privileges,
  Ready,
  ReadyItem,
  RecentHistoryEntry,
  ServiceAccounts,
} from './global-state'
import type { BlockRequest, StateRequest } from './jamnp'
import type { ValidatorCredentials } from './keys'
import type { StreamKind } from './network'
import type { Safe, SafePromise } from './safe'
import type {
  Dispute,
  Guarantee,
  GuaranteeSignature,
  Judgment,
  Preimage,
  PreimageRequestStatus,
  SafroleTicket,
  SafroleTicketWithoutProof,
  ServiceAccount,
  StateTrie,
  ValidatorKeyTuple,
  WorkPackage,
  WorkReport,
} from './serialization'
import type { BaseService } from './service'

export interface IValidatorSetManager extends BaseService {
  getEpochRoot(): Hex
  getActiveValidatorKeys(): Uint8Array[]
  getValidatorIndex(ed25519PublicKey: Hex): Safe<number>
  getActiveValidators(): ValidatorKeyTuple[]
  getPreviousValidators(): ValidatorKeyTuple[]
  getValidatorAtIndex(validatorIndex: number): Safe<ValidatorKeyTuple>
  getPendingValidators(): ValidatorKeyTuple[]

  getStagingValidators(): ValidatorPublicKeys[]

  setStagingSet(validatorSet: ValidatorPublicKeys[]): void
  setActiveSet(validatorSet: ValidatorPublicKeys[]): void
  setPendingSet(validatorSet: ValidatorPublicKeys[]): void
  setPreviousSet(validatorSet: ValidatorPublicKeys[]): void

  createNullValidatorSet(count: number): ValidatorPublicKeys[]
}

export interface ISealKeyService extends BaseService {
  getSealKeyForSlot(slot: bigint): Safe<SafroleTicketWithoutProof | Uint8Array>
  setSealKeys(sealKeys: (SafroleTicketWithoutProof | Uint8Array)[]): void
  getPendingWinnersMark(): SafroleTicketWithoutProof[] | null
  calculateNewSealKeySequence(previousSlotPhase: number): Safe<undefined>
}

export interface IRecentHistoryService extends BaseService {
  getRecentHistory(): RecentHistoryEntry[]
  getRecentHistoryForBlock(blockHash: Hex): RecentHistoryEntry | null
}

export interface IStateService extends BaseService {
  getStateRoot(): Safe<Hex>
  getGenesisManager(): IGenesisManagerService | undefined
  clearState(): void
  setState(keyvals: { key: Hex; value: Hex }[]): Safe<void>
  generateStateTrie(): Safe<Record<string, Hex>>
}

export interface IGenesisManagerService extends BaseService {
  getGenesisHeaderHash(): Safe<Hex>
}

export interface IServiceAccountService extends BaseService {
  getServiceAccounts(): ServiceAccounts
  getServiceAccount(serviceId: bigint): Safe<ServiceAccount>
  setServiceAccount(
    serviceId: bigint,
    serviceAccount: ServiceAccount,
  ): Safe<void>
  deleteServiceAccount(serviceId: bigint): Safe<void>
  clearKeyvalsAndMarkEjected(serviceId: bigint): Safe<void>
  /** Clear all service accounts - used for fork switching or state reset */
  clearAllServiceAccounts(): void

  getServiceAccountStorage(serviceId: bigint, key: Hex): Uint8Array | undefined

  getServiceAccountRequest(
    serviceId: bigint,
    hash: Hex,
    blobLength: bigint,
  ): PreimageRequestStatus | undefined
  histLookupServiceAccount(
    serviceId: bigint,
    serviceAccount: ServiceAccount,
    hash: Hex,
    timeslot: bigint,
  ): Safe<Uint8Array | null>

  /** Get storage value for service */
  getStorageValue(serviceId: bigint, key: Hex): Uint8Array | undefined

  /** Store a preimage */
  storePreimage(preimage: Preimage, creationSlot: bigint): Safe<void>

  /** Get list of all service IDs */
  listServiceIds(): bigint[]

  /**
   * Get preimage request status for a given service, hash, and length
   * Gray Paper: sa_requests[(hash, length)] -> sequence[:3]{timeslot}
   *
   * @param serviceId - Service account ID
   * @param hash - Preimage hash
   * @param length - Expected preimage length
   * @returns Request status (array of timeslots) or undefined if not found
   */
  getPreimageRequestStatus(
    serviceId: bigint,
    hash: Hex,
    length: bigint,
  ): bigint[] | undefined

  /**
   * Get pending preimages that have been received but not yet applied to service account through accumulation
   *
   * Pending preimages are preimages that have been received but not yet accumulated
   * into the service account state. They remain pending until applied during accumulation.
   *
   * @returns Array of pending preimages
   */
  getPendingPreimages(): Preimage[]

  /**
   * Get pending preimages that are requested on-chain but not yet in state
   *
   * Returns pending preimages that:
   * - Have been received (are in pending preimages)
   * - Are requested on-chain (have a request status)
   * - Are available at the given slot (using Gray Paper function I(l, t))
   *
   * @param slot - Current slot to check availability
   * @returns Array of pending preimages that are requested and available
   */
  getRequestedPendingPreimages(slot: bigint): Preimage[]
}

export interface IKeyPairService extends BaseService {
  getLocalKeyPair(): Safe<ValidatorCredentials>
}

export interface IEntropyService extends BaseService {
  getEntropy1(): Uint8Array
  getEntropy2(): Uint8Array
  getEntropy3(): Uint8Array
  getEntropyAccumulator(): Uint8Array
  getEntropy(): EntropyState
  setEntropy(entropy: EntropyState): void
}

export interface ITicketService extends BaseService {
  getTicketAccumulator(): SafroleTicketWithoutProof[]
  isAccumulatorFull(): boolean
  addReceivedTicket(ticket: SafroleTicket, publicKey: Hex): void
  addProxyValidatorTicket(ticket: SafroleTicket): void
  getProxyValidatorTickets(): SafroleTicket[]
  getReceivedTickets(): SafroleTicketWithoutProof[]
}

export interface IJudgmentHolderService extends BaseService {
  getJudgements(): Judgment[]
  addJudgement(
    judgement: Judgment,
    epochIndex: bigint,
    workReportHash: Hex,
  ): SafePromise<void>
}

export interface IConfigService extends BaseService {
  get epochDuration(): number
  get ticketsPerValidator(): number
  get maxTicketsPerExtrinsic(): number
  get contestDuration(): number
  get rotationPeriod(): number
  get numEcPiecesPerSegment(): number
  get maxBlockGas(): number
  get maxRefineGas(): number
  get numValidators(): number
  get numCores(): number
  get preimageExpungePeriod(): number
  get slotDuration(): number
  get maxLookupAnchorage(): number
  get ecPieceSize(): number
  get jamVersion(): JamVersion
  set jamVersion(version: JamVersion)
  /**
   * Whether ancestry feature is enabled
   * jam-conformance: When disabled, lookup anchor validation is skipped
   */
  get ancestryEnabled(): boolean
  set ancestryEnabled(enabled: boolean)
  /**
   * Whether forking feature is enabled
   * jam-conformance: When enabled, mutations (sibling blocks) are tracked
   */
  get forkingEnabled(): boolean
  set forkingEnabled(enabled: boolean)
  /**
   * Validator index for this node (optional)
   * When set, the node will use the dev account key pair for this validator index
   */
  get validatorIndex(): number | undefined
  set validatorIndex(index: number | undefined)
}

export interface IClockService extends BaseService {
  getLatestReportedBlockTimeslot(): bigint
  getSlotFromWallClock(): bigint
  getCurrentSlot(): bigint
  getCurrentEpoch(): bigint
  getCurrentPhase(): bigint

  setLatestReportedBlockTimeslot(timeslot: bigint): void
}

/**
 * Statistics Service Interface
 *
 * Provides access to validator, core, and service activity statistics.
 * Gray Paper Reference: graypaper/text/statistics.tex
 */
export interface IStatisticsService extends BaseService {
  /**
   * Get the current activity (statistics) data
   */
  getActivity(): Activity

  updateServiceAccumulationStats(
    serviceId: bigint,
    accumulationStats: [number, number],
  ): void

  updateServiceOnTransfersStats(
    serviceId: bigint,
    onTransfersStats: [number, number],
  ): void
}

/**
 * Work Package State according to Gray Paper lifecycle
 */
export type WorkPackageState =
  | 'submitted' // Builder submitted, waiting for evaluation
  | 'evaluating' // Guarantor is computing work-report
  | 'guaranteed' // Work-report signed, guarantee created
  | 'reported' // Work-report included on-chain (in reports state)
  | 'erasure_coded' // Erasure coded and distributed to validators
  | 'assured' // Availability assured by validators
  | 'available' // Available and ready for accumulation
  | 'accumulated' // Accumulated into service state
  | 'timed_out' // Failed to become available in time
  | 'rejected' // Failed validation or authorization

/**
 * Complete work package entry with metadata
 */
export interface WorkPackageEntry {
  /** The work package submitted by builder */
  workPackage: WorkPackage
  /** Associated extrinsic data */
  extrinsic: Extrinsic
  /** Current state in lifecycle */
  state: WorkPackageState
  /** Core index this work package is for */
  coreIndex: bigint
  /** Timestamp of submission */
  submittedAt: bigint
  /** Timestamp of last state change */
  updatedAt: bigint
  /** The computed work report (if guaranteed) */
  workReport?: WorkReport
  /** Timestamp when reported on-chain (if reported) */
  reportedAt?: bigint
  /** Number of assurances received (if erasure coded) */
  assuranceCount?: number
  /** Reason for rejection (if rejected) */
  rejectionReason?: string
}

/**
 * Work Package Manager Interface
 *
 * Gray Paper Reference: reporting_assurance.tex, work_packages_and_reports.tex
 */
export interface IWorkPackageManager extends BaseService {
  /**
   * Add a newly submitted work package
   * Gray Paper: Initial state when builder submits to guarantor
   */
  addWorkPackage(
    workPackageHash: Hex,
    workPackage: WorkPackage,
    extrinsic: Extrinsic,
    coreIndex: bigint,
  ): Safe<void>

  /**
   * Get work package entry by hash
   */
  getWorkPackage(workPackageHash: Hex): WorkPackageEntry | undefined

  /**
   * Update work package state
   * Gray Paper: Reflects state transitions in the work package lifecycle
   */
  updateWorkPackageState(
    workPackageHash: Hex,
    newState: WorkPackageState,
    metadata?: {
      workReport?: WorkReport
      reportedAt?: bigint
      assuranceCount?: number
      rejectionReason?: string
    },
  ): Safe<void>

  /**
   * Attach work report to work package
   * Gray Paper: After guarantor computes work-report from work-package
   */
  attachWorkReport(workPackageHash: Hex, workReport: WorkReport): Safe<void>

  /**
   * Get pending work packages for a specific core
   * Gray Paper: For guarantors to check which packages need processing
   */
  getPendingWorkPackages(coreIndex: bigint): WorkPackageEntry[]

  /**
   * Get work packages by state
   */
  getWorkPackagesByState(state: WorkPackageState): WorkPackageEntry[]

  /**
   * Remove work package (after accumulation or timeout)
   * Gray Paper: Cleanup after work-report is accumulated or timed out
   */
  removeWorkPackage(workPackageHash: Hex): Safe<void>

  /**
   * Mark work package as reported on-chain
   * Gray Paper: When work-report is included in reports state
   */
  markAsReported(workPackageHash: Hex, timestamp: bigint): Safe<void>

  /**
   * Update assurance count
   * Gray Paper: Track validator attestations to availability
   */
  updateAssuranceCount(workPackageHash: Hex, assuranceCount: number): Safe<void>

  /**
   * Get work package for a core from reports state
   * Gray Paper: reports[core] = optional{tuple{workreport, timestamp}}
   */
  getReportedWorkPackage(coreIndex: bigint): WorkPackageEntry | undefined
}

/**
 * Guarantor Service Interface
 *
 * Defines the core methods that a guarantor must implement according to the Gray Paper
 */
export interface IGuarantorService {
  /**
   * Step 1: Determine Core Assignment
   *
   * Gray Paper Reference: reporting_assurance.tex (Equations 210-218)
   *
   * Algorithm:
   * 1. Create initial core assignments: [floor(C_corecount × i / C_valcount) for i in valindex]
   * 2. Shuffle using Fisher-Yates with entropy_2: fyshuffle(assignments, entropy_2)
   * 3. Calculate rotation number: floor((thetime % C_epochlen) / C_rotationperiod)
   * 4. Apply rotation offset to shuffled assignments
   * 5. Return core index for this validator
   *
   * Formula:
   * P(e, t) ≡ R(fishuffle([floor(C_corecount × i / C_valcount) | i ∈ valindex], e),
   *            floor((t % C_epochlen) / C_rotationperiod))
   *
   * @param validatorIndex - Index of this validator in the active set
   * @param entropyService - Service to get epochal entropy (entropy_2)
   * @param clockService - Service to get current time slot
   * @returns Safe<number> - Core index assigned to this validator
   */
  getAssignedCore(
    validatorIndex: number,
    entropyService: IEntropyService,
    clockService: IClockService,
  ): Safe<number>

  /**
   * Step 2: Evaluate Work-Package Authorization
   *
   * Gray Paper Reference: guaranteeing.tex (lines 8, 27)
   *
   * Algorithm:
   * 1. Extract authorization hash from work-package (p_authcodehash)
   * 2. Get authorization pool from state (authpool)
   * 3. Check if authorization hash exists in pool for assigned core
   * 4. Verify work-package context is valid (anchor block exists, etc.)
   * 5. Return authorization status
   *
   * Notes:
   * - Should be done BEFORE computing work-report to avoid wasted work
   * - Advanced nodes may predict future state for better inclusion likelihood
   * - Naive nodes can use current chain head
   *
   * @param workPackage - Work-package to evaluate
   * @param coreIndex - Core index to check authorization for
   * @returns Safe<boolean> - True if authorized and valid
   */
  evaluateAuthorization(
    workPackage: WorkPackage,
    coreIndex: number,
  ): Safe<boolean>

  /**
   * Step 3: Compute Work-Report
   *
   * Gray Paper Reference: guaranteeing.tex (Equation 19)
   *
   * Algorithm:
   * 1. Verify authorization (Step 2)
   * 2. Execute Ψ_R (Refine) function on work-package
   * 3. For each work-item:
   *    a. Load service code from state
   *    b. Execute PVM with work-item payload
   *    c. Collect execution results and gas usage
   * 4. Aggregate all work-item results into work-report
   * 5. Calculate work-package hash and segment root
   *
   * Formula:
   * r = Ψ_R(p, c)
   *
   * Where:
   * - r is the work-report
   * - p is the work-package
   * - c is the core index
   *
   * @param workPackage - Work-package to process
   * @param coreIndex - Core index for this work
   * @returns Safe<WorkReport> - Computed work-report
   */
  computeWorkReport(
    workPackage: WorkPackage,
    coreIndex: number,
  ): SafePromise<WorkReport>

  /**
   * Step 4: Sign Work-Report
   *
   * Gray Paper Reference: guaranteeing.tex (Equations 23-25)
   *
   * Algorithm:
   * 1. Serialize work-report: encode(r)
   * 2. Hash serialized report: l = blake(encode(r))
   * 3. Sign hash with validator's Ed25519 key: s = sign(l, edkey)
   * 4. Create signature tuple: (v, s)
   * 5. Return signature
   *
   * Formula:
   * l = blake(encode(r))
   * s = Ed25519_sign(l, validator_edkey)
   *
   * Notes:
   * - Must use registered Ed25519 key from validator set
   * - Signature is over BLAKE2b hash of encoded work-report
   * - Should sign at most 2 work-reports per timeslot to avoid spam measures
   *
   * @param workReport - Work-report to sign
   * @param validatorIndex - Index of this validator
   * @returns Safe<GuaranteeSignature> - Signature tuple (validatorIndex, signature)
   */
  signWorkReport(
    workReport: WorkReport,
    validatorIndex: number,
  ): Safe<GuaranteeSignature>

  /**
   * Step 5: Distribute to Co-Guarantors
   *
   * Gray Paper Reference: guaranteeing.tex (line 31)
   *
   * Algorithm:
   * 1. Get list of other validators assigned to same core
   * 2. For each co-guarantor:
   *    a. Check if they already know about this work-package
   *    b. If not, send work-package via network protocol
   * 3. Wait for co-guarantor signatures (need 2-3 total)
   * 4. Return collected signatures
   *
   * Notes:
   * - Helps form consensus over the core
   * - Maximizes chance that work is not wasted
   * - Should track which guarantors have seen which packages
   *
   * @param workPackage - Work-package to distribute
   * @param coreIndex - Core index to send to
   * @returns Safe<GuaranteeSignature[]> - Collected signatures from co-guarantors
   */
  distributeToCoGuarantors(
    workPackage: WorkPackage,
    coreIndex: number,
  ): Safe<GuaranteeSignature[]>

  /**
   * Step 6: Perform Erasure Coding
   *
   * Gray Paper Reference: guaranteeing.tex (line 10), erasure_coding.tex
   *
   * Algorithm:
   * 1. Chunk work-package data into segments
   * 2. Chunk each extrinsic data into segments
   * 3. Chunk each exported data into segments
   * 4. Apply erasure coding to create redundant chunks
   * 5. Calculate segment root (Merkle root of chunks)
   * 6. Return chunks and segment root
   *
   * Notes:
   * - Uses systematic erasure coding (original data + parity)
   * - Enables data availability with partial data loss
   * - Critical for dispute resolution
   *
   * @param workPackage - Work-package to chunk
   * @param exportedData - Exported data from work-report
   * @returns Safe<{ chunks: Uint8Array[], segmentRoot: Hex }> - Erasure coded chunks
   */
  performErasureCoding(
    workPackage: WorkPackage,
    exportedData: Uint8Array[],
  ): Safe<{ chunks: Uint8Array[]; segmentRoot: Hex }>

  /**
   * Step 7: Distribute Chunks to Validators
   *
   * Gray Paper Reference: guaranteeing.tex (line 11)
   *
   * Algorithm:
   * 1. Get list of all validators in active set
   * 2. For each validator, assign specific chunks
   * 3. Send assigned chunks to each validator
   * 4. Track distribution status
   * 5. Retry failed distributions
   *
   * Notes:
   * - Each validator gets a subset of chunks
   * - Enables reconstruction with 2/3 of validators
   * - Important for network performance and data availability
   *
   * @param chunks - Erasure coded chunks
   * @param segmentRoot - Merkle root of chunks
   * @returns Safe<void> - Success when chunks distributed
   */
  distributeChunksToValidators(
    chunks: Uint8Array[],
    segmentRoot: Hex,
  ): Safe<void>

  /**
   * Step 8: Create Guarantee Extrinsic
   *
   * Gray Paper Reference: guaranteeing.tex (line 33), reporting_assurance.tex (Equation 251-263)
   *
   * Algorithm:
   * 1. Collect own signature and co-guarantor signatures (need 2-3 total)
   * 2. Sort signatures by validator index (ascending order)
   * 3. Create guarantee tuple: (work-report, timeslot, credentials)
   * 4. Validate guarantee meets all requirements:
   *    a. Has 2-3 signatures
   *    b. Signatures are from validators assigned to this core
   *    c. Signatures are valid
   *    d. Work-report is valid
   * 5. Return guarantee ready for block inclusion
   *
   * Formula:
   * guarantee ∈ tuple{work-report, timeslot, sequence[2:3]{(validator_index, signature)}}
   *
   * Notes:
   * - Need minimum 2 signatures for inclusion
   * - Can have up to 3 signatures
   * - Signatures must be ordered by validator index
   * - Should maximize profit by collecting all available signatures
   *
   * @param workReport - Work-report to guarantee
   * @param signatures - Collected guarantor signatures
   * @param timeslot - Current timeslot
   * @returns Safe<Guarantee> - Complete guarantee extrinsic
   */
  createGuarantee(
    workReport: WorkReport,
    signatures: GuaranteeSignature[],
    timeslot: bigint,
  ): Safe<Guarantee>

  /**
   * Helper: Get Co-Guarantors
   *
   * Gets list of other validators assigned to the same core
   *
   * @param coreIndex - Core to get guarantors for
   * @param currentValidatorIndex - Index of this validator
   * @returns Safe<number[]> - Validator indices of co-guarantors
   */
  getCoGuarantors(
    coreIndex: number,
    currentValidatorIndex: number,
  ): Safe<number[]>

  /**
   * Helper: Rate Limit Check
   *
   * Ensures validator doesn't sign more than 2 work-reports per timeslot
   *
   * @param timeslot - Current timeslot
   * @returns Safe<boolean> - True if can sign another report
   */
  canSignWorkReport(timeslot: bigint): Safe<boolean>

  /**
   * Get pending guarantees ready for block inclusion
   *
   * @returns Array of pending guarantees
   */
  getPendingGuarantees(): Guarantee[]
}

/**
 * Represents a chain fork with its head block and state
 *
 * Gray Paper Reference: Section "Grandpa and the Best Chain" (best_chain.tex)
 */
export interface ChainFork {
  /** Block header hash of the fork head */
  headHash: Hex
  /** Block header of the fork head */
  head: BlockHeader
  /** State root at this fork head */
  stateRoot: Hex
  /** Number of ticketed blocks in this chain (for fork choice) */
  ticketedCount: number
  /** Whether this fork is audited */
  isAudited: boolean
  /** Ancestor hashes (for ancestor checks) - limited to maxLookupAnchorage */
  ancestors: Set<Hex>
  /** Ordered list of ancestor hashes (most recent first) for lookup anchor validation */
  ancestorList: Hex[]
}

/**
 * Chain reorganization event
 *
 * Used when switching between forks to track which blocks need to be
 * reverted and which need to be applied.
 */
export interface ReorgEvent {
  /** Old chain head before reorg */
  oldHead: Hex
  /** New chain head after reorg */
  newHead: Hex
  /** Blocks that were reverted */
  revertedBlocks: Hex[]
  /** Blocks that were applied */
  appliedBlocks: Hex[]
}

/**
 * Chain Manager Service Interface
 *
 * Handles block import, fork resolution, and chain reorganization according to
 * Gray Paper specifications for GRANDPA and best chain selection.
 *
 * Gray Paper Reference: Section "Grandpa and the Best Chain" (best_chain.tex)
 *
 * Key responsibilities:
 * 1. Track multiple fork heads (unfinalized chains)
 * 2. Implement best chain selection (maximize ticketed blocks)
 * 3. Handle GRANDPA finalization
 * 4. Manage chain reorganization (reorgs)
 * 5. Maintain state snapshots for each fork head
 * 6. Support ancestry feature for lookup anchor validation (jam-conformance M1)
 *
 * Ancestry Feature (jam-conformance):
 * - The lookup anchor of each report in guarantees extrinsic must be within last L headers
 * - Full spec: L = 14,400 (~24 hours at 6s slots)
 * - Tiny spec: L = 24 (~2.4 minutes at 6s slots)
 *
 * Forking Feature (jam-conformance):
 * - Mutations are siblings of original block (same parent)
 * - Mutations are never used as parents for subsequent blocks
 * - Original block is always finalized after mutations
 */
export interface IChainManagerService extends BaseService {
  /**
   * Import a new block
   *
   * Gray Paper: Block must have timeslot > previous block's timeslot
   * Handles fork creation if block's parent is not current best head
   */
  importBlock(block: Block): SafePromise<void>

  /**
   * Check if a block hash is a valid lookup anchor
   *
   * Gray Paper: Lookup anchor must be within last L imported headers
   * jam-conformance: Required for M1 compliance when ancestry feature enabled
   */
  isValidLookupAnchor(anchorHash: Hex): boolean

  /**
   * Initialize ancestry from external source (e.g., fuzzer Initialize message)
   *
   * jam-conformance: The Initialize message contains ancestor list for first block
   */
  initializeAncestry(ancestors: AncestryItem[]): void

  /**
   * Initialize the genesis block from an Initialize message header
   *
   * jam-conformance: The Initialize message contains a "genesis-like" header.
   * The hash of this header is what subsequent blocks use as their parent.
   *
   * @param header - The header from the Initialize message
   * @param stateSnapshot - Optional state trie snapshot for the genesis state
   */
  initializeGenesisHeader(header: BlockHeader, stateSnapshot?: StateTrie): void

  /**
   * Clear all state (for testing/fork switching)
   */
  clear(): void
}

export interface IAccumulationService extends BaseService {
  setLastProcessedSlot(slot: bigint | null): void
  getLastProcessedSlot(): bigint | null
}

export interface IBlockImporterService extends BaseService {
  importBlock(block: Block): SafePromise<boolean>
}

/**
 * Ready Service Interface
 */
export interface IReadyService {
  getReady(): Ready
  setReady(ready: Ready): void

  // Epoch slot operations
  getReadyItemsForSlot(slotIndex: bigint): ReadyItem[]
  addReadyItemToSlot(slotIndex: bigint, readyItem: ReadyItem): void
  removeReadyItemFromSlot(slotIndex: bigint, workReportHash: Hex): boolean
  clearSlot(slotIndex: bigint): void

  // Ready item operations
  addReadyItem(workReport: WorkReport, dependencies: Set<Hex>): void
  removeReadyItem(workReportHash: Hex): void
  getReadyItem(workReportHash: Hex): ReadyItem | undefined

  // Dependency management
  updateDependencies(workReportHash: Hex, dependencies: Set<Hex>): void
  removeDependency(workReportHash: Hex, dependencyHash: Hex): void
  addDependency(workReportHash: Hex, dependencyHash: Hex): void

  // Queue editing function E - modifies state directly
  // Gray Paper equation 50-60: E removes items whose package hash is in accumulated set,
  // and removes any dependencies which appear in said set
  applyQueueEditingFunctionEToSlot(
    slotIndex: bigint,
    accumulatedPackages: Set<Hex>,
  ): void
}

/**
 * Privileges Service Interface
 */
export interface IPrivilegesService {
  getPrivileges(): Privileges
  setPrivileges(privileges: Privileges): void

  // Manager operations
  getManager(): bigint
  setManager(serviceId: bigint): void

  // Delegator operations
  getDelegator(): bigint
  setDelegator(serviceId: bigint): void

  // Registrar operations
  getRegistrar(): bigint
  setRegistrar(serviceId: bigint): void

  // Assigner operations
  getAssigners(): bigint[]
  setAssigners(assigners: bigint[]): void
  getAssignerForCore(coreIndex: bigint): bigint | undefined
  setAssignerForCore(coreIndex: bigint, serviceId: bigint): void

  // Always Accers operations
  getAlwaysAccers(): Map<bigint, bigint>
  setAlwaysAccers(alwaysAccers: Map<bigint, bigint>): void
  addAlwaysAccer(serviceId: bigint, gasLimit: bigint): void
  removeAlwaysAccer(serviceId: bigint): void
  getGasLimitForService(serviceId: bigint): bigint | undefined

  // Validation
  validatePrivileges(): boolean
  isServicePrivileged(serviceId: bigint): boolean
}

export interface IAuthQueueService extends BaseService {
  getAuthQueue(): AuthQueue
  setAuthQueue(authQueue: AuthQueue): void
}

/**
 * Assurance Service Interface
 *
 * Manages assurance processing for the JAM protocol.
 * Assurances are validator attestations that erasure-coded data is available.
 *
 * TODO: Add method to get pending assurances ready for block inclusion
 * The method should return assurances that are:
 * - Validated (signature, anchor matches parent hash)
 * - Sorted by validator_index (ascending, unique)
 * - Ready for inclusion (not expired, anchor matches current parent)
 */
export interface IAssuranceService extends BaseService {
  // TODO: Add getPendingAssurances(parentHash: Hex): Assurance[] when implemented
}

/**
 * Disputes Service Interface
 *
 * Manages dispute judgments on work-reports and validators.
 *
 * TODO: Add method to get pending disputes ready for block inclusion
 * The method should return disputes that are:
 * - Validated (signatures, verdicts, culprits, faults)
 * - Ready for inclusion (not expired, valid work report hashes)
 */
export interface IDisputesService extends BaseService {
  /**
   * Get pending disputes ready for block inclusion
   *
   * TODO: Implement collection of pending disputes
   * Disputes should be:
   * - Validated (signatures, verdicts, culprits, faults)
   * - Ready for inclusion (not expired, valid work report hashes)
   *
   * @returns Array of pending disputes ready for block inclusion
   */
  getPendingDisputes(): Dispute[]
}

/**
 * Work Report Service Interface
 *
 * Unified service for managing all work reports throughout their lifecycle.
 *
 * TODO: Add method to get pending guarantees ready for block inclusion
 * The method should return guarantees that are:
 * - Created by guarantors when they sign work reports
 * - Validated (signatures, work report validity)
 * - Ready for inclusion (dependencies satisfied, not expired)
 */
export interface IWorkReportService extends BaseService {
  /**
   * Get work report for a core
   *
   * @param coreIndex - The core index
   * @returns The work report for the core
   */
  getWorkReportForCore(coreIndex: bigint): WorkReport | null

  /**
   * Get pending guarantees ready for block inclusion
   *
   * Guarantees are:
   * - Created by guarantors when they sign work reports
   * - Validated (signatures, work report validity)
   * - Ready for inclusion (dependencies satisfied, not expired)
   *
   * @returns Array of pending guarantees ready for block inclusion
   */
  getPendingGuarantees(): Guarantee[]

  /**
   * Add a guarantee to the pending guarantees list
   * Called by GuarantorService when a guarantee is created and distributed
   *
   * @param guarantee - The guarantee to add
   */
  addPendingGuarantee(guarantee: Guarantee): void

  /**
   * Remove guarantees from the pending list
   * Called by BlockImporterService when guarantees are included in a block
   *
   * @param guarantees - The guarantees to remove
   */
  removePendingGuarantees(guarantees: Guarantee[]): void
}

/**
 * Block Request Protocol Interface
 *
 * Interface for requesting blocks via CE128 protocol
 */
export interface IBlockRequestProtocol {
  serializeRequest(request: BlockRequest): Safe<Uint8Array>
  deserializeRequest(data: Uint8Array): Safe<BlockRequest>
}

/**
 * State Request Protocol Interface
 *
 * Interface for requesting state via CE129 protocol
 */
export interface IStateRequestProtocol {
  serializeRequest(request: StateRequest): Safe<Uint8Array>
  deserializeRequest(data: Uint8Array): Safe<StateRequest>
}

/**
 * Networking Service Interface
 *
 * Interface for sending messages over the network
 */
export interface INetworkingService {
  sendMessageByPublicKey(
    peerPublicKey: Hex,
    streamKind: StreamKind,
    message: Uint8Array,
  ): SafePromise<void>
  closeStreamForPeer(publicKey: Hex, kind: StreamKind): SafePromise<void>
}

/**
 * State Service Interface (extended)
 *
 * Extended interface for setting state from key-value pairs
 */
export interface IStateServiceExtended extends IStateService {
  setState(keyvals: Array<{ key: Hex; value: Hex }>): Safe<void>
}
