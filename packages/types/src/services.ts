import type { Hex } from 'viem'
import type { Block } from './block-authoring'
import type { ValidatorPublicKeys } from './consensus'
import type { Extrinsic } from './core'
import type { JamVersion } from './fuzz'
import type {
  Activity,
  BlockHeader,
  EntropyState,
  RecentHistoryEntry,
} from './global-state'
import type { ValidatorCredentials } from './keys'
import type { Safe, SafePromise } from './safe'
import type {
  Guarantee,
  GuaranteeSignature,
  Judgment,
  Preimage,
  SafroleTicket,
  SafroleTicketWithoutProof,
  ServiceAccount,
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

  setStagingSet(validatorSet: ValidatorPublicKeys[]): void
  setActiveSet(validatorSet: ValidatorPublicKeys[]): void
  setPendingSet(validatorSet: ValidatorPublicKeys[]): void
  setPreviousSet(validatorSet: ValidatorPublicKeys[]): void
}

export interface ISealKeyService extends BaseService {
  getSealKeyForSlot(slot: bigint): Safe<SafroleTicketWithoutProof | Uint8Array>
  setSealKeys(sealKeys: (SafroleTicketWithoutProof | Uint8Array)[]): void
  getPendingWinnersMark(): SafroleTicketWithoutProof[] | null
  calculateNewSealKeySequence(): Safe<undefined>
}

export interface IRecentHistoryService extends BaseService {
  getRecentHistory(): RecentHistoryEntry[]
  getRecentHistoryForBlock(blockHash: Hex): RecentHistoryEntry | null
}

export interface IStateService extends BaseService {
  getStateRoot(): Safe<Hex>
  getGenesisManager(): IGenesisManagerService | undefined
}

export interface IGenesisManagerService extends BaseService {
  getGenesisHeaderHash(): Safe<Hex>
}

export interface IServiceAccountService extends BaseService {
  getServiceAccount(serviceId: bigint): Safe<ServiceAccount>
  setServiceAccount(
    serviceId: bigint,
    serviceAccount: ServiceAccount,
  ): Safe<void>
  deleteServiceAccount(serviceId: bigint): Safe<void>
  /** Clear all service accounts - used for fork switching or state reset */
  clearAllServiceAccounts(): void

  getServiceAccountStorage(serviceId: bigint, key: Hex): Uint8Array | undefined
  histLookupServiceAccount(
    serviceId: bigint,
    serviceAccount: ServiceAccount,
    hash: Hex,
    timeslot: bigint,
  ): Safe<Uint8Array | null>

  /** Get storage value for service */
  getStorageValue(serviceId: bigint, key: Hex): Uint8Array | undefined

  /** Store a preimage */
  storePreimage(preimage: Preimage, creationSlot: bigint): Safe<Hex>

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
  ): Safe<WorkReport>

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
   * Step 9: Send to Block Author
   *
   * Gray Paper Reference: guaranteeing.tex (line 3, 33)
   *
   * Algorithm:
   * 1. Get current block author (from Safrole state)
   * 2. Package guarantee into network message
   * 3. Send guarantee to block author
   * 4. Track inclusion status
   * 5. Resend if not included within timeout
   *
   * Notes:
   * - Should send promptly to maximize inclusion chance
   * - Block author will validate and include in XT_guarantees
   * - Inclusion leads to reward for guarantors
   *
   * @param guarantee - Guarantee extrinsic to send
   * @returns Safe<void> - Success when sent
   */
  sendToBlockAuthor(guarantee: Guarantee): Safe<void>

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
   * Get the current best block head
   *
   * Gray Paper: Best block maximizes ticketed ancestors and is audited
   */
  getBestHead(): BlockHeader | null

  /**
   * Get the finalized block head
   *
   * Gray Paper: Finalized by GRANDPA consensus
   */
  getFinalizedHead(): BlockHeader | null

  /**
   * Finalize a block (called by GRANDPA)
   *
   * Gray Paper: Prunes all forks not containing this block
   */
  finalizeBlock(blockHash: Hex): Safe<void>

  /**
   * Check if a block is an ancestor of the best chain
   */
  isAncestorOfBest(blockHash: Hex): boolean

  /**
   * Check if a block hash is a valid lookup anchor
   *
   * Gray Paper: Lookup anchor must be within last L imported headers
   * jam-conformance: Required for M1 compliance when ancestry feature enabled
   */
  isValidLookupAnchor(anchorHash: Hex): boolean

  /**
   * Get the list of valid lookup anchors (last L block hashes)
   */
  getValidLookupAnchors(): Hex[]

  /**
   * Initialize ancestry from external source (e.g., fuzzer Initialize message)
   *
   * jam-conformance: The Initialize message contains ancestor list for first block
   */
  initializeAncestry(ancestors: Hex[]): void

  /**
   * Get all active fork heads
   */
  getActiveForks(): ChainFork[]

  /**
   * Handle equivocation detection (two blocks at same slot)
   *
   * Gray Paper: Blocks with equivocations are not acceptable
   */
  reportEquivocation(blockA: Hex, blockB: Hex): void

  /**
   * Clear all state (for testing/fork switching)
   */
  clear(): void
}
