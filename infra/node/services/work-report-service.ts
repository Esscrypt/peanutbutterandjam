/**
 * Work Report Service
 *
 * Unified service for managing all work reports throughout their lifecycle.
 * Combines state management (Gray Paper reports component) with storage and tracking.
 *
 * Gray Paper Reference: reporting_assurance.tex (Equation 18-23)
 * reports ∈ sequence[Ccorecount]{optional{tup{workreport, timestamp}}}
 *
 * Responsibilities:
 * 1. State Management: Track pending reports per core (Gray Paper state component)
 * 2. Storage: Persist and cache work reports by hash
 * 3. Lifecycle Tracking: Monitor work report state transitions
 * 4. Retrieval: Provide access to work reports by hash or core index
 */

import {
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import { verifyWorkReportDistributionSignature } from '@pbnj/guarantor'
import type { WorkReportRequestProtocol } from '@pbnj/networking'
import { calculateWorkReportHash } from '@pbnj/serialization'
import type { WorkStore } from '@pbnj/state'
import {
  BaseService,
  type GuaranteedWorkReport,
  type PendingReport,
  type Reports,
  TIME_CONSTANTS,
  type ValidatorPublicKeys,
  type WorkReport,
  type WorkReportRequest,
  type WorkReportResponse,
} from '@pbnj/types'
import type { NetworkingService } from './networking-service'
import type { ValidatorSetManager } from './validator-set'

/**
 * Work Report State according to Gray Paper lifecycle
 */
export type WorkReportState =
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
 * Work Report Service Interface
 */
export interface IWorkReportService {
  // ===== State Component Operations (Gray Paper reports) =====

  /**
   * Get current reports state component
   * Gray Paper: reports ∈ sequence[Ccorecount]{optional{tup{workreport, timestamp}}}
   */
  getReports(): Reports

  /**
   * Set reports state component
   * Gray Paper: reports ∈ sequence[Ccorecount]{optional{tup{workreport, timestamp}}}
   */
  setReports(reports: Reports): Promise<void>

  /**
   * Get pending report for a specific core
   * Gray Paper: Each core can have at most one pending work report
   */
  getCoreReport(coreIndex: bigint): PendingReport | null

  /**
   * Add work report to pending state for a core
   * Transitions report to 'reported' state
   */
  addWorkReport(
    coreIndex: bigint,
    workReport: WorkReport,
    timestamp: bigint,
  ): Promise<Safe<Hex>>

  /**
   * Remove work report from pending state (became available or timed out)
   */
  removeWorkReport(coreIndex: bigint): void

  /**
   * Clear all pending reports
   */
  clearAllReports(): void

  // ===== Storage & Retrieval Operations =====

  /**
   * Store a guaranteed work report (from networking protocol)
   * Does NOT add to pending state - use addWorkReport for that
   */
  storeGuaranteedWorkReport(
    workReport: WorkReport,
    state: WorkReportState,
  ): Promise<Safe<Hex>>

  /**
   * Get work report by hash
   */
  getWorkReportByHash(hash: Hex): WorkReport | null

  /**
   * Get all work reports for a specific core (all states)
   */
  getWorkReportsForCore(coreIndex: bigint): WorkReport[]

  // ===== Lifecycle Management =====

  /**
   * Update work report state
   */
  updateWorkReportState(hash: Hex, newState: WorkReportState): Safe<void>

  /**
   * Record assurance for a work report
   */
  recordAssurance(hash: Hex): Safe<void>

  /**
   * Mark work report as having supermajority (2/3 assurances)
   */
  markAsAvailable(hash: Hex): Safe<void>

  // ===== Query Operations =====

  /**
   * Get all work reports in a specific state
   */
  getWorkReportsByState(state: WorkReportState): WorkReport[]

  /**
   * Get work reports that have timed out
   */
  getTimedOutReports(currentSlot: bigint): WorkReport[]

  /**
   * Get statistics
   */
  getStats(): {
    totalReports: number
    reportsByState: Map<WorkReportState, number>
    coresWithPendingReports: number
    reportsWithSupermajority: number
  }
}

/**
 * Work Report Service Implementation
 */
export class WorkReportService
  extends BaseService
  implements IWorkReportService
{
  // Extended storage: all work reports by hash (for full lifecycle tracking)
  private readonly workReportsByHash: Map<Hex, WorkReport> = new Map()

  // work report assurance count by work report hash
  private readonly assuranceCountByCoreIndex: Map<bigint, number> = new Map()

  // Index: work reports by core (for quick lookup of all reports on a core)
  private readonly workReportHashByCore: Map<bigint, Hex> = new Map()

  private readonly workReportState: Map<Hex, WorkReportState> = new Map()

  private readonly workReportReportedAtSlot: Map<Hex, bigint> = new Map()

  private readonly workStore: WorkStore
  private readonly eventBus: EventBusService
  private readonly networkingService: NetworkingService
  private readonly ce136WorkReportRequestProtocol: WorkReportRequestProtocol
  private readonly validatorSetManager: ValidatorSetManager

  constructor(options: {
    workStore: WorkStore
    eventBus: EventBusService
    networkingService: NetworkingService
    ce136WorkReportRequestProtocol: WorkReportRequestProtocol
    validatorSetManager: ValidatorSetManager
  }) {
    super('work-report-service')
    this.workStore = options.workStore
    this.eventBus = options.eventBus
    this.networkingService = options.networkingService
    this.ce136WorkReportRequestProtocol = options.ce136WorkReportRequestProtocol
    this.validatorSetManager = options.validatorSetManager
    // Initialize state indexes

    this.eventBus.addWorkReportRequestCallback(
      this.handleWorkReportRequest.bind(this),
    )

    this.eventBus.addWorkReportResponseCallback(
      this.handleWorkReportResponse.bind(this),
    )

    this.eventBus.addWorkReportDistributionRequestCallback(
      this.handleWorkReportDistributionRequest.bind(this),
    )
  }

  // ===== State Component Operations =====

  /**
   * Get Gray Paper reports state component
   *
   * Constructs the reports state on-demand from work reports in 'reported' state.
   * Gray Paper: reports ∈ sequence[Ccorecount]{optional{tup{workreport, timestamp}}}
   *
   * Only includes work reports that are currently in 'reported' state and pending
   * availability assurance.
   */
  getReports(): Reports {
    // Initialize array of length Ccorecount (341) with null values
    const coreReports: (PendingReport | null)[] = new Array(341).fill(null)

    // Get all work reports in 'reported' state
    const reportedHashes = this.workReportHashByCore.values()

    // Build the core reports array
    for (const hash of reportedHashes) {
      const entry = this.workReportsByHash.get(hash)
      if (entry && this.workReportReportedAtSlot.get(hash) !== undefined) {
        const coreIndex = Number(entry.core_index)
        if (coreIndex >= 0 && coreIndex < 341) {
          coreReports[coreIndex] = {
            workReport: entry,
            timeslot: Number(this.workReportReportedAtSlot.get(hash)!),
          }
        }
      }
    }

    return { coreReports }
  }

  handleWorkReportRequest(
    request: WorkReportRequest,
    peerPublicKey: Hex,
  ): void {
    // check if we have the work report in our state
    const entry = this.workReportsByHash.get(request.workReportHash)
    if (!entry) {
      logger.error('Work report not found', {
        workReportHash: request.workReportHash,
      })
      return
    }
    const [messageError, message] =
      this.ce136WorkReportRequestProtocol.serializeResponse({
        workReport: entry,
      })
    if (messageError) {
      logger.error('Failed to serialize work report request', {
        error: messageError.message,
      })
      return
    }
    this.networkingService.sendMessageByPublicKey(peerPublicKey, 136, message)
  }

  handleWorkReportResponse(
    response: WorkReportResponse,
    _peerPublicKey: Hex,
  ): void {
    this.storeGuaranteedWorkReport(response.workReport, 'guaranteed')
  }

  handleWorkReportDistributionRequest(
    request: GuaranteedWorkReport,
    _peerPublicKey: Hex,
  ): Safe<void> {
    const [hashError, workReportHash] = calculateWorkReportHash(
      request.workReport,
    )
    if (hashError) {
      return safeError(hashError)
    }

    // Step 2: Validate guarantee signatures
    // Gray Paper: Must have 2-3 valid signatures from assigned guarantors
    const guaranteeSignatures = request.signatures.map((sig) => ({
      validator_index: Number(sig.validatorIndex),
      signature: sig.signature,
    }))

    // get validator keys from request indexes
    const validatorKeys = new Map<number, ValidatorPublicKeys>()
    const coreAssignments = new Map<number, number>()

    for (const sig of guaranteeSignatures) {
      const [validatorKeyError, validatorKey] =
        this.validatorSetManager.getValidatorAtIndex(sig.validator_index)
      if (validatorKeyError) {
        logger.error('Failed to get validator key', {
          error: validatorKeyError.message,
        })
        continue
      }
      validatorKeys.set(sig.validator_index, validatorKey)
      // find core index for validator
      const [coreIndexError, coreIndex] =
        this.validatorSetManager.getAssignedCore(sig.validator_index)
      if (coreIndexError) {
        logger.error('Failed to get core index', {
          error: coreIndexError.message,
        })
        continue
      }
      coreAssignments.set(sig.validator_index, coreIndex)

      // Verify individual signature for work report distribution
      const [validationError, isValid] = verifyWorkReportDistributionSignature(
        request.workReport,
        sig,
        hexToBytes(validatorKey.ed25519),
      )

      if (validationError) {
        return safeError(validationError)
      }

      if (!isValid) {
        return safeError(
          new Error(`Invalid signature for validator ${sig.validator_index}`),
        )
      }
    }

    // Step 3: Store the work report
    // Store in local cache
    this.workReportsByHash.set(workReportHash, {
      workReport: request.workReport,
      state: 'guaranteed',
      hash: workReportHash,
      coreIndex: request.workReport.core_index,
      receivedAt: BigInt(Date.now()),
      assuranceCount: 0,
      hasSupermajority: false,
    })
    this.addToIndexes(
      workReportHash,
      request.workReport.core_index,
      'guaranteed',
    )

    // Store in WorkReportService (handles both storage and state tracking)
    const [storeError] = this.storeGuaranteedWorkReport(
      request.workReport,
      'guaranteed', // Mark as guaranteed since it has valid signatures
    )
    if (storeError) {
      logger.error('Failed to store work report in WorkReportService', {
        workReportHash,
        error: storeError.message,
      })
      return safeError(storeError)
    }

    logger.info('Work report stored successfully', {
      workReportHash,
      coreIndex: request.workReport.core_index.toString(),
      slot: request.slot.toString(),
      guarantorCount: guaranteeSignatures.length,
    })

    return safeResult(undefined)
  }

  /**
   * Get pending report for a specific core
   *
   * Returns the work report in 'reported' state for the given core, if any.
   */
  getCoreReport(coreIndex: bigint): PendingReport | null {
    // Get all work reports in 'reported' state for this core
    const workReportHash = this.workReportHashByCore.get(coreIndex)
    if (!workReportHash) {
      return null
    }
    const workReport = this.workReportsByHash.get(workReportHash)
    if (!workReport) {
      return null
    }
    const reportedAt = this.workReportReportedAtSlot.get(workReportHash)
    if (!reportedAt) {
      return null
    }
    return {
      workReport: workReport,
      timeslot: Number(reportedAt),
    }
  }

  async addWorkReport(
    coreIndex: bigint,
    workReport: WorkReport,
    timestamp: bigint,
  ): Promise<Safe<Hex>> {
    // Calculate hash
    const [hashError, hash] = calculateWorkReportHash(workReport)
    if (hashError) {
      return safeError(hashError)
    }

    this.workReportHashByCore.set(coreIndex, hash)

    // Update existing entry
    this.workReportState.set(hash, 'reported')
    this.workReportReportedAtSlot.set(hash, timestamp)

    // Persist to database
    const [storeError] = await this.workStore.storeWorkReport(
      workReport,
      hash,
      'pending',
    )
    if (storeError) {
      logger.error('Failed to persist work report to database', {
        hash,
        error: storeError.message,
      })
      // Don't fail the operation if DB fails - we still have it in memory
    }

    return safeResult(hash)
  }

  // ===== Storage & Retrieval Operations =====

  async storeGuaranteedWorkReport(
    workReport: WorkReport,
    state: WorkReportState = 'guaranteed',
  ): Promise<Safe<Hex>> {
    const [hashError, hash] = calculateWorkReportHash(workReport)
    if (hashError) {
      return safeError(hashError)
    }

    const coreIndex = BigInt(workReport.core_index)

    // Check if already exists
    const existingEntry = this.workReportsByHash.get(hash)
    if (existingEntry) {
      logger.debug('Work report already stored', { hash })
      return safeResult(hash)
    }

    this.workReportHashByCore.set(coreIndex, hash)
    this.workReportState.set(hash, state)

    // Persist to database
    // not awaited on purpose
    void this.workStore.storeWorkReport(
      workReport,
      hash,
      state === 'guaranteed' ? 'guaranteed' : undefined,
    )

    return safeResult(hash)
  }

  getWorkReportByHash(hash: Hex): WorkReport | null {
    return this.workReportsByHash.get(hash) || null
  }

  getWorkReportForCore(coreIndex: bigint): WorkReport | null {
    const hash = this.workReportHashByCore.get(coreIndex)
    if (!hash) {
      return null
    }
    return this.workReportsByHash.get(hash) || null
  }

  // ===== Lifecycle Management =====

  recordAssurance(hash: Hex): Safe<void> {
    const entry = this.workReportsByHash.get(hash)
    if (!entry) {
      return safeError(new Error(`Work report not found: ${hash}`))
    }

    this.assuranceCountByCoreIndex.set(
      entry.core_index,
      (this.assuranceCountByCoreIndex.get(entry.core_index) || 0) + 1,
    )
    return safeResult(undefined)
  }

  markAsAvailable(hash: Hex): Safe<void> {
    const entry = this.workReportsByHash.get(hash)
    if (!entry) {
      return safeError(new Error(`Work report not found: ${hash}`))
    }

    this.workReportState.set(hash, 'available')

    return safeResult(undefined)
  }

  // ===== Query Operations =====

  // mark as timed out
  markAsTimedOut(slot: bigint): Safe<void> {
    this.workReportReportedAtSlot.entries().forEach(([hash, reportedSlot]) => {
      if (
        slot >=
        reportedSlot + BigInt(TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD)
      ) {
        this.workReportState.set(hash, 'timed_out')
        // this.workReportHashByCore.delete(hash)
      }
    })
    return safeResult(undefined)
  }
}
