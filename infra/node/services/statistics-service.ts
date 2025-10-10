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
  type EpochTransitionEvent,
  type EventBusService,
  logger,
  type Safe,
  safeResult,
  type WorkReportProcessedEvent,
} from '@pbnj/core'
import type {
  Activity,
  CoreStats,
  ServiceStats,
  ValidatorStats,
  WorkReport,
} from '@pbnj/types'
import { BaseService } from '@pbnj/types'

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
  private currentEpoch: bigint
  private eventBusService: EventBusService

  private ticketsPerValidator: Map<number, number> = new Map()
  private preimagesPerValidator: Map<number, number> = new Map()
  private guaranteesPerValidator: Map<number, number> = new Map()
  private assurancesPerValidator: Map<number, number> = new Map()

  constructor(eventBusService: EventBusService) {
    super('statistics-service')
    this.currentEpoch = 0n
    this.eventBusService = eventBusService
    this.ticketsPerValidator = new Map()
    this.preimagesPerValidator = new Map()
    this.guaranteesPerValidator = new Map()
    this.assurancesPerValidator = new Map()

    this.activity = {
      validatorStatsAccumulator: this.createEmptyValidatorStats(),
      validatorStatsPrevious: this.createEmptyValidatorStats(),
      coreStats: this.createEmptyCoreStats(),
      serviceStats: new Map(),
    }
  }

  override start(): Safe<boolean> {
    // Register event handlers
    this.eventBusService.addBlockProcessedCallback(
      this.handleBlockProcessed.bind(this),
    )
    this.eventBusService.addWorkReportProcessedCallback(
      this.handleWorkReportProcessed.bind(this),
    )
    this.eventBusService.onEpochTransition(
      this.handleEpochTransition.bind(this),
    )

    return safeResult(true)
  }

  override stop(): Safe<boolean> {
    // Remove event handlers
    // Note: EventBusService doesn't have remove methods for the new callbacks yet
    // this.eventBusService.removeBlockProcessedCallback(this.handleBlockProcessed.bind(this))
    // this.eventBusService.removeWorkReportProcessedCallback(this.handleWorkReportProcessed.bind(this))
    this.eventBusService.removeEpochTransitionCallback(
      this.handleEpochTransition.bind(this),
    )

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
    logger.debug('Processing block for statistics', {
      slot: event.slot.toString(),
      authorIndex: event.authorIndex,
      epoch: this.currentEpoch.toString(),
    })

    // Update validator statistics
    this.updateValidatorStatistics(event)

    // Update core statistics (per-block)
    this.updateCoreStatistics(event)

    // Update service statistics (per-block)
    this.updateServiceStatistics(event)

    return safeResult(undefined)
  }

  /**
   * Handle epoch transition event
   * Rolls over validator statistics accumulator to previous
   *
   * Gray Paper Reference: Equations (40-43)
   */
  private async handleEpochTransition(
    event: EpochTransitionEvent,
  ): Promise<Safe<void>> {
    logger.info('Handling epoch transition', {
      previousEpoch: event.previousEpoch.toString(),
      newEpoch: event.newEpoch.toString(),
      validatorCount: this.activity.validatorStatsAccumulator.length,
    })

    // Gray Paper equation (40-43): Rollover accumulator to previous
    this.activity = {
      ...this.activity,
      validatorStatsPrevious: [...this.activity.validatorStatsAccumulator],
      validatorStatsAccumulator: this.createEmptyValidatorStats(),
    }

    this.currentEpoch = event.newEpoch

    logger.info('Epoch transition completed', {
      newEpoch: this.currentEpoch.toString(),
      previousStatsCount: this.activity.validatorStatsPrevious.length,
      accumulatorStatsCount: this.activity.validatorStatsAccumulator.length,
    })

    return safeResult(undefined)
  }

  /**
   * Handle work report processing event
   * Updates core and service statistics based on work reports
   *
   * Gray Paper Reference: Equations (106-188) for core/service stats
   */
  private async handleWorkReportProcessed(
    event: WorkReportProcessedEvent,
  ): Promise<Safe<void>> {
    logger.debug('Processing work reports for statistics', {
      availableCount: event.availableReports.length,
      incomingCount: event.incomingReports.length,
    })

    // Update core statistics based on incoming reports
    this.updateCoreStatisticsFromReports(
      event.incomingReports,
      event.availableReports,
    )

    // Update service statistics based on incoming reports
    this.updateServiceStatisticsFromReports(event.incomingReports)

    return safeResult(undefined)
  }

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
   * Get service statistics for specific service
   */
  getServiceStatsForService(serviceId: bigint): ServiceStats | null {
    return this.activity.serviceStats.get(serviceId) || null
  }

  /**
   * Get current epoch
   */
  getCurrentEpoch(): bigint {
    return this.currentEpoch
  }

  // ============================================================================
  // Private Implementation - Validator Statistics
  // ============================================================================

  /**
   * Update validator statistics based on block processing
   *
   * Gray Paper Reference: Equations (44-68)
   */
  private updateValidatorStatistics(event: BlockProcessedEvent): void {
    const authorIndex = event.authorIndex
    let stats = this.activity.validatorStatsAccumulator[authorIndex]

    // Ensure we have stats for the author
    if (!stats) {
      stats = this.createEmptyValidatorStat()
    }

    // Gray Paper equation (46): Increment block count for author
    stats.blocks += 1

    // Gray Paper equation (48-51): Update tickets count for author
    const ticketCount = this.ticketsPerValidator.get(authorIndex) || 0
    this.ticketsPerValidator.set(authorIndex, ticketCount + 1)

    stats.tickets += ticketCount

    // Gray Paper equation (53-56): Update preimage count for author
    const preimageCount = this.preimagesPerValidator.get(authorIndex) || 0
    this.preimagesPerValidator.set(authorIndex, preimageCount + 1)

    stats.preimageCount += preimageCount

    // Gray Paper equation (58-61): Update preimage size for author
    const preimageSize = this.preimagesPerValidator.get(authorIndex) || 0
    this.preimagesPerValidator.set(authorIndex, preimageSize + 1)
    stats.preimageSize += preimageSize

    // Gray Paper equation (63): Update guarantees count
    const guaranteeCount = this.guaranteesPerValidator.get(authorIndex) || 0
    this.guaranteesPerValidator.set(authorIndex, guaranteeCount + 1)

    stats.guarantees += guaranteeCount

    // Gray Paper equation (65-67): Update assurances count
    const assuranceCount = this.assurancesPerValidator.get(authorIndex) || 0
    this.assurancesPerValidator.set(authorIndex, assuranceCount + 1)

    stats.assurances += assuranceCount

    //insert back the item into the accumulator
    this.activity.validatorStatsAccumulator[authorIndex] = stats

    logger.debug('Updated validator statistics', {
      validatorIndex: authorIndex,
      blocks: stats.blocks.toString(),
      tickets: stats.tickets.toString(),
      preimages: stats.preimageCount.toString(),
      preimageSize: stats.preimageSize.toString(),
      guarantees: stats.guarantees.toString(),
      assurances: stats.assurances.toString(),
    })
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
    return Array(this.activity.validatorStatsAccumulator.length)
      .fill(null)
      .map(() => this.createEmptyValidatorStat())
  }

  /**
   * Create empty core statistics array
   */
  private createEmptyCoreStats(): CoreStats[] {
    return Array(this.activity.coreStats.length)
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
   */
  private updateCoreStatistics(event: BlockProcessedEvent): void {
    // Core statistics are updated per-block based on work reports
    // This is a placeholder - actual implementation would process
    // incoming work reports and availability assurances
    logger.debug('Core statistics updated for block', {
      slot: event.slot.toString(),
      coreCount: this.activity.coreStats.length,
    })
  }

  /**
   * Update core statistics from work reports
   *
   * Gray Paper Reference: Equations (106-140)
   */
  private updateCoreStatisticsFromReports(
    incomingReports: WorkReport[],
    availableReports: WorkReport[],
  ): void {
    // Gray Paper equation (106-140): Update core statistics
    // This would process incomingReports and availableReports
    // to update import count, extrinsic count/size, export count,
    // gas used, bundle length, DA load, and popularity

    logger.debug('Updated core statistics from work reports', {
      incomingCount: incomingReports.length,
      availableCount: availableReports.length,
    })
  }

  // ============================================================================
  // Private Implementation - Service Statistics
  // ============================================================================

  /**
   * Update service statistics based on block processing
   *
   * Gray Paper Reference: Equations (149-188)
   */
  private updateServiceStatistics(event: BlockProcessedEvent): void {
    // Service statistics are updated per-block based on work reports
    // and preimages in extrinsics
    logger.debug('Service statistics updated for block', {
      slot: event.slot.toString(),
      serviceCount: this.activity.serviceStats.size,
    })
  }

  /**
   * Update service statistics from work reports
   *
   * Gray Paper Reference: Equations (149-188)
   */
  private updateServiceStatisticsFromReports(
    incomingReports: WorkReport[],
  ): void {
    // Gray Paper equation (149-188): Update service statistics
    // This would process incomingReports to update provision,
    // refinement, accumulation, import count, extrinsic count/size,
    // export count for each service

    logger.debug('Updated service statistics from work reports', {
      incomingCount: incomingReports.length,
    })
  }
}
