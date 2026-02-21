/**
 * Statistics Service
 *
 * Implements Gray Paper Section: Statistics (π)
 *
 * Gray Paper Reference: graypaper/text/statistics.tex
 *
 * This service tracks validator, core, and service activity statistics
 * according to the formal specifications in the Gray Paper equations (44-188).
 *
 * Key Components:
 * - Validator Statistics (π_V): Per-epoch tracking of 6 metrics
 * - Core Statistics (π_C): Per-block tracking of 8 metrics
 * - Service Statistics (π_S): Per-block tracking of 7 metrics
 *
 * Update Triggers:
 * - Block processing: Updates all statistics based on block content
 * - Epoch transitions: Rolls over validator statistics accumulator
 * - Work report processing: Updates core/service statistics
 * - Extrinsic processing: Updates validator statistics
 */

import {
  type BlockProcessedEvent,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
  type RevertEpochTransitionEvent,
} from '@pbnjam/core'
import type {
  Activity,
  Assurance,
  BlockBody,
  CoreStats,
  Preimage,
  Safe,
  ServiceStats,
  ValidatorStats,
  WorkReport,
} from '@pbnjam/types'
import { BaseService, SEGMENT_CONSTANTS, safeResult } from '@pbnjam/types'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'

// ============================================================================
// Statistics Service
// ============================================================================

/**
 * Statistics Service
 *
 * Implements Gray Paper statistics tracking with full compliance to
 * equations (44-188) for validator, core, and service statistics.
 */
export class StatisticsService extends BaseService {
  private activity: Activity
  private readonly eventBusService: EventBusService
  private readonly configService: ConfigService
  // Store state before epoch transition for revert
  private preTransitionActivity: Activity | null = null

  constructor(options: {
    eventBusService: EventBusService
    configService: ConfigService
    clockService: ClockService
  }) {
    super('statistics-service')
    this.eventBusService = options.eventBusService
    // this.clockService = options.clockService
    this.configService = options.configService

    this.activity = {
      validatorStatsAccumulator: this.createEmptyValidatorStats(),
      validatorStatsPrevious: this.createEmptyValidatorStats(),
      coreStats: this.createEmptyCoreStats(),
      serviceStats: new Map(),
    }

    // Register epoch transition handler in constructor to ensure it's always active
    // This MUST happen BEFORE any validator stats are updated (like guarantees)
    // The epoch transition event is emitted early in block processing, before guarantees
    this.eventBusService.addEpochTransitionCallback(
      this.handleEpochTransition.bind(this),
    )
    this.eventBusService.addRevertEpochTransitionCallback(
      this.handleRevertEpochTransition.bind(this),
    )
  }

  override start(): Safe<boolean> {
    // Register event handlers
    this.eventBusService.addBlockProcessedCallback(
      this.handleBlockProcessed.bind(this),
    )

    return safeResult(true)
  }

  override stop(): Safe<boolean> {
    logger.info('Statistics service stopped')
    return safeResult(true)
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle block processing event
   * Updates all statistics based on block content
   *
   * Gray Paper Reference: Equations (44-68) for validator stats
   */
  private async handleBlockProcessed(
    event: BlockProcessedEvent,
  ): Promise<Safe<void>> {
    // Apply block-derived deltas (this will also update core and service statistics)
    this.applyBlockDeltas(event.body, event.slot, event.authorIndex)

    return safeResult(undefined)
  }

  // Explicit epoch transition handler removed; handled within handleBlockProcessed

  // ============================================================================
  // Public API - Getters
  // ============================================================================

  /**
   * Get current activity state
   */
  getActivity(): Activity {
    return this.activity
  }

  /**
   * Set activity state (for pre-state initialization)
   */
  setActivity(activity: Activity): void {
    this.activity = activity
  }

  /**
   * Get validator statistics for current epoch
   */
  getValidatorStatsAccumulator(): ValidatorStats[] {
    return this.activity.validatorStatsAccumulator
  }

  /**
   * Get validator statistics for previous epoch
   */
  getValidatorStatsPrevious(): ValidatorStats[] {
    return this.activity.validatorStatsPrevious
  }

  /**
   * Get validator statistics for specific validator
   */
  getValidatorStats(
    validatorIndex: number,
    usePrevious = false,
  ): ValidatorStats | null {
    const stats = usePrevious
      ? this.activity.validatorStatsPrevious
      : this.activity.validatorStatsAccumulator

    return stats[validatorIndex] || null
  }

  /**
   * Get core statistics
   */
  getCoreStats(): CoreStats[] {
    return this.activity.coreStats
  }

  /**
   * Get core statistics for specific core
   */
  getCoreStatsForCore(coreIndex: number): CoreStats | null {
    return this.activity.coreStats[coreIndex] || null
  }

  /**
   * Get service statistics
   */
  getServiceStats(): Map<bigint, ServiceStats> {
    return this.activity.serviceStats
  }

  /**
   * Reset all accumulated statistics between fuzzer traces so that service-stat
   * entries from a previous trace do not bleed into the next one.
   */
  resetForFuzzer(): void {
    this.activity = {
      validatorStatsAccumulator: this.createEmptyValidatorStats(),
      validatorStatsPrevious: this.createEmptyValidatorStats(),
      coreStats: this.createEmptyCoreStats(),
      serviceStats: new Map(),
    }
    this.preTransitionActivity = null
  }

  /**
   * Get service statistics for specific service
   */
  getServiceStatsForService(serviceId: bigint): ServiceStats | null {
    return this.activity.serviceStats.get(serviceId) || null
  }

  /**
   * Update accumulation statistics for a service
   *
   * Gray Paper: accumulation = ifnone{accumulationstatistics[s], tuple{0, 0}}
   * This method is called by AccumulationService to update serviceStats.accumulation
   * for services that have been successfully accumulated.
   *
   * @param serviceId - Service ID to update
   * @param accumulationStats - Accumulation statistics tuple{count, gas}
   */
  updateServiceAccumulationStats(
    serviceId: bigint,
    accumulationStats: [number, number],
  ): void {
    let serviceStats = this.activity.serviceStats.get(serviceId)
    if (!serviceStats) {
      // Create new serviceStats entry if it doesn't exist
      serviceStats = {
        provision: [0, 0], // tuple{N, N} - [count, size]
        refinement: [0, 0], // tuple{N, gas} - [count, gas]
        // accumulation is not initialized here - only set by AccumulationService
        importCount: 0,
        extrinsicCount: 0,
        extrinsicSize: 0,
        exportCount: 0,
      }
      this.activity.serviceStats.set(serviceId, serviceStats)
    }

    // Gray Paper: accumulation = accumulationstatistics[s]
    serviceStats.accumulation = accumulationStats
  }

  /**
   * Update onTransfers statistics for a service (only for versions < 0.7.1)
   * These fields are preserved if they exist from decoded state, but only updated
   * if the JAM version supports them.
   *
   * @param serviceId - Service ID to update
   * @param onTransfersStats - OnTransfers statistics tuple{count, gas}
   */
  updateServiceOnTransfersStats(
    serviceId: bigint,
    onTransfersStats: [number, number],
  ): void {
    if (!this.activity.serviceStats.has(serviceId)) {
      logger.warn(
        'updateServiceOnTransfersStats called for non-existent service',
        { serviceId },
      )
      return
    }

    const serviceStats = this.activity.serviceStats.get(serviceId)
    if (!serviceStats) {
      logger.warn(
        'updateServiceOnTransfersStats called for service with no stats',
        { serviceId },
      )
      return
    }

    // Only set onTransfers fields if they don't already exist (preserve from decoded state)
    // or if we're explicitly updating them
    serviceStats.onTransfersCount = onTransfersStats[0]
    serviceStats.onTransfersGasUsed = onTransfersStats[1]
  }

  /**
   * Update DA load statistics from available work reports
   *
   * Gray Paper equation (134-140): D(c) for each core c
   * D(c) = sum of (bundlelen + C_SEGMENTSIZE * ceil(segcount * 65/64))
   *
   * This method is called by AccumulationService after processing available reports.
   *
   * @param availableReports - Work reports that just became available
   */
  updateDaLoadFromAvailableReports(availableReports: WorkReport[]): void {
    const C_SEGMENTSIZE = SEGMENT_CONSTANTS.C_SEGMENTSIZE

    for (const report of availableReports) {
      const coreIdx = Number(report.core_index)
      if (coreIdx < 0 || coreIdx >= this.activity.coreStats.length) {
        continue
      }

      const coreStats = this.activity.coreStats[coreIdx]
      const bundleLen = Number(report.package_spec.length)
      const segCount = Number(report.package_spec.exports_count)

      // Calculate: bundlelen + C_SEGMENTSIZE * ceil(segcount * 65/64)
      // Gray Paper equation (134-140)
      const segLoad = Math.ceil((segCount * 65) / 64) * C_SEGMENTSIZE
      coreStats.daLoad += bundleLen + segLoad
    }
  }

  /**
   * Initialize activity from statistics pre_state
   */
  setActivityFromPreState(preState: {
    vals_curr_stats: Array<{
      blocks: number
      tickets: number
      pre_images: number
      pre_images_size: number
      guarantees: number
      assurances: number
    }>
    vals_last_stats: Array<{
      blocks: number
      tickets: number
      pre_images: number
      pre_images_size: number
      guarantees: number
      assurances: number
    }>
    cores_statistics?: Array<{
      da_load: number
      popularity: number
      imports: number
      extrinsic_count: number
      extrinsic_size: number
      exports: number
      bundle_size: number
      gas_used: number
    }>
    services_statistics?: Array<{
      id: number
      record: {
        provided_count: number
        provided_size: number
        refinement_count: number
        refinement_gas_used: number
        imports: number
        extrinsic_count: number
        extrinsic_size: number
        exports: number
        accumulate_count: number
        accumulate_gas_used: number
      }
    }>
  }): void {
    const mapToValidator = (s: {
      blocks: number
      tickets: number
      pre_images: number
      pre_images_size: number
      guarantees: number
      assurances: number
    }): ValidatorStats => ({
      blocks: s.blocks,
      tickets: s.tickets,
      preimageCount: s.pre_images,
      preimageSize: s.pre_images_size,
      guarantees: s.guarantees,
      assurances: s.assurances,
    })

    // Initialize core stats from pre_state if provided, otherwise empty
    let coreStats: CoreStats[]
    if (preState.cores_statistics) {
      coreStats = preState.cores_statistics.map((s) => ({
        daLoad: s.da_load,
        popularity: s.popularity,
        importCount: s.imports,
        extrinsicCount: s.extrinsic_count,
        extrinsicSize: s.extrinsic_size,
        exportCount: s.exports,
        bundleLength: s.bundle_size,
        gasUsed: s.gas_used,
      }))
      // Ensure array is the correct size (fill with empty stats if needed)
      while (coreStats.length < this.configService.numCores) {
        coreStats.push(this.createEmptyCoreStat())
      }
    } else {
      coreStats = this.createEmptyCoreStats()
    }

    // Initialize service stats from pre_state if provided, otherwise empty
    const serviceStats = new Map<bigint, ServiceStats>()
    if (preState.services_statistics) {
      for (const serviceStat of preState.services_statistics) {
        serviceStats.set(BigInt(serviceStat.id), {
          provision: [serviceStat.record.provided_count, 0], // tuple{N, N} - [count, size]
          refinement: [serviceStat.record.refinement_count, 0], // tuple{N, gas} - [count, gas]
          accumulation: [serviceStat.record.accumulate_count, 0], // tuple{N, gas} - [count, gas]
          importCount: serviceStat.record.imports,
          extrinsicCount: serviceStat.record.extrinsic_count,
          extrinsicSize: serviceStat.record.extrinsic_size,
          exportCount: serviceStat.record.exports,
        })
      }
    }

    this.activity = {
      validatorStatsAccumulator: preState.vals_curr_stats.map(mapToValidator),
      validatorStatsPrevious: preState.vals_last_stats.map(mapToValidator),
      coreStats,
      serviceStats,
    }
  }

  // ============================================================================
  // Private Implementation - Validator Statistics
  // ============================================================================

  /**
   * Update guarantee statistics based on reporters set
   *
   * Gray Paper equation 62-63: vs_guarantees += (activeset'[v] ∈ reporters)
   *
   * IMPORTANT: The reporters set contains ED25519 KEYS, not validator indices.
   * For cross-epoch guarantees, the validator_index in the signature refers to
   * the PREVIOUS epoch's validator set, but we need to credit the CURRENT epoch's
   * validator at each position. So we must:
   * 1. Accept the reporters set of ED25519 keys (computed by guarantor service)
   * 2. Accept the current active validators list
   * 3. Find which index in the current active set has each reporter's key
   * 4. Increment guarantees count for those indices
   *
   * @param reporterKeys - Set of ED25519 keys of validators who signed guarantees
   * @param activeValidators - Current epoch's active validator set (ordered list of { ed25519 } objects)
   */
  public updateGuarantees(
    reporterKeys: Hex[],
    activeValidators: Array<{ ed25519: Hex }>,
  ): void {
    // Build a lookup map: ED25519 key -> index in current active set
    const keyToIndex = new Map<Hex, number>()
    for (let i = 0; i < activeValidators.length; i++) {
      const validator = activeValidators[i]
      if (validator?.ed25519) {
        keyToIndex.set(validator.ed25519, i)
      }
    }

    // Track which indices to credit (use Set to ensure each validator gets +1 max)
    const indicesToCredit = new Set<number>()
    for (const key of reporterKeys) {
      const index = keyToIndex.get(key)
      if (index !== undefined) {
        indicesToCredit.add(index)
      } else {
        // Key not found in current active set - this could happen if:
        // 1. Validator was in previous set but not in current set (should be rare for tiny config)
        // 2. Key format mismatch
        logger.warn('Reporter key not found in current active set', {
          key: `${key.slice(0, 20)}...`,
          activeValidatorsCount: activeValidators.length,
        })
      }
    }

    // Increment guarantees count by 1 for each validator in the current active set
    // whose ED25519 key is in the reporters set
    for (const validatorIdx of indicesToCredit) {
      let validatorStats = this.activity.validatorStatsAccumulator[validatorIdx]
      if (!validatorStats) {
        validatorStats = this.createEmptyValidatorStat()
      }
      validatorStats.guarantees += 1
      this.activity.validatorStatsAccumulator[validatorIdx] = validatorStats
    }
  }

  /**
   * Reset per-block statistics (coreStats and serviceStats)
   * Must be called at the START of each block's processing, before accumulation
   *
   * Gray Paper: coreStats and serviceStats are per-block, not cumulative across blocks
   * Only validatorStats accumulate across the epoch
   */
  public resetPerBlockStats(): void {
    // Clear serviceStats completely - will be rebuilt from this block's activity
    this.activity.serviceStats.clear()

    // Reset coreStats metrics that are per-block (all except popularity which is set per-block anyway)
    for (let i = 0; i < this.activity.coreStats.length; i++) {
      this.activity.coreStats[i] = this.createEmptyCoreStat()
    }
  }

  /**
   * Handle epoch transition for validator statistics
   * Called by the event bus when an epoch transition occurs
   * This MUST happen BEFORE any validator stats are updated (like guarantees)
   * to ensure stats go into the correct epoch's accumulator
   */
  public handleEpochTransition(): void {
    // Save state before transition for potential revert
    this.preTransitionActivity = {
      validatorStatsAccumulator: [...this.activity.validatorStatsAccumulator],
      validatorStatsPrevious: [...this.activity.validatorStatsPrevious],
      coreStats: this.activity.coreStats.map((stats) => ({ ...stats })),
      serviceStats: new Map(this.activity.serviceStats),
    }

    this.activity = {
      ...this.activity,
      validatorStatsPrevious: [...this.activity.validatorStatsAccumulator],
      validatorStatsAccumulator: this.createEmptyValidatorStats(),
    }
  }

  /**
   * Handle revert epoch transition event
   * Restores activity to its state before the epoch transition
   */
  private handleRevertEpochTransition(event: RevertEpochTransitionEvent): void {
    if (!this.preTransitionActivity) {
      logger.warn(
        '[StatisticsService] No pre-transition activity to revert to',
        { slot: event.slot.toString() },
      )
      return
    }

    logger.info('[StatisticsService] Reverting epoch transition', {
      slot: event.slot.toString(),
    })

    // Restore previous activity state
    this.activity = {
      validatorStatsAccumulator: [
        ...this.preTransitionActivity.validatorStatsAccumulator,
      ],
      validatorStatsPrevious: [
        ...this.preTransitionActivity.validatorStatsPrevious,
      ],
      coreStats: this.preTransitionActivity.coreStats.map((stats) => ({
        ...stats,
      })),
      serviceStats: new Map(this.preTransitionActivity.serviceStats),
    }

    // Clear saved state
    this.preTransitionActivity = null
  }
  /**
   * Update validator statistics based on block processing
   *
   * Gray Paper Reference: Equations (44-68)
   */
  /**
   * Apply block-derived deltas to activity state.
   * Receives only constituents from StatisticsTestVector input: body and slot (plus author index).
   */
  public applyBlockDeltas(
    body: BlockBody,
    _currentSlot: bigint,
    authorIndex: number,
    _accumulationOutputs?: [bigint, Hex][],
  ): void {
    // NOTE: Epoch transition is now handled by handleEpochTransitionIfNeeded()
    // which MUST be called at the START of block processing, BEFORE any validator
    // stats updates (like guarantees). This ensures stats go into the correct epoch.

    // Gray Paper: Service Statistics (π_S) are per-block tracking
    // NOTE: We do NOT clear serviceStats here anymore because accumulation stats are
    // set by AccumulationService BEFORE applyBlockDeltas is called.
    // Individual update functions handle resetting their respective fields while
    // preserving accumulation stats.
    let stats = this.activity.validatorStatsAccumulator[authorIndex]

    // Ensure we have stats for the author
    if (!stats) {
      stats = this.createEmptyValidatorStat()
    }

    // Gray Paper equation (46): Increment block count for author
    stats.blocks += 1

    // Derive per-block deltas from the actual block body content
    const ticketsDelta = body.tickets.length
    const preimageCountDelta = body.preimages.length
    const preimageSizeDelta = body.preimages.reduce((sum, p) => {
      return sum + hexToBytes(p.blob).length
    }, 0)

    stats.tickets += ticketsDelta
    stats.preimageCount += preimageCountDelta
    stats.preimageSize += preimageSizeDelta

    //insert back the item into the accumulator
    this.activity.validatorStatsAccumulator[authorIndex] = stats
    // Track assurances per validator: each assurance is issued by a specific validator
    for (const assurance of body.assurances) {
      const validatorIdx = assurance.validator_index
      let validatorStats = this.activity.validatorStatsAccumulator[validatorIdx]
      if (!validatorStats) {
        validatorStats = this.createEmptyValidatorStat()
      }
      validatorStats.assurances += 1
      this.activity.validatorStatsAccumulator[validatorIdx] = validatorStats
    }

    // Track guarantees per validator: each guarantee has signatures from multiple validators
    // Gray Paper: vs_guarantees = number of reports guaranteed by the validator
    // Each validator who signs a guarantee gets credit for that guarantee
    // NOTE: This is now handled by the guarantor service instead
    // this.updateGuarantees(body.guarantees)

    // Extract work reports from guarantees for core/service statistics
    const incomingReports: WorkReport[] = []
    for (const guarantee of body.guarantees) {
      incomingReports.push(guarantee.report)
    }

    // Update core statistics: popularity from assurances
    this.updateCoreStatistics(body.assurances)

    // Update core statistics: other metrics from work reports
    this.updateCoreStatisticsFromReports(incomingReports, [])

    // Update service statistics: from preimages
    this.updateServiceStatistics(body.preimages)

    // Update service statistics: from work reports
    this.updateServiceStatisticsFromReports(incomingReports)

    // Gray Paper equation 166-169: servicesactive includes keys{accumulationstatistics}
    // Include services from accumulation outputs (from previous block's accumulation)
    // These services should be in serviceStats even if they don't appear in work reports or preimages
    if (_accumulationOutputs) {
      for (const [serviceId, _yieldHash] of _accumulationOutputs) {
        // Ensure service stats exist for services with accumulation outputs
        // NOTE: This is legacy code - accumulation outputs don't create serviceStats entries
        // ServiceStats entries are only created when there's actual activity (provision, refinement, or accumulation)
        // This code can be removed if accumulationOutputs is no longer used here
        if (!this.activity.serviceStats.has(serviceId)) {
          this.activity.serviceStats.set(serviceId, {
            provision: [0, 0], // tuple{N, N} - [count, size]
            refinement: [0, 0], // tuple{N, gas} - [count, gas]
            // accumulation is not initialized here - only set by AccumulationService
            importCount: 0,
            extrinsicCount: 0,
            extrinsicSize: 0,
            exportCount: 0,
          })
        }
      }
    }

    // Gray Paper equation 160-163: accumulation = ifnone{accumulationstatistics[s], tuple{0, 0}}
    // Gray Paper equation 166-169: servicesactive = servicesreported ∪ servicesprovided ∪ keys{accumulationstatistics}
    // Set accumulation for all services in servicesactive:
    // - If service is in accumulationStatistics, use that value
    // - Otherwise, use tuple{0, 0}

    // Collect all service IDs in servicesactive
    const servicesActive = new Set<bigint>()

    // servicesreported: services from work reports
    for (const report of incomingReports) {
      for (const result of report.results) {
        servicesActive.add(result.service_id)
      }
    }

    // servicesprovided: services from preimages
    for (const preimage of body.preimages) {
      servicesActive.add(preimage.requester)
    }

    // keys{accumulationstatistics}: services with accumulation statistics
    // NOTE: Services with accumulation statistics are now added to servicesActive
    // by AccumulationService via updateServiceAccumulationStats(), which creates
    // the serviceStats entry. We don't need to add them here anymore.

    // Gray Paper equation 166-169: servicesactive = servicesreported ∪ servicesprovided ∪ keys{accumulationstatistics}
    // NOTE: We do NOT create serviceStats entries on-demand here. Entries are only created when there's
    // actual activity to record:
    // - provision: created by updateServiceStatistics() when processing preimages
    // - refinement: created by updateServiceStatisticsFromReports() when processing work reports
    // - accumulation: created by AccumulationService.updateServiceAccumulationStats() when accumulation succeeds
    //
    // This ensures serviceStats only contains entries for services with actual non-zero activity,
    // not just services that appear in work reports or preimages but have no activity.
  }

  /**
   * Create empty validator statistics
   */
  private createEmptyValidatorStat(): ValidatorStats {
    return {
      blocks: 0,
      tickets: 0,
      preimageCount: 0,
      preimageSize: 0,
      guarantees: 0,
      assurances: 0,
    }
  }

  /**
   * Create empty validator statistics array
   */
  private createEmptyValidatorStats(): ValidatorStats[] {
    // Initialize with empty stats for all validators
    return new Array(this.configService.numValidators)
      .fill(null)
      .map(() => this.createEmptyValidatorStat())
  }

  /**
   * Create empty core statistics array
   */
  private createEmptyCoreStats(): CoreStats[] {
    return new Array(this.configService.numCores)
      .fill(null)
      .map(() => this.createEmptyCoreStat())
  }
  /**
   * Create empty core statistics array
   */
  private createEmptyCoreStat(): CoreStats {
    return {
      daLoad: 0,
      popularity: 0,
      importCount: 0,
      extrinsicCount: 0,
      extrinsicSize: 0,
      exportCount: 0,
      bundleLength: 0,
      gasUsed: 0,
    }
  }

  // ============================================================================
  // Private Implementation - Core Statistics
  // ============================================================================

  /**
   * Update core statistics based on block processing
   *
   * Gray Paper Reference: Equations (106-140)
   * Specifically equation (115): popularity = sum of assurances bitfield[c]
   */
  private updateCoreStatistics(assurances: Assurance[]): void {
    // Reset popularity for all cores (other stats are handled by updateCoreStatisticsFromReports)
    for (let i = 0; i < this.activity.coreStats.length; i++) {
      this.activity.coreStats[i].popularity = 0
    }

    // Gray Paper equation (115): Calculate popularity from assurances
    // popularity[c] = sum over assurances where bitfield[c] is set
    for (const assurance of assurances) {
      const bitfield = hexToBytes(assurance.bitfield)
      for (
        let coreIndex = 0;
        coreIndex < this.activity.coreStats.length;
        coreIndex++
      ) {
        const byteIndex = Math.floor(coreIndex / 8)
        const bitIndex = coreIndex % 8

        if (byteIndex < bitfield.length) {
          const isSet = (bitfield[byteIndex] & (1 << bitIndex)) !== 0
          if (isSet) {
            this.activity.coreStats[coreIndex].popularity += 1
          }
        }
      }
    }
  }

  /**
   * Update core statistics from work reports
   *
   * Gray Paper Reference: Equations (106-140)
   *
   * R(c) - Sum of digests from incoming reports for core c:
   *   - importcount, xtcount, xtsize, exportcount, gasused from refine_load
   *
   * L(c) - Bundle length sum:
   *   - Sum of package_spec.length from incoming reports for core c
   *
   * D(c) - DA load:
   *   - For availableReports for core c:
   *   - bundlelen + C_SEGMENTSIZE * ceil(segcount * 65/64)
   */
  private updateCoreStatisticsFromReports(
    incomingReports: WorkReport[],
    availableReports: WorkReport[],
  ): void {
    // Reset core stats (except popularity and daLoad which are set separately)
    // - popularity: set by updateCoreStatistics from assurances
    // - daLoad: set earlier in block by updateDaLoadFromAvailableReports (via accumulation)
    // We preserve both since they were already calculated for this block
    for (let i = 0; i < this.activity.coreStats.length; i++) {
      const popularity = this.activity.coreStats[i].popularity
      const daLoad = this.activity.coreStats[i].daLoad
      this.activity.coreStats[i] = this.createEmptyCoreStat()
      this.activity.coreStats[i].popularity = popularity
      this.activity.coreStats[i].daLoad = daLoad
    }

    // Gray Paper equation (106-114): Calculate R(c) and L(c) from incomingReports
    for (const report of incomingReports) {
      const coreIdx = Number(report.core_index)
      if (coreIdx < 0 || coreIdx >= this.activity.coreStats.length) {
        logger.warn('Invalid core index in work report', {
          coreIdx,
          maxCores: this.activity.coreStats.length,
        })
        continue
      }

      const coreStats = this.activity.coreStats[coreIdx]

      // L(c): Sum bundle length from package_spec.length
      // Gray Paper equation (129-133)
      // Note: package_spec.length is a bigint, need to convert to number
      if (
        report.package_spec?.length !== undefined &&
        report.package_spec.length !== null
      ) {
        const bundleLen =
          typeof report.package_spec.length === 'bigint'
            ? Number(report.package_spec.length)
            : report.package_spec.length
        coreStats.bundleLength += bundleLen
      } else {
        logger.warn('Work report missing package_spec.length', {
          coreIdx,
          hasPackageSpec: !!report.package_spec,
          lengthValue: report.package_spec?.length,
        })
      }

      // R(c): Sum digests from work results
      // Gray Paper equation (118-128)
      // Each work result's refine_load contributes to the sum
      if (report.results && Array.isArray(report.results)) {
        for (const result of report.results) {
          if (result.refine_load) {
            coreStats.importCount += Number(result.refine_load.imports || 0)
            coreStats.extrinsicCount += Number(
              result.refine_load.extrinsic_count || 0,
            )
            coreStats.extrinsicSize += Number(
              result.refine_load.extrinsic_size || 0,
            )
            coreStats.exportCount += Number(result.refine_load.exports || 0)
            coreStats.gasUsed += Number(result.refine_load.gas_used || 0)
          } else {
            logger.warn('Work result missing refine_load', {
              coreIdx,
              hasResult: !!result,
            })
          }
        }
      } else {
        logger.warn('Work report missing or invalid results array', {
          coreIdx,
          hasResults: !!report.results,
          isArray: Array.isArray(report.results),
        })
      }
    }

    // Gray Paper equation (134-140): Calculate D(c) from availableReports
    // D(c) = sum of (bundlelen + C_SEGMENTSIZE * ceil(segcount * 65/64))
    const C_SEGMENTSIZE = SEGMENT_CONSTANTS.C_SEGMENTSIZE
    for (const report of availableReports) {
      const coreIdx = Number(report.core_index)
      if (coreIdx < 0 || coreIdx >= this.activity.coreStats.length) {
        continue
      }

      const coreStats = this.activity.coreStats[coreIdx]
      const bundleLen = Number(report.package_spec.length)
      const segCount = Number(report.package_spec.exports_count)

      // Calculate: bundlelen + C_SEGMENTSIZE * ceil(segcount * 65/64)
      // Gray Paper equation (134-140)
      const segLoad = Math.ceil((segCount * 65) / 64) * C_SEGMENTSIZE
      coreStats.daLoad += bundleLen + segLoad
    }
  }

  // ============================================================================
  // Private Implementation - Service Statistics
  // ============================================================================

  /**
   * Update service statistics from preimages
   *
   * Gray Paper Reference: Equations (149-188)
   * Specifically equation (156-159): provision = sum over preimages of (1, len(data))
   *
   * For each service in preimages:
   *   - provision = sum(1) for count, sum(len(data)) for total size
   *   Note: TypeScript ServiceStats.provision is simplified to a single number
   *   representing the count of preimages. The data size is tracked implicitly.
   *
   * @param preimages - Array of preimages from block body
   */
  private updateServiceStatistics(preimages: Preimage[]): void {
    // Gray Paper equation (173-175): servicesprovided = services from preimages
    // Gray Paper equation (156-159): provision = sum over preimages of (1, len(data))

    // Group preimages by requester (service_id) and calculate provision
    const serviceProvisionMap = new Map<
      bigint,
      { count: number; totalSize: number }
    >()

    for (const preimage of preimages) {
      const serviceId = preimage.requester
      const current = serviceProvisionMap.get(serviceId) || {
        count: 0,
        totalSize: 0,
      }

      // Count: sum(1) per preimage for this service
      current.count += 1
      // Size: sum(len(blob)) per preimage for this service
      // blob is a Hex string (always starts with '0x'), so byte length is (hexString.length - 2) / 2
      const blobSize = hexToBytes(preimage.blob).length // Hex string: subtract '0x' prefix, divide by 2 for bytes
      current.totalSize += blobSize

      serviceProvisionMap.set(serviceId, current)
    }

    // Update service stats with provision data
    for (const [serviceId, provision] of serviceProvisionMap) {
      let serviceStats = this.activity.serviceStats.get(serviceId)

      if (!serviceStats) {
        serviceStats = {
          provision: [0, 0], // tuple{N, N} - [count, size]
          refinement: [0, 0], // tuple{N, gas} - [count, gas]
          // accumulation is not initialized here - only set by AccumulationService
          importCount: 0,
          extrinsicCount: 0,
          extrinsicSize: 0,
          exportCount: 0,
        }
        this.activity.serviceStats.set(serviceId, serviceStats)
      }

      // Gray Paper equation (156-159): provision = sum(1, len(data))
      // provision: tuple{N, N} = [count, size]
      serviceStats.provision[0] += provision.count // count
      serviceStats.provision[1] += provision.totalSize // size
    }
  }

  /**
   * Update service statistics from work reports
   *
   * Gray Paper Reference: Equations (149-188)
   *
   * R(s) - Sum of digests from incoming reports for service s:
   *   - counter = 1 per digest (refinement count)
   *   - importcount, xtcount, xtsize, exportcount from refine_load
   *
   * @param incomingReports - Array of work reports from guarantees in block body
   */
  private updateServiceStatisticsFromReports(
    incomingReports: WorkReport[],
  ): void {
    // Gray Paper equation (176-187): Calculate R(s) for each service
    // For each service that appears in work digests, sum upstock the metrics
    // Gray Paper equation 166-169: servicesactive = servicesreported ∪ servicesprovided ∪ keys{accumulationstatistics}
    // We only update services that appear in incoming reports, but preserve stats for other services
    const servicesToUpdate = new Set<bigint>()

    // First pass: collect all service IDs from work digests (results)
    for (const report of incomingReports) {
      for (const result of report.results) {
        servicesToUpdate.add(result.service_id)
      }
    }

    // Reset or initialize service stats ONLY for services that appear in incoming reports
    // Preserve stats for services that don't appear in this block (from preimages, accumulation, or pre-state)
    for (const serviceId of servicesToUpdate) {
      let serviceStats = this.activity.serviceStats.get(serviceId)
      if (!serviceStats) {
        serviceStats = {
          provision: [0, 0], // tuple{N, N} - [count, size]
          refinement: [0, 0], // tuple{N, gas} - [count, gas]
          // accumulation is not initialized here - only set by AccumulationService
          importCount: 0,
          extrinsicCount: 0,
          extrinsicSize: 0,
          exportCount: 0,
        }
        this.activity.serviceStats.set(serviceId, serviceStats)
      }

      // Reset metrics that come from work reports (but preserve provision and accumulation)
      // Gray Paper: refinement, importCount, xtcount, xtsize, exportcount come from R(s)
      // provision comes from preimages (sum over preimages)
      // accumulation comes from accumulationstatistics (set by AccumulationService)
      const provision = serviceStats.provision // tuple{N, N} - preserve [count, size] from preimages
      const accumulation = serviceStats.accumulation // tuple{N, gas} - preserve [count, gas] from accumulation
      serviceStats.refinement = [0, 0] // tuple{N, gas} - reset [count, gas] (will be updated from work reports)
      serviceStats.importCount = 0
      serviceStats.extrinsicCount = 0
      serviceStats.extrinsicSize = 0
      serviceStats.exportCount = 0
      // Preserve provision (from preimages) and accumulation (from AccumulationService)
      serviceStats.provision = provision
      serviceStats.accumulation = accumulation
    }

    // Second pass: sum R(s) over all digests in incoming reports
    // Gray Paper equation (176-187): R(s) = sum over digests where digest.service_id = s
    for (const report of incomingReports) {
      for (const result of report.results) {
        const serviceId = result.service_id
        let serviceStats = this.activity.serviceStats.get(serviceId)

        if (!serviceStats) {
          serviceStats = {
            provision: [0, 0], // tuple{N, N} - [count, size]
            refinement: [0, 0], // tuple{N, gas} - [count, gas]
            // accumulation is not initialized here - only set by AccumulationService
            importCount: 0,
            extrinsicCount: 0,
            extrinsicSize: 0,
            exportCount: 0,
          }
          this.activity.serviceStats.set(serviceId, serviceStats)
        }

        // Gray Paper R(s) equation (181): counter = 1 per digest (refinement count)
        serviceStats.refinement[0] += 1 // count

        // Gray Paper R(s) equation (182): gasused from refine operation
        serviceStats.refinement[1] += Number(result.refine_load.gas_used) // gas

        // Gray Paper R(s) equation (183-186): sum refine_load metrics
        serviceStats.importCount += Number(result.refine_load.imports)
        serviceStats.extrinsicCount += Number(
          result.refine_load.extrinsic_count,
        )
        serviceStats.extrinsicSize += Number(result.refine_load.extrinsic_size)
        serviceStats.exportCount += Number(result.refine_load.exports)
      }
    }
  }
}
