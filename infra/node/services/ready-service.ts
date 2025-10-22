/**
 * Ready Service
 *
 * Manages ready work-reports according to Gray Paper specifications.
 *
 * Gray Paper Reference: accumulation.tex (Equation 34)
 * ready ∈ sequence[C_epochlen]{sequence{⟨workreport, protoset{hash}⟩}}
 *
 * Operations:
 * - Ready work-reports: Track reports ready for accumulation processing
 * - Epoch slot management: Each epoch slot contains ready items
 * - Dependency tracking: Each ready item has work report and dependencies
 */

import { logger } from '@pbnj/core'
import { calculateWorkReportHash } from '@pbnj/serialization'
import {
  BaseService,
  type IConfigService,
  type Ready,
  type ReadyItem,
  type WorkReport,
} from '@pbnj/types'
import type { Hex } from 'viem'

/**
 * Ready Service Interface
 */
export interface IReadyService {
  getReady(): Ready
  setReady(ready: Ready): void

  // Epoch slot operations
  getReadyItemsForSlot(slotIndex: bigint): ReadyItem[]
  addReadyItemToSlot(slotIndex: bigint, readyItem: ReadyItem): void
  removeReadyItemFromSlot(slotIndex: bigint, workReportHash: Hex): void
  clearSlot(slotIndex: bigint): void

  // Ready item operations
  addReadyItem(workReport: WorkReport, dependencies: Set<Hex>): void
  removeReadyItem(workReportHash: Hex): void
  getReadyItem(workReportHash: Hex): ReadyItem | undefined

  // Dependency management
  updateDependencies(workReportHash: Hex, dependencies: Set<Hex>): void
  removeDependency(workReportHash: Hex, dependencyHash: Hex): void
  addDependency(workReportHash: Hex, dependencyHash: Hex): void

  // Statistics
  getStats(): {
    totalSlots: number
    totalReadyItems: number
    averageItemsPerSlot: number
    slotsWithItems: number
  }
}

/**
 * Ready Service Implementation
 */
export class ReadyService extends BaseService implements IReadyService {
  private ready: Ready

  constructor(_configService: IConfigService) {
    super('ready-service')
    this.ready = {
      epochSlots: new Map<bigint, ReadyItem[]>(),
    }
  }

  /**
   * Get current ready state
   */
  getReady(): Ready {
    return this.ready
  }

  /**
   * Set ready state
   */
  setReady(ready: Ready): void {
    this.ready = ready
    logger.debug('Ready state updated', {
      totalSlots: ready.epochSlots.size,
      totalItems: Array.from(ready.epochSlots.values()).reduce(
        (sum, items) => sum + items.length,
        0,
      ),
    })
  }

  /**
   * Get ready items for a specific epoch slot
   *
   * Gray Paper: ready ∈ sequence[C_epochlen]{sequence{⟨workreport, protoset{hash}⟩}}
   */
  getReadyItemsForSlot(slotIndex: bigint): ReadyItem[] {
    return this.ready.epochSlots.get(slotIndex) || []
  }

  /**
   * Add ready item to a specific epoch slot
   */
  addReadyItemToSlot(slotIndex: bigint, readyItem: ReadyItem): void {
    if (!this.ready.epochSlots.has(slotIndex)) {
      this.ready.epochSlots.set(slotIndex, [])
    }

    const slotItems = this.ready.epochSlots.get(slotIndex)!
    slotItems.push(readyItem)

    const [hashError, workReportHash] = calculateWorkReportHash(
      readyItem.workReport,
    )
    const hash = hashError ? 'unknown' : workReportHash

    logger.debug('Ready item added to slot', {
      slotIndex: slotIndex.toString(),
      workReportHash: hash,
      dependenciesCount: readyItem.dependencies.size,
    })
  }

  /**
   * Remove ready item from a specific epoch slot
   */
  removeReadyItemFromSlot(slotIndex: bigint, workReportHash: Hex): void {
    const slotItems = this.ready.epochSlots.get(slotIndex)
    if (!slotItems) return

    const index = slotItems.findIndex((item) => {
      const [hashError, hash] = calculateWorkReportHash(item.workReport)
      return !hashError && hash === workReportHash
    })
    if (index !== -1) {
      slotItems.splice(index, 1)
      logger.debug('Ready item removed from slot', {
        slotIndex: slotIndex.toString(),
        workReportHash,
      })
    }
  }

  /**
   * Clear all ready items from a specific epoch slot
   */
  clearSlot(slotIndex: bigint): void {
    this.ready.epochSlots.delete(slotIndex)
    logger.debug('Slot cleared', { slotIndex: slotIndex.toString() })
  }

  /**
   * Add ready item (automatically assigns to appropriate slot)
   */
  addReadyItem(workReport: WorkReport, dependencies: Set<Hex>): void {
    const readyItem: ReadyItem = {
      workReport,
      dependencies,
    }

    // For simplicity, assign to slot 0 (could be more sophisticated)
    const slotIndex = 0n
    this.addReadyItemToSlot(slotIndex, readyItem)
  }

  /**
   * Remove ready item from any slot
   */
  removeReadyItem(workReportHash: Hex): void {
    for (const [, items] of this.ready.epochSlots) {
      const index = items.findIndex((item) => {
        const [hashError, hash] = calculateWorkReportHash(item.workReport)
        return !hashError && hash === workReportHash
      })
      if (index !== -1) {
        items.splice(index, 1)
        logger.debug('Ready item removed', { workReportHash })
        return
      }
    }
  }

  /**
   * Get ready item by work report hash
   */
  getReadyItem(workReportHash: Hex): ReadyItem | undefined {
    for (const items of this.ready.epochSlots.values()) {
      const item = items.find((item) => {
        const [hashError, hash] = calculateWorkReportHash(item.workReport)
        return !hashError && hash === workReportHash
      })
      if (item) return item
    }
    return undefined
  }

  /**
   * Update dependencies for a ready item
   */
  updateDependencies(workReportHash: Hex, dependencies: Set<Hex>): void {
    const readyItem = this.getReadyItem(workReportHash)
    if (readyItem) {
      readyItem.dependencies = dependencies
      logger.debug('Dependencies updated', {
        workReportHash,
        dependenciesCount: dependencies.size,
      })
    }
  }

  /**
   * Remove a specific dependency from a ready item
   */
  removeDependency(workReportHash: Hex, dependencyHash: Hex): void {
    const readyItem = this.getReadyItem(workReportHash)
    if (readyItem) {
      readyItem.dependencies.delete(dependencyHash)
      logger.debug('Dependency removed', { workReportHash, dependencyHash })
    }
  }

  /**
   * Add a dependency to a ready item
   */
  addDependency(workReportHash: Hex, dependencyHash: Hex): void {
    const readyItem = this.getReadyItem(workReportHash)
    if (readyItem) {
      readyItem.dependencies.add(dependencyHash)
      logger.debug('Dependency added', { workReportHash, dependencyHash })
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalSlots: number
    totalReadyItems: number
    averageItemsPerSlot: number
    slotsWithItems: number
  } {
    const totalSlots = this.ready.epochSlots.size
    let totalReadyItems = 0
    let slotsWithItems = 0

    for (const items of this.ready.epochSlots.values()) {
      totalReadyItems += items.length
      if (items.length > 0) {
        slotsWithItems++
      }
    }

    const averageItemsPerSlot =
      totalSlots > 0 ? totalReadyItems / totalSlots : 0

    return {
      totalSlots,
      totalReadyItems,
      averageItemsPerSlot,
      slotsWithItems,
    }
  }
}
