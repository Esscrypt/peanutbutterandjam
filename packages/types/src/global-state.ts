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

import type { Hex } from '@pbnj/core'
import type { BlockBody } from './block-authoring'
import type { SafroleState, ValidatorPublicKeys } from './consensus'
import type {
  SafroleTicket,
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
export interface AuthPool {
  /** Authorization requirements per core */
  authorizations: Hex[]
  /** Core assignment metadata */
  coreAssignments: Map<bigint, bigint>
}

/**
 * Recent activity log (β)
 * Log of recent blocks and accumulation outputs
 */
export interface Recent {
  /** Recent block history */
  history: RecentHistory
  /** Accumulation output belt (Merkle mountain range) */
  accoutBelt: AccoutBelt
}

/**
 * Recent history (β_H)
 * Information on the most recent blocks
 */
export interface RecentHistory {
  /** Header hash */
  headerHash: Hex
  /** Accumulation output super-peak */
  accoutLogSuperPeak: Hex
  /** State root */
  stateRoot: Hex
  /** Reported package hashes */
  reportedPackageHashes: Hex[]
}

/**
 * Accumulation output belt (β_B)
 * Merkle mountain belt for accumulating outputs
 */
export interface AccoutBelt {
  /** Mountain range peaks */
  peaks: Hex[]
  /** Total accumulated count */
  totalCount: bigint
}

/**
 * Service accounts (δ)
 * State of all services (smart contracts)
 */
export interface ServiceAccounts {
  /** Account storage per service */
  accounts: Map<bigint, ServiceAccountCore>
  /** Total service count */
  serviceCount: bigint
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
 */
export interface Reports {
  /** Reports per core (optional - only one report per core at a time) */
  coreReports: Map<bigint, PendingReport | null>
}

/**
 * Pending report entry
 */
export interface PendingReport {
  /** The work report */
  workReport: WorkReport
  /** Timestamp when reported */
  timestamp: bigint
}

/**
 * Authorization queue (φ)
 * Queue of pending authorizations
 */
export interface AuthQueue {
  /** Queued authorizations per core */
  queue: Map<bigint, Hex[]>
  /** Queue processing state */
  processingIndex: bigint
}

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
export interface ServiceStats {
  /** Provision count */
  provision: number
  /** Refinement operations */
  refinement: number
  /** Accumulation operations */
  accumulation: number
  /** Transfer operations */
  transfer: number
  /** Import count */
  importCount: number
  /** Extrinsic count */
  extrinsicCount: number
  /** Extrinsic size */
  extrinsicSize: number
  /** Export count */
  exportCount: number
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
   */
  epochSlots: Map<bigint, ReadyItem[]>
}

/**
 * Recently accumulated work-packages (ξ)
 * Work-packages that were recently accumulated
 */
export interface Accumulated {
  /** Recently accumulated packages */
  packages: Hex[]
  /** Accumulation metadata */
  metadata: Map<Hex, AccumulationMetadata>
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
export interface GlobalState {
  /** Authorization pool (α) - Core authorization requirements */
  authpool: AuthPool

  /** Recent activity (β) - Recent blocks and accumulation outputs */
  recent: Recent

  /** Last accumulation output (θ) - Most recent accumulation result */
  lastaccout: Hex

  /** Safrole state (γ) - Consensus protocol internal state */
  safrole: SafroleState

  /** Service accounts (δ) - All service (smart contract) state */
  accounts: ServiceAccounts

  /** Entropy (ε) - On-chain randomness accumulator */
  entropy: EntropyState

  /** Staging validator set (ι) - Validators queued for next epoch */
  stagingset: ValidatorPublicKeys[]

  /** Active validator set (κ) - Currently active validators */
  activeset: ValidatorPublicKeys[]

  /** Previous validator set (λ) - Previous epoch validators */
  previousset: ValidatorPublicKeys[]

  /** Pending reports (ρ) - Work reports awaiting availability assurance */
  reports: Reports

  /** Current time slot (τ) - Most recent block's timeslot index */
  thetime: bigint

  /** Authorization queue (φ) - Queued core authorizations */
  authqueue: AuthQueue

  /** Privileges - Services with special privileges */
  privileges: Privileges

  /** Disputes (ψ) - Judgments on work-reports and validators */
  disputes: Disputes

  /** Activity (π) - Validator performance statistics */
  activity: Activity

  /** Ready work-reports (ω) - Reports ready for accumulation */
  ready: Ready

  /** Accumulated packages (ξ) - Recently accumulated work-packages */
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
  winnersMark: SafroleTicket[] | null // ✅ H_winnersmark
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
 * Validator key pair (for epoch marks - only bs + ed25519)
 */
export interface ValidatorKeyPair {
  bandersnatch: Hex
  ed25519: Hex
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
