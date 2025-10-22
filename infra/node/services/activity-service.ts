/**
 * Activity Service
 *
 * Manages activity statistics according to Gray Paper specifications.
 *
 * Gray Paper Reference: statistics.tex (Equation 11)
 * activity ≡ ⟨valstatsaccumulator, valstatsprevious, corestats, servicestats⟩
 *
 * Operations:
 * - Validator statistics: Track 6 metrics per validator per epoch
 * - Core statistics: Track 7 metrics per core
 * - Service statistics: Track 6 metrics per service
 * - Epoch transitions: Roll over validator statistics from accumulator to previous
 */

import { logger } from '@pbnj/core'
import {
  type Activity,
  BaseService,
  type CoreStats,
  type IConfigService,
  type ServiceStats,
  type ValidatorStats,
} from '@pbnj/types'

/**
 * Activity Service Interface
 */
export interface IActivityService {
  getActivity(): Activity
  setActivity(activity: Activity): void

  // Validator statistics
  updateValidatorStats(
    validatorIndex: number,
    stats: Partial<ValidatorStats>,
  ): void
  getValidatorStats(validatorIndex: number): ValidatorStats
  getAllValidatorStats(): ValidatorStats[]
  rolloverValidatorStats(): void

  // Core statistics
  updateCoreStats(coreIndex: number, stats: Partial<CoreStats>): void
  getCoreStats(coreIndex: number): CoreStats
  getAllCoreStats(): CoreStats[]

  // Service statistics
  updateServiceStats(serviceId: bigint, stats: Partial<ServiceStats>): void
  getServiceStats(serviceId: bigint): ServiceStats | undefined
  getAllServiceStats(): Map<bigint, ServiceStats>

  // Statistics management
  resetValidatorStats(): void
  resetCoreStats(): void
  resetServiceStats(): void
  getStatsSummary(): {
    totalValidators: number
    totalCores: number
    totalServices: number
    epochStats: {
      currentEpoch: number
      previousEpoch: number
    }
  }
}

/**
 * Activity Service Implementation
 */
export class ActivityService extends BaseService implements IActivityService {
  private activity: Activity

  constructor(configService: IConfigService) {
    super('activity-service')
    this.activity = {
      validatorStatsAccumulator: [],
      validatorStatsPrevious: [],
      coreStats: [],
      serviceStats: new Map<bigint, ServiceStats>(),
    }
  }

  /**
   * Get current activity statistics
   */
  getActivity(): Activity {
    return this.activity
  }

  /**
   * Set activity statistics
   */
  setActivity(activity: Activity): void {
    this.activity = activity
    logger.debug('Activity statistics updated', {
      validatorStatsAccumulator: activity.validatorStatsAccumulator.length,
      validatorStatsPrevious: activity.validatorStatsPrevious.length,
      coreStats: activity.coreStats.length,
      serviceStats: activity.serviceStats.size,
    })
  }

  /**
   * Update validator statistics
   *
   * Gray Paper: Track 6 metrics per validator per epoch
   */
  updateValidatorStats(
    validatorIndex: number,
    stats: Partial<ValidatorStats>,
  ): void {
    // Ensure we have stats for this validator
    if (!this.activity.validatorStatsAccumulator[validatorIndex]) {
      this.activity.validatorStatsAccumulator[validatorIndex] =
        this.createEmptyValidatorStats()
    }

    const currentStats = this.activity.validatorStatsAccumulator[validatorIndex]

    // Update only provided fields
    if (stats.blocks !== undefined) currentStats.blocks += stats.blocks
    if (stats.tickets !== undefined) currentStats.tickets += stats.tickets
    if (stats.preimageCount !== undefined)
      currentStats.preimageCount += stats.preimageCount
    if (stats.preimageSize !== undefined)
      currentStats.preimageSize += stats.preimageSize
    if (stats.guarantees !== undefined)
      currentStats.guarantees += stats.guarantees
    if (stats.assurances !== undefined)
      currentStats.assurances += stats.assurances

    logger.debug('Validator statistics updated', {
      validatorIndex,
      stats: currentStats,
    })
  }

  /**
   * Get validator statistics
   */
  getValidatorStats(validatorIndex: number): ValidatorStats {
    return (
      this.activity.validatorStatsAccumulator[validatorIndex] ||
      this.createEmptyValidatorStats()
    )
  }

  /**
   * Get all validator statistics
   */
  getAllValidatorStats(): ValidatorStats[] {
    return this.activity.validatorStatsAccumulator
  }

  /**
   * Roll over validator statistics from accumulator to previous
   *
   * Gray Paper: Epoch transition moves accumulator to previous
   */
  rolloverValidatorStats(): void {
    this.activity.validatorStatsPrevious = [
      ...this.activity.validatorStatsAccumulator,
    ]
    this.resetValidatorStats()

    logger.debug('Validator statistics rolled over', {
      previousEpochStats: this.activity.validatorStatsPrevious.length,
    })
  }

  /**
   * Update core statistics
   *
   * Gray Paper: Track 7 metrics per core
   */
  updateCoreStats(coreIndex: number, stats: Partial<CoreStats>): void {
    // Ensure we have stats for this core
    if (!this.activity.coreStats[coreIndex]) {
      this.activity.coreStats[coreIndex] = this.createEmptyCoreStats()
    }

    const currentStats = this.activity.coreStats[coreIndex]

    // Update only provided fields
    if (stats.daLoad !== undefined) currentStats.daLoad += stats.daLoad
    if (stats.popularity !== undefined)
      currentStats.popularity += stats.popularity
    if (stats.importCount !== undefined)
      currentStats.importCount += stats.importCount
    if (stats.extrinsicCount !== undefined)
      currentStats.extrinsicCount += stats.extrinsicCount
    if (stats.extrinsicSize !== undefined)
      currentStats.extrinsicSize += stats.extrinsicSize
    if (stats.exportCount !== undefined)
      currentStats.exportCount += stats.exportCount
    if (stats.bundleLength !== undefined)
      currentStats.bundleLength += stats.bundleLength
    if (stats.gasUsed !== undefined) currentStats.gasUsed += stats.gasUsed

    logger.debug('Core statistics updated', {
      coreIndex,
      stats: currentStats,
    })
  }

  /**
   * Get core statistics
   */
  getCoreStats(coreIndex: number): CoreStats {
    return this.activity.coreStats[coreIndex] || this.createEmptyCoreStats()
  }

  /**
   * Get all core statistics
   */
  getAllCoreStats(): CoreStats[] {
    return this.activity.coreStats
  }

  /**
   * Update service statistics
   *
   * Gray Paper: Track 6 metrics per service
   */
  updateServiceStats(serviceId: bigint, stats: Partial<ServiceStats>): void {
    // Ensure we have stats for this service
    if (!this.activity.serviceStats.has(serviceId)) {
      this.activity.serviceStats.set(serviceId, this.createEmptyServiceStats())
    }

    const currentStats = this.activity.serviceStats.get(serviceId)!

    // Update only provided fields
    if (stats.provision !== undefined) currentStats.provision += stats.provision
    if (stats.refinement !== undefined)
      currentStats.refinement += stats.refinement
    if (stats.accumulation !== undefined)
      currentStats.accumulation += stats.accumulation
    if (stats.transfer !== undefined) currentStats.transfer += stats.transfer
    if (stats.importCount !== undefined)
      currentStats.importCount += stats.importCount
    if (stats.extrinsicCount !== undefined)
      currentStats.extrinsicCount += stats.extrinsicCount
    if (stats.extrinsicSize !== undefined)
      currentStats.extrinsicSize += stats.extrinsicSize
    if (stats.exportCount !== undefined)
      currentStats.exportCount += stats.exportCount

    logger.debug('Service statistics updated', {
      serviceId: serviceId.toString(),
      stats: currentStats,
    })
  }

  /**
   * Get service statistics
   */
  getServiceStats(serviceId: bigint): ServiceStats | undefined {
    return this.activity.serviceStats.get(serviceId)
  }

  /**
   * Get all service statistics
   */
  getAllServiceStats(): Map<bigint, ServiceStats> {
    return this.activity.serviceStats
  }

  /**
   * Reset validator statistics accumulator
   */
  resetValidatorStats(): void {
    this.activity.validatorStatsAccumulator = []
    logger.debug('Validator statistics accumulator reset')
  }

  /**
   * Reset core statistics
   */
  resetCoreStats(): void {
    this.activity.coreStats = []
    logger.debug('Core statistics reset')
  }

  /**
   * Reset service statistics
   */
  resetServiceStats(): void {
    this.activity.serviceStats.clear()
    logger.debug('Service statistics reset')
  }

  /**
   * Get statistics summary
   */
  getStatsSummary(): {
    totalValidators: number
    totalCores: number
    totalServices: number
    epochStats: {
      currentEpoch: number
      previousEpoch: number
    }
  } {
    return {
      totalValidators: this.activity.validatorStatsAccumulator.length,
      totalCores: this.activity.coreStats.length,
      totalServices: this.activity.serviceStats.size,
      epochStats: {
        currentEpoch: this.activity.validatorStatsAccumulator.length,
        previousEpoch: this.activity.validatorStatsPrevious.length,
      },
    }
  }

  /**
   * Create empty validator statistics
   */
  private createEmptyValidatorStats(): ValidatorStats {
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
   * Create empty core statistics
   */
  private createEmptyCoreStats(): CoreStats {
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

  /**
   * Create empty service statistics
   */
  private createEmptyServiceStats(): ServiceStats {
    return {
      provision: 0,
      refinement: 0,
      accumulation: 0,
      transfer: 0,
      importCount: 0,
      extrinsicCount: 0,
      extrinsicSize: 0,
      exportCount: 0,
    }
  }
}
