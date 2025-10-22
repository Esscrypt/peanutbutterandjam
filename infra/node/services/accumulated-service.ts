/**
 * Accumulated Service
 *
 * Manages accumulated work-packages according to Gray Paper specifications.
 *
 * Gray Paper Reference: accumulation.tex (Equation 27)
 * accumulated ∈ sequence[C_epochlen]{protoset{hash}}
 *
 * Operations:
 * - Accumulated packages: Track work-packages that have been successfully accumulated
 * - Dependency resolution: Maintain history for dependency resolution
 * - Epoch management: Track accumulated packages per epoch slot
 */

import { logger } from '@pbnj/core'
import {
  type Accumulated,
  type AccumulationMetadata,
  BaseService,
  type IConfigService,
} from '@pbnj/types'
import type { Hex } from 'viem'

/**
 * Accumulated Service Interface
 */
export interface IAccumulatedService {
  getAccumulated(): Accumulated
  setAccumulated(accumulated: Accumulated): void

  // Package operations
  addAccumulatedPackage(packageHash: Hex, metadata?: AccumulationMetadata): void
  removeAccumulatedPackage(packageHash: Hex): void
  isPackageAccumulated(packageHash: Hex): boolean
  getAccumulatedPackages(): Hex[]

  // Metadata operations
  getAccumulationMetadata(packageHash: Hex): AccumulationMetadata | undefined
  setAccumulationMetadata(
    packageHash: Hex,
    metadata: AccumulationMetadata,
  ): void
  updateAccumulationTimestamp(packageHash: Hex, timestamp: bigint): void

  // Batch operations
  addAccumulatedPackages(packages: Hex[], timestamp?: bigint): void
  clearAccumulatedPackages(): void

  // Statistics
  getStats(): {
    totalPackages: number
    packagesWithMetadata: number
    averageMetadataPerPackage: number
  }
}

/**
 * Accumulated Service Implementation
 */
export class AccumulatedService
  extends BaseService
  implements IAccumulatedService
{
  private accumulated: Accumulated

  constructor(_configService: IConfigService) {
    super('accumulated-service')
    this.accumulated = {
      packages: [],
      metadata: new Map<Hex, AccumulationMetadata>(),
    }
  }

  /**
   * Get current accumulated state
   */
  getAccumulated(): Accumulated {
    return this.accumulated
  }

  /**
   * Set accumulated state
   */
  setAccumulated(accumulated: Accumulated): void {
    this.accumulated = accumulated
    logger.debug('Accumulated state updated', {
      totalPackages: accumulated.packages.length,
      packagesWithMetadata: accumulated.metadata.size,
    })
  }

  /**
   * Add accumulated package
   *
   * Gray Paper: accumulated ∈ sequence[C_epochlen]{protoset{hash}}
   */
  addAccumulatedPackage(
    packageHash: Hex,
    metadata?: AccumulationMetadata,
  ): void {
    // Check if package is already accumulated
    if (this.accumulated.packages.includes(packageHash)) {
      logger.debug('Package already accumulated', { packageHash })
      return
    }

    this.accumulated.packages.push(packageHash)

    if (metadata) {
      this.accumulated.metadata.set(packageHash, metadata)
    }

    logger.debug('Package added to accumulated', {
      packageHash,
      hasMetadata: !!metadata,
      totalPackages: this.accumulated.packages.length,
    })
  }

  /**
   * Remove accumulated package
   */
  removeAccumulatedPackage(packageHash: Hex): void {
    const index = this.accumulated.packages.indexOf(packageHash)
    if (index !== -1) {
      this.accumulated.packages.splice(index, 1)
      this.accumulated.metadata.delete(packageHash)

      logger.debug('Package removed from accumulated', {
        packageHash,
        remainingPackages: this.accumulated.packages.length,
      })
    }
  }

  /**
   * Check if package is accumulated
   */
  isPackageAccumulated(packageHash: Hex): boolean {
    return this.accumulated.packages.includes(packageHash)
  }

  /**
   * Get all accumulated packages
   */
  getAccumulatedPackages(): Hex[] {
    return [...this.accumulated.packages]
  }

  /**
   * Get accumulation metadata for a package
   */
  getAccumulationMetadata(packageHash: Hex): AccumulationMetadata | undefined {
    return this.accumulated.metadata.get(packageHash)
  }

  /**
   * Set accumulation metadata for a package
   */
  setAccumulationMetadata(
    packageHash: Hex,
    metadata: AccumulationMetadata,
  ): void {
    this.accumulated.metadata.set(packageHash, metadata)
    logger.debug('Accumulation metadata set', {
      packageHash,
      timestamp: metadata.timestamp.toString(),
    })
  }

  /**
   * Update accumulation timestamp for a package
   */
  updateAccumulationTimestamp(packageHash: Hex, timestamp: bigint): void {
    const existingMetadata = this.accumulated.metadata.get(packageHash)
    if (existingMetadata) {
      existingMetadata.timestamp = timestamp
      logger.debug('Accumulation timestamp updated', {
        packageHash,
        timestamp: timestamp.toString(),
      })
    } else {
      // Create new metadata with just timestamp
      this.accumulated.metadata.set(packageHash, {
        timestamp,
        gasUsed: 0n,
        coreIndex: 0n,
      })
    }
  }

  /**
   * Add multiple accumulated packages
   */
  addAccumulatedPackages(packages: Hex[], timestamp?: bigint): void {
    for (const packageHash of packages) {
      const metadata = timestamp
        ? {
            timestamp,
            gasUsed: 0n,
            coreIndex: 0n,
          }
        : undefined

      this.addAccumulatedPackage(packageHash, metadata)
    }

    logger.debug('Multiple packages added to accumulated', {
      packageCount: packages.length,
      hasTimestamp: !!timestamp,
    })
  }

  /**
   * Clear all accumulated packages
   */
  clearAccumulatedPackages(): void {
    this.accumulated.packages = []
    this.accumulated.metadata.clear()

    logger.debug('All accumulated packages cleared')
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalPackages: number
    packagesWithMetadata: number
    averageMetadataPerPackage: number
  } {
    const totalPackages = this.accumulated.packages.length
    const packagesWithMetadata = this.accumulated.metadata.size
    const averageMetadataPerPackage =
      totalPackages > 0 ? packagesWithMetadata / totalPackages : 0

    return {
      totalPackages,
      packagesWithMetadata,
      averageMetadataPerPackage,
    }
  }
}
