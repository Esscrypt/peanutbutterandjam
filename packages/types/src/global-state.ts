/**
 * Global State Interface for JAM Protocol
 *
 * Complete Gray Paper-compliant state definition based on equation (34):
 * thestate ≡ (authpool, recent, lastaccout, safrole, accounts, entropy,
 *             stagingset, activeset, previousset, reports, thetime,
 *             authqueue, privileges, disputes, activity, ready, accumulated)
 *
 * Reference: graypaper/text/overview.tex equation (34)
 * Each component is precisely typed according to Gray Paper specifications
 */

import type { Hex } from '@pbnjam/core'
import type { BlockBody } from './block-authoring'
import type {
  SafroleState,
  ValidatorKeyPair,
  ValidatorPublicKeys,
} from './consensus'
import type {
  SafroleTicketWithoutProof,
  ServiceAccount,
  ServiceAccountCore,
  WorkReport,
} from './serialization'

// ============================================================================
// State Component Types
// ============================================================================

/**
 * Authorization pool (α)
 * Core authorizations pool - requirements for work done on each core
 */
/**
 * Authorization Pool (φ)
 *
 * Gray Paper Reference: authorization.tex (Equation 18)
 * authpool ∈ sequence[C_corecount]{sequence[C_authpoolsize]{hash}}
 *
 * Structure: 2D array where:
 * - Outer array: C_corecount elements (one per core, typically 341 cores)
 * - Inner arrays: Up to C_authpoolsize elements each (max 8 hashes per core)
 *
 * Each element is a 32-byte hash representing an authorization.
 *
 * State Transition: During block processing, the oldest authorization is removed
 * from the pool and a new one from the queue is appended (cyclic rotation).
 */
export type AuthPool = Hex[][]

/**
 * Recent activity log (β)
 * Log of recent blocks and accumulation outputs
 *
 * Gray Paper Reference: recent_history.tex (Equations 5-8, 38-43)
 * recent ≡ tuple{recenthistory, accoutbelt}
 * recenthistory ∈ sequence[:Crecenthistorylen]{tuple{...}}
 * Crecenthistorylen = 8 (definitions.tex line 263)
 *
 * Recent history stores up to 8 RecentHistoryEntry items (one per block),
 * maintained as a circular buffer that keeps the most recent 8 blocks.
 */
export interface Recent {
  /** Recent block history - sequence of up to 8 entries (Crecenthistorylen = 8) */
  history: RecentHistoryEntry[]
  /** Accumulation output belt (Merkle mountain range) */
  accoutBelt: AccoutBelt
}

/**
 * Recent history entry for a single block
 * Based on Gray Paper equation (8-12)
 */
export interface RecentHistoryEntry {
  /** Header hash (rh_headerhash) */
  headerHash: Hex
  /** State root (rh_stateroot) */
  stateRoot: Hex
  /** Accumulation output super-peak (rh_accoutlogsuperpeak) */
  accoutLogSuperPeak: Hex
  /** Reported package hashes (rh_reportedpackagehashes) */
  reportedPackageHashes: Map<Hex, Hex> // packageHash -> segRoot
}

/**
 * Accumulation output belt (β_B)
 * Merkle mountain belt for accumulating outputs
 *
 * Gray Paper: accoutbelt ∈ sequence{optional{hash}}
 *
 * Note: The MMR is a sparse array where some peaks may be null.
 * For serialization, we filter out nulls to get peaks: Hex[].
 * But internally, we preserve the full structure including nulls.
 */
export interface AccoutBelt {
  /** Mountain range peaks (without nulls, for serialization) */
  peaks: (Hex | null)[]
  /** Total accumulated count */
  totalCount: bigint
}

/**
 * Service accounts (δ)
 * State of all services (smart contracts)
 *
 * Gray Paper Reference: accounts.tex (Equation 6-8)
 * accounts ∈ dictionary{serviceid}{serviceaccount}
 *
 * Gray Paper Reference: accounts.tex (Equation 12-27)
 * serviceaccount ≡ tuple{
 *   sa_storage ∈ dictionary{blob}{blob},
 *   sa_preimages ∈ dictionary{hash}{blob},
 *   sa_requests ∈ dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}},
 *   sa_gratis ∈ balance,
 *   sa_codehash ∈ hash,
 *   sa_balance ∈ balance,
 *   sa_minaccgas ∈ gas,
 *   sa_minmemogas ∈ gas,
 *   sa_created ∈ timeslot,
 *   sa_lastacc ∈ timeslot,
 *   sa_parent ∈ serviceid
 * }
 *
 * Implementation Notes:
 * - The accounts map stores complete ServiceAccount objects (not just ServiceAccountCore)
 * - Storage, preimages, and requests are included as per Gray Paper specification
 * - Each service account contains all fields required by the Gray Paper
 * - The map key is serviceid (32-bit integer) and value is the complete serviceaccount tuple
 *
 * State Storage Locations (per Gray Paper merklization.tex):
 * - Core fields: Directly encoded in state trie at C(255, s)
 * - Storage: Key-value pairs at C(s, storage_key)
 * - Preimages: Hash-to-data mappings at C(s, preimage_hash)
 * - Requests: Preimage request metadata at C(s, request_hash, length)
 */
export interface ServiceAccounts {
  /**
   * Complete service accounts dictionary per Gray Paper specification
   *
   * Gray Paper: accounts ∈ dictionary{serviceid}{serviceaccount}
   *
   * Key: serviceid (32-bit service identifier)
   * Value: Complete serviceaccount tuple including:
   *   - Core fields: codehash, balance, minaccgas, minmemogas, octets, gratis, items, created, lastacc, parent
   *   - Storage: sa_storage ∈ dictionary{blob}{blob}
   *   - Preimages: sa_preimages ∈ dictionary{hash}{blob}
   *   - Requests: sa_requests ∈ dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}}
   *
   * This map contains ALL service accounts in the system, analogous to Ethereum's
   * account state but with additional fields for JAM's refinement/accumulation model.
   */
  accounts: Map<bigint, ServiceAccount>
}

/**
 * Gray Paper entropy structure: sequence[4]{hash}
 * Contains: [entropyaccumulator, entropy_1, entropy_2, entropy_3]
 */
export interface EntropyState {
  /** Current entropy accumulator - Gray Paper: entropyaccumulator */
  accumulator: Hex
  /** First previous epoch randomness - Gray Paper: entropy_1 */
  entropy1: Hex
  /** Second previous epoch randomness - Gray Paper: entropy_2 */
  entropy2: Hex
  /** Third previous epoch randomness - Gray Paper: entropy_3 */
  entropy3: Hex
}

/**
 * Pending reports (ρ)
 * Work reports pending availability assurance
 *
 * Gray Paper Reference: reporting_assurance.tex (Equation 17)
 * reports ∈ sequence[Ccorecount]{optional{tuple{workreport, timeslot}}}
 *
 * Structure: Array of length Ccorecount (341) where each element is either:
 * - null (no work report pending on this core)
 * - PendingReport (work report with timeslot when reported)
 *
 * Key Points:
 * - Only one report per core at any given time
 * - Timeslot is 32-bit unsigned integer (Nbits{32})
 * - Represents 6-second slot intervals since JAM Common Era
 */
export interface Reports {
  /**
   * Reports per core index (0 to Ccorecount-1)
   * Gray Paper: sequence[Ccorecount]{optional{tuple{workreport, timeslot}}}
   *
   * Array length: Ccorecount (341)
   * Each element: null | PendingReport
   */
  coreReports: (PendingReport | null)[]
}

/**
 * Pending report entry
 *
 * Gray Paper Reference: reporting_assurance.tex (Equation 17)
 * tuple{rs_workreport: workreport, rs_timestamp: timeslot}
 */
export interface PendingReport {
  /** The work report (rs_workreport) */
  workReport: WorkReport
  /** Timeslot when reported (rs_timestamp) - 32-bit unsigned integer */
  timeslot: number
}

/**
 * Authorization Queue (χ)
 *
 * Gray Paper Reference: authorization.tex (Equation 19)
 * authqueue ∈ sequence[C_corecount]{sequence[C_authqueuesize]{hash}}
 *
 * Structure: 2D array where:
 * - Outer array: C_corecount elements (one per core, typically 341 cores)
 * - Inner arrays: Up to C_authqueuesize elements each (max 80 hashes per core)
 *
 * Each element is a 32-byte hash representing a pending authorization.
 *
 * State Transition: New authorizations are added to the queue, and one element
 * per block is moved from the queue to the pool (FIFO with cyclic indexing).
 */
export type AuthQueue = Hex[][]

/**
 * Privileged service indices
 * Services with special privileges
 */
export interface Privileges {
  manager: bigint // Single blessed service
  delegator: bigint // Single delegator service
  registrar: bigint // Single registrar service
  assigners: bigint[] // Array of assigner services (one per core)
  alwaysaccers: Map<bigint, bigint> // Dictionary: serviceid -> gas
}

/**
 * Disputes State Structure (Gray Paper ψ - disputes)
 *
 * Gray Paper Equation: disputes ≡ (goodset, badset, wonkyset, offenders)
 *
 * This represents PERSISTENT STATE - the permanent record of dispute resolution outcomes.
 * It tracks the results of processing dispute extrinsics and persists across blocks
 * as the authoritative source of work-report judgments and validator punishments.
 *
 * Components (Gray Paper terminology):
 * - goodset: Work-report hashes judged to be CORRECT
 * - badset: Work-report hashes judged to be INCORRECT
 * - wonkyset: Work-report hashes judged to be UNKNOWABLE
 * - offenders: Ed25519 keys of validators who made incorrect judgments
 *
 * State Transitions:
 * - Updated when dispute extrinsics (Dispute) are processed
 * - Provides permanent on-chain record for slashing/punishment logic
 * - Used to prevent resubmission of already-judged reports
 *
 * Usage: Part of global state (Ψ) - persists between blocks
 *
 * ⚠️  DO NOT CONFUSE with Dispute (extrinsic) - they serve different purposes:
 * - Disputes (this): Persistent state outcomes (permanent)
 * - Dispute: Input data in blocks (temporary)
 */
export interface Disputes {
  /** Work-reports judged correct (goodset) */
  goodSet: Set<Hex>
  /** Work-reports judged incorrect (badset) */
  badSet: Set<Hex>
  /** Work-reports with unknowable validity (wonkyset) */
  wonkySet: Set<Hex>
  /** Validators who made incorrect judgments (offenders) */
  offenders: Set<Hex>
}

/**
 * Validator activity statistics (π)
 * Performance tracking per validator per epoch
 */
export interface Activity {
  /** Current epoch accumulator */
  validatorStatsAccumulator: ValidatorStats[]
  /** Previous epoch final stats */
  validatorStatsPrevious: ValidatorStats[]
  /** Core statistics */
  coreStats: CoreStats[]
  /** Service statistics */
  serviceStats: Map<bigint, ServiceStats>
}

/**
 * Per-validator statistics
 */
export interface ValidatorStats {
  /** Blocks authored */
  blocks: number
  /** Tickets submitted */
  tickets: number
  /** Preimages provided count */
  preimageCount: number
  /** Preimages provided size */
  preimageSize: number
  /** Guarantees made */
  guarantees: number
  /** Assurances provided */
  assurances: number
}

/**
 * Per-core statistics
 */
export interface CoreStats {
  /** Data availability load */
  daLoad: number
  /** Core popularity */
  popularity: number
  /** Import count */
  importCount: number
  /** Extrinsic count */
  extrinsicCount: number
  /** Extrinsic size */
  extrinsicSize: number
  /** Export count */
  exportCount: number
  /** Bundle length */
  bundleLength: number
  /** Gas used */
  gasUsed: number
}

/**
 * Per-service statistics
 */
/**
 * Service Statistics according to Gray Paper statistics.tex lines 91-101
 *
 * Gray Paper Formula:
 * servicestats ∈ dictionary{serviceid}{tuple{
 *   provision: tuple{N, N},      // sum over preimages of (1, len(data))
 *   refinement: tuple{N, gas},   // tuple{R(s)_counter, R(s)_gasused}
 *   importcount: N,              // R(s)_importcount
 *   xtcount: N,                  // R(s)_xtcount
 *   xtsize: N,                   // R(s)_xtsize
 *   exportcount: N,              // R(s)_exportcount
 *   accumulation: tuple{N, gas}  // ifnone{accumulationstatistics[s], tuple{0, 0}}
 * }}
 *
 * Field meanings:
 * - provision: tuple{count, size} - count and total size of preimages provided
 * - refinement: tuple{count, gas} - count and gas used in refinement operations
 * - accumulation: tuple{count, gas} - count and gas used in accumulation operations
 */
export interface ServiceStats {
  /** Provision: tuple{N, N} - [count, size] of preimages provided */
  provision: [number, number]
  /** Refinement: tuple{N, gas} - [count, gas] of refinement operations */
  refinement: [number, number]
  /** Import count: N - from R(s)_importcount */
  importCount: number
  /** Extrinsic count: N - from R(s)_xtcount */
  extrinsicCount: number
  /** Extrinsic size: N - from R(s)_xtsize */
  extrinsicSize: number
  /** Export count: N - from R(s)_exportcount */
  exportCount: number
  /** Accumulation: tuple{N, gas} - [count, gas] of accumulation operations
   * Only set when AccumulationService calls updateServiceAccumulationStats()
   * Gray Paper: accumulation = ifnone{accumulationstatistics[s], tuple{0, 0}}
   */
  accumulation?: [number, number]
  /** OnTransfers count: N - number of onTransfers operations (only for versions < 0.7.1) */
  onTransfersCount?: number
  /** OnTransfers gas used: N - total gas used in onTransfers operations (only for versions < 0.7.1) */
  onTransfersGasUsed?: number
}

/**
 * Ready work-reports (ω)
 * Work-reports ready for accumulation
 */
/**
 * Ready work-reports (ω) - Gray Paper compliant
 *
 * Gray Paper specification (Equation 34):
 * ready ∈ sequence[C_epochlen]{sequence{⟨workreport, protoset{hash}⟩}}
 *
 * Ready work-reports are reports that are ready for accumulation processing.
 * Each ready item contains a work report and its unaccumulated dependencies.
 * The structure is a sequence of epoch slots, each containing a sequence of ready items.
 *
 * Structure per Gray Paper:
 * - Outer sequence: epoch slots (fixed length C_epochlen)
 * - Inner sequence: ready items per slot (variable length)
 * - Each ready item: ⟨workreport, protoset{hash}⟩ tuple
 *   - workreport: the work report data
 *   - protoset{hash}: set of work-package hashes (dependencies)
 */
export interface ReadyItem {
  /** Work report ready for processing */
  workReport: WorkReport
  /** Set of work-package hashes this report depends on */
  dependencies: Set<Hex>
}

export interface Ready {
  /**
   * Sequence of epoch slots, each containing ready items
   * Length should be C_epochlen (typically 600)
   * ready ∈ sequence[C_epochlen]{sequence{⟨workreport, protoset{hash}⟩}}
   * array of C_epochlen arrays of ready items, first index is the epoch slot, second index is the ready item
   */
  epochSlots: ReadyItem[][]
}

/**
 * Recently accumulated work-packages (ξ)
 * Work-packages that were recently accumulated
 */
export interface Accumulated {
  /** Recently accumulated packages */
  //accumulated ∈ sequence[C_epochlen]{protoset{hash}}
  packages: Set<Hex>[] // array of C_epochlen sets of hashes
}

/**
 * Accumulation metadata
 */
export interface AccumulationMetadata {
  /** Accumulation timestamp */
  timestamp: bigint
  /** Core index where accumulated */
  coreIndex: bigint
  /** Gas consumed */
  gasUsed: bigint
}

// ============================================================================
// Complete Global State Interface
// ============================================================================

/**
 * Complete JAM Global State
 *
 * Based on Gray Paper equation (34):
 * thestate ≡ (authpool, recent, lastaccout, safrole, accounts, entropy,
 *             stagingset, activeset, previousset, reports, thetime,
 *             authqueue, privileges, disputes, activity, ready, accumulated)
 *
 * All components are immutable and precisely typed according to Gray Paper.
 * This represents the complete consensus state at any given block.
 *
 * @remarks
 * - All 17 state components from Gray Paper equation (34) are included
 * - Types are narrow and complete according to Gray Paper specifications
 * - All fields are  to enforce immutability
 * - State transitions create new instances rather than mutating existing state
 */
export type StateComponent =
  /** Authorization pool (α) - Core authorization requirements */
  | AuthPool
  /** Recent activity (β) - Recent blocks and accumulation outputs */
  | Recent
  /** Last accumulation output (θ) - Most recent accumulation result */
  | [bigint, Hex][]
  /** Safrole state (γ) - Consensus protocol internal state */
  | SafroleState
  /** Service accounts (δ) - All service (smart contract) state */
  | ServiceAccountCore // ServiceAccountCore is a single service account core, not a map of service account cores, since we handle the state in separate key/val pairs
  /** Entropy (ε) - On-chain randomness accumulator */
  | EntropyState
  /** Staging validator set (ι) - Validators queued for next epoch */
  /** Active validator set (κ) - Currently active validators */
  /** Previous validator set (λ) - Previous epoch validators */
  | ValidatorPublicKeys[]
  /** Pending reports (ρ) - Work reports awaiting availability assurance */
  | Reports
  /** Current time slot (τ) - Most recent block's timeslot index */
  | bigint
  /** Authorization queue (φ) - Queued core authorizations */
  | AuthQueue
  /** Privileges - Services with special privileges */
  | Privileges
  /** Disputes (ψ) - Judgments on work-reports and validators */
  | Disputes
  /** Activity (π) - Validator performance statistics */
  | Activity
  /** Ready work-reports (ω) - Reports ready for accumulation */
  | Ready
  /** Accumulated packages (ξ) - Recently accumulated work-packages */
  | Accumulated

export interface GlobalState {
  /** 1. Authorization pool (α) - Core authorization requirements */
  authpool: AuthPool
  /** 2. Recent activity (β) - Chapter C(3): Recent blocks and accumulation outputs */
  recent: Recent
  /** 3. Last accumulation output (θ) - Chapter C(16): Most recent accumulation result */
  // Gray Paper: lastaccout ∈ sequence{tuple{serviceid, hash}}
  // CRITICAL: This is a SEQUENCE - same service can appear multiple times if it accumulates
  // in different invocations with different yields. Order matters!
  lastAccumulationOutput: [bigint, Hex][]
  /** 4. Safrole state (γ) - Chapter C(4): Consensus protocol internal state */
  safrole: SafroleState
  /** 5. Service accounts (δ) - Chapter C(255): All service (smart contract) state */
  accounts: ServiceAccounts
  /** 6. Entropy (ε) - Chapter C(6): On-chain randomness accumulator */
  entropy: EntropyState
  /** 7. Staging validator set (ι) - Chapter C(7): Validators queued for next epoch */
  stagingset: ValidatorPublicKeys[]
  /** 8. Active validator set (κ) - Chapter C(8): Currently active validators */
  activeset: ValidatorPublicKeys[]
  /** 9. Previous validator set (λ) - Chapter C(9): Previous epoch validators */
  previousset: ValidatorPublicKeys[]
  /** 10. Pending reports (ρ) - Chapter C(10): Work reports awaiting availability assurance */
  reports: Reports
  /** 11. Current time slot (τ) - Chapter C(11): Most recent block's timeslot index */
  thetime: bigint
  /** 12. Authorization queue (χ) - Chapter C(2): Queued core authorizations */
  authqueue: AuthQueue
  /** 13. Privileges - Chapter C(12): Services with special privileges */
  privileges: Privileges
  /** 14. Disputes (ψ) - Chapter C(5): Judgments on work-reports and validators */
  disputes: Disputes
  /** 15. Activity (π) - Chapter C(13): Validator performance statistics */
  activity: Activity
  /** 16. Ready work-reports (ω) - Chapter C(14): Reports ready for accumulation */
  ready: Ready
  /** 17. Accumulated packages (ξ) - Chapter C(15): Recently accumulated work-packages */
  accumulated: Accumulated
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * State transition function type
 * Maps prior state + block → posterior state
 */
export type StateTransition = (
  priorState: GlobalState,
  header: BlockHeader,
  extrinsics: BlockBody,
) => GlobalState

/**
 * Block header
 * @param parent - H_parent
 * @param priorStateRoot - H_priorstateroot
 * @param extrinsicHash - H_extrinsichash
 * @param timeslot - H_timeslot
 * @param epochMark - H_epochmark
 * @param winnersMark - H_winnersmark
 * @param offendersMark - H_offendersmark
 * @param authorIndex - H_authorindex
 * @param vrfSig - H_vrfsig -> same as "entropy_source" in documentation
 * @param sealSig - H_sealsig
 */
export interface BlockHeader {
  parent: Hex // ✅ H_parent
  priorStateRoot: Hex // ✅ H_priorstateroot
  extrinsicHash: Hex // ✅ H_extrinsichash
  timeslot: bigint // ✅ H_timeslot
  epochMark: EpochMark | null // ✅ H_epochmark
  winnersMark: SafroleTicketWithoutProof[] | null // ✅ H_winnersmark (Gray Paper: tuple{st_id, st_entryindex} - no proof)
  offendersMark: Hex[] // ✅ H_offendersmark
  authorIndex: bigint // ✅ H_authorindex
  vrfSig: Hex // ✅ H_vrfsig
  sealSig: Hex // ✅ H_sealsig
}

export type UnsignedBlockHeader = Omit<BlockHeader, 'sealSig'>

/**
 * Epoch mark (when present)
 */
export interface EpochMark {
  entropyAccumulator: Hex
  entropy1: Hex
  validators: ValidatorKeyPair[]
}

/**
 * State validation result
 */
export interface StateValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * State transition validation
 */
export type StateValidator = (
  prior: GlobalState,
  posterior: GlobalState,
  header: BlockHeader,
) => StateValidationResult
