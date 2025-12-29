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

import { calculateWorkReportHash } from '@pbnjam/codec'
import {
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
} from '@pbnjam/core'
import {
  getAssignedCore,
  verifyWorkReportDistributionSignature,
} from '@pbnjam/guarantor'
import type { WorkReportRequestProtocol } from '@pbnjam/networking'
import {
  BaseService,
  type GuaranteedWorkReport,
  type PendingReport,
  type Reports,
  type Safe,
  safeError,
  safeResult,
  type ValidatorPublicKeys,
  type WorkReport,
  type WorkReportRequest,
  type WorkReportResponse,
} from '@pbnjam/types'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { EntropyService } from './entropy'
import type { NetworkingService } from './networking-service'
import type { ValidatorSetManager } from './validator-set'

/**
 * Work Report State according to Gray Paper lifecycle
 */
export type WorkReportState =
  | 'pending' // Work report is pending, meaning it has not been assured yet
  | 'evaluating' // Guarantor is computing work-report
  | 'guaranteed' // Work-report signed, guarantee created
  | 'erasure_coded' // Erasure coded and distributed to validators
  | 'assured' // Availability assured by validators
  | 'available' // Available and ready for accumulation
  | 'accumulated' // Accumulated into service state
  | 'timed_out' // Failed to become available in time
  | 'rejected' // Failed validation or authorization

/**
 * Work Report Service Implementation
 */
export class WorkReportService extends BaseService {
  // According to Gray Paper: For each guaranteed work report, we need to know
  // which core it belongs to and which authorizer was used
  private readonly authorizerHashByCore: Map<number, Hex> = new Map()

  // Extended storage: all work reports by hash (for full lifecycle tracking)
  private readonly workReportsByHash: Map<Hex, WorkReport> = new Map()

  // Index: work reports by core (for quick lookup of all reports on a core)
  private readonly workReportHashByCore: Map<bigint, Hex> = new Map()

  private readonly workReportState: Map<Hex, WorkReportState> = new Map()

  // Index: pending work reports by core
  // Gray Paper: only one report may be assigned to a core at any given time
  private readonly pendingWorkReports: Map<bigint, PendingReport | null> =
    new Map()

  private readonly eventBus: EventBusService
  private readonly networkingService: NetworkingService | null
  private readonly ce136WorkReportRequestProtocol: WorkReportRequestProtocol | null
  private readonly validatorSetManager: ValidatorSetManager | null
  private readonly configService: ConfigService
  private readonly entropyService: EntropyService | null
  private readonly clockService: ClockService | null
  constructor(options: {
    eventBus: EventBusService
    networkingService: NetworkingService | null
    ce136WorkReportRequestProtocol: WorkReportRequestProtocol | null
    validatorSetManager: ValidatorSetManager | null
    configService: ConfigService
    entropyService: EntropyService | null
    clockService: ClockService | null
  }) {
    super('work-report-service')
    this.eventBus = options.eventBus
    this.networkingService = options.networkingService
    this.ce136WorkReportRequestProtocol = options.ce136WorkReportRequestProtocol
    this.validatorSetManager = options.validatorSetManager
    this.configService = options.configService
    this.entropyService = options.entropyService
    this.clockService = options.clockService
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

    this.pendingWorkReports = new Map<bigint, PendingReport | null>()
    for (let i = 0; i < this.configService.numCores; i++) {
      this.pendingWorkReports.set(BigInt(i), null)
    }
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
  getPendingReports(): Reports {
    // Initialize array of length Ccorecount (341) with null values
    const coreReports: (PendingReport | null)[] = new Array(
      this.configService.numCores,
    ).fill(null)

    for (const [
      coreIndex,
      pendingReport,
    ] of this.pendingWorkReports.entries()) {
      if (!pendingReport) {
        continue
      }
      coreReports[Number(coreIndex)] = pendingReport
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
    if (!this.ce136WorkReportRequestProtocol) {
      throw new Error('CE 136 work report request protocol not found')
    }
    if (!this.networkingService) {
      throw new Error('Networking service not found')
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
    this.storeGuaranteedWorkReport(response.workReport)
  }

  handleWorkReportDistributionRequest(
    request: GuaranteedWorkReport,
    _peerPublicKey: Hex,
  ): Safe<void> {
    if (!this.validatorSetManager) {
      throw new Error('Validator set manager not found')
    }
    if (!this.entropyService) {
      throw new Error('Entropy service not found')
    }
    if (!this.clockService) {
      throw new Error('Clock service not found')
    }
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
      const entropy2 = this.entropyService.getEntropy2()
      const currentSlot = this.clockService.getCurrentSlot()
      // find core index for validator
      const [coreIndexError, coreIndex] = getAssignedCore(
        sig.validator_index,
        entropy2,
        currentSlot,
        this.configService,
      )
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
    this.workReportsByHash.set(workReportHash, request.workReport)

    // Store in WorkReportService (handles both storage and state tracking)
    const [storeError] = this.storeGuaranteedWorkReport(request.workReport)
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
    return this.pendingWorkReports.get(coreIndex) || null
  }

  setPendingReports(reports: Reports): void {
    for (const [coreIndex, report] of reports.coreReports.entries()) {
      if (report) {
        this.addPendingWorkReport(
          BigInt(coreIndex),
          report.workReport,
          report.timeslot,
        )
      } else {
        // clear the pending work report for this core if it exists
        if (this.pendingWorkReports.has(BigInt(coreIndex))) {
          this.pendingWorkReports.delete(BigInt(coreIndex))
        }
      }
    }
  }

  addPendingWorkReport(
    coreIndex: bigint,
    workReport: WorkReport,
    timeslot: number,
  ): Safe<Hex> {
    // Calculate hash
    const [hashError, hash] = calculateWorkReportHash(workReport)
    if (hashError) {
      return safeError(hashError)
    }

    this.workReportHashByCore.set(coreIndex, hash)

    // Update existing entry
    if (!this.pendingWorkReports.get(coreIndex)) {
      this.pendingWorkReports.set(coreIndex, {
        workReport: workReport,
        timeslot: timeslot,
      })
    }

    return safeResult(hash)
  }

  // ===== Storage & Retrieval Operations =====

  storeGuaranteedWorkReport(workReport: WorkReport): Safe<Hex> {
    const [hashError, hash] = calculateWorkReportHash(workReport)
    if (hashError) {
      return safeError(hashError)
    }

    const coreIndex = workReport.core_index

    // Check if already exists
    const existingEntry = this.workReportsByHash.get(hash)
    if (existingEntry) {
      logger.debug('Work report already stored', { hash })
      return safeResult(hash)
    }

    this.workReportHashByCore.set(coreIndex, hash)
    this.workReportState.set(hash, 'guaranteed')

    // remove from pending work reports
    this.pendingWorkReports.delete(coreIndex)

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

  removePendingWorkReport(coreIndex: bigint): Safe<void> {
    this.pendingWorkReports.delete(coreIndex)
    return safeResult(undefined)
  }

  /**
   * Clear work report core mapping to allow core reuse
   *
   * Gray Paper: When a work report is included in a guarantee, we need to allow
   * the core to be reused for future guarantees. However, the work report should
   * remain in pendingWorkReports (reports state) until it receives super-majority
   * assurance or times out.
   *
   * This method only clears the core mapping, not the pending reports entry.
   * The pending reports entry is cleared by applyAssurances when:
   * 1. The work report receives super-majority assurance (> 2/3 validators)
   * 2. The work report times out (exceeds C_assurancetimeoutperiod)
   *
   * @param coreIndex - Core index to clear from mapping
   */
  clearWorkReportCoreMapping(coreIndex: bigint): Safe<void> {
    // Remove from core mapping to allow core reuse
    // Note: We do NOT remove from pendingWorkReports here - that's done by applyAssurances
    // when the work report becomes available (super-majority) or times out
    this.workReportHashByCore.delete(coreIndex)

    return safeResult(undefined)
  }

  setAuthorizerHashByCore(coreIndex: number, authorizerHash: Hex): void {
    this.authorizerHashByCore.set(coreIndex, authorizerHash)
  }

  getAuthorizerHashByCore(coreIndex: number): Hex | null {
    return this.authorizerHashByCore.get(coreIndex) || null
  }

  /**
   * Check if a core has an available work report
   * A core is engaged if it has either a pending or available report
   *
   * Note: This checks the core mapping, not pendingWorkReports, because
   * we clear the core mapping after processing guarantees to allow reuse,
   * but keep the work report in pendingWorkReports until it's assured or times out.
   */
  hasAvailableReport(coreIndex: bigint): boolean {
    // Check if core mapping exists (core is engaged)
    return this.workReportHashByCore.has(coreIndex)
  }

  /**
   * Mark a work report as available
   *
   * Gray Paper Reference: reporting_assurance.tex
   * When guarantees are processed, [[work reports]] become available
   *
   * @param workReport - The work report to mark as available
   * @param timeout - The timeout slot when this report expires
   */
  markAsAvailable(workReport: WorkReport, timeout: bigint): Safe<void> {
    const [hashError, hash] = calculateWorkReportHash(workReport)
    if (hashError) {
      return safeError(hashError)
    }

    const coreIndex = workReport.core_index

    // Store work report by hash if not already stored
    if (!this.workReportsByHash.has(hash)) {
      this.workReportsByHash.set(hash, workReport)
    }

    // Store work report by core index for quick lookup
    this.workReportHashByCore.set(coreIndex, hash)

    // Update state to available
    this.workReportState.set(hash, 'available')

    // Gray Paper: Work reports in guarantees should be added to reports state (chapter 10)
    // The reports state contains work reports that are "reported" but awaiting availability assurance
    // Add to pending reports so it appears in the state (will be removed when it becomes available to super-majority or times out)
    this.pendingWorkReports.set(coreIndex, {
      workReport: workReport,
      timeslot: Number(timeout),
    })

    return safeResult(undefined)
  }
}
