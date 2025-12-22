/**
 * Ready Service
 * Work Reports ready for accumulation processing
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

import { calculateWorkReportHash } from '@pbnjam/codec'
import { logger } from '@pbnjam/core'
import {
  BaseService,
  type IConfigService,
  type Ready,
  type ReadyItem,
  type WorkReport,
} from '@pbnjam/types'
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
  removeReadyItemFromSlot(slotIndex: bigint, workReportHash: Hex): boolean
  clearSlot(slotIndex: bigint): void

  // Ready item operations
  addReadyItem(workReport: WorkReport, dependencies: Set<Hex>): void
  removeReadyItem(workReportHash: Hex): void
  getReadyItem(workReportHash: Hex): ReadyItem | undefined

  // Dependency management
  updateDependencies(workReportHash: Hex, dependencies: Set<Hex>): void
  removeDependency(workReportHash: Hex, dependencyHash: Hex): void
  addDependency(workReportHash: Hex, dependencyHash: Hex): void

  // Queue editing function E - modifies state directly
  // Gray Paper equation 50-60: E removes items whose package hash is in accumulated set,
  // and removes any dependencies which appear in said set
  applyQueueEditingFunctionEToSlot(
    slotIndex: bigint,
    accumulatedPackages: Set<Hex>,
  ): void
}

/**
 * Ready Service Implementation
 */
export class ReadyService extends BaseService implements IReadyService {
  private ready: Ready

  private readonly configService: IConfigService
  constructor(options: {
    configService: IConfigService
  }) {
    super('ready-service')

    this.configService = options.configService
    this.ready = {
      epochSlots: new Array(this.configService.epochDuration).fill([]),
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
  }

  /**
   * Get ready items for a specific epoch slot
   *
   * Gray Paper: ready ∈ sequence[C_epochlen]{sequence{⟨workreport, protoset{hash}⟩}}
   */
  getReadyItemsForSlot(slotIndex: bigint): ReadyItem[] {
    if(slotIndex > this.configService.epochDuration) {
      throw new Error('Slot index out of bounds')
    }
    return this.ready.epochSlots[Number(slotIndex)] || []
  }

  /**
   * Add ready item to a specific epoch slot
   */
  addReadyItemToSlot(slotIndex: bigint, readyItem: ReadyItem): void {
    if (slotIndex > this.configService.epochDuration) {
      throw new Error('Slot index out of bounds')
    }

    const slotItems = this.ready.epochSlots[Number(slotIndex)]!
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
  removeReadyItemFromSlot(slotIndex: bigint, workReportHash: Hex): boolean {
    const slotIndexNum = Number(slotIndex)
    const slotItems = this.ready.epochSlots[slotIndexNum]
    if (!slotItems) {
      logger.warn('[ReadyService] Slot items not found', {
        slotIndex: slotIndex.toString(),
        epochDuration: this.configService.epochDuration,
      })
      return false
    }

    logger.debug('[ReadyService] Searching for ready item to remove', {
      slotIndex: slotIndex.toString(),
      workReportHash,
      currentSlotItemsCount: slotItems.length,
      currentSlotItems: slotItems.map((item) => {
        const [hashError, hash] = calculateWorkReportHash(item.workReport)
        return {
          hash: hashError ? 'unknown' : hash,
          packageHash: item.workReport.package_spec.hash,
        }
      }),
    })

    const index = slotItems.findIndex((item) => {
      const [hashError, hash] = calculateWorkReportHash(item.workReport)
      return !hashError && hash === workReportHash
    })
    if (index === -1) {
      logger.warn('[ReadyService] Ready item not found in slot', {
        slotIndex: slotIndex.toString(),
        workReportHash,
        slotItemsCount: slotItems.length,
      })
      return false
    }

    const removedItem = slotItems[index]
    slotItems.splice(index, 1)
    logger.debug('[ReadyService] Removed ready item from slot', {
      slotIndex: slotIndex.toString(),
      workReportHash,
      removedPackageHash: removedItem.workReport.package_spec.hash,
      remainingSlotItemsCount: slotItems.length,
    })
    return true
  }

  /**
   * Clear all ready items from a specific epoch slot
   */
  clearSlot(slotIndex: bigint): void {
    this.ready.epochSlots[Number(slotIndex)] = []
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
    for (const items of this.ready.epochSlots) {
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
    }
  }

  /**
   * Remove a specific dependency from a ready item
   */
  removeDependency(workReportHash: Hex, dependencyHash: Hex): void {
    const readyItem = this.getReadyItem(workReportHash)
    if (readyItem) {
      readyItem.dependencies.delete(dependencyHash)
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
   * Apply queue editing function E to a specific slot - modifies state directly
   * Gray Paper equation 50-60: E removes items whose package hash is in accumulated set,
   * and removes any dependencies which appear in said set
   *
   * This modifies the ready state in place, removing accumulated items and filtering dependencies
   *
   * @param slotIndex - Epoch slot index to edit
   * @param accumulatedPackages - Set of accumulated work-package hashes
   */
  applyQueueEditingFunctionEToSlot(
    slotIndex: bigint,
    accumulatedPackages: Set<Hex>,
  ): void {
    const slotIndexNum = Number(slotIndex)
    if (slotIndexNum >= this.configService.epochDuration) {
      throw new Error('Slot index out of bounds')
    }

    const slotItems = this.ready.epochSlots[slotIndexNum]
    if (!slotItems) {
      return
    }

    // Gray Paper equation 50-60: E removes items whose package hash is in accumulated set,
    // and removes any dependencies which appear in said set
    // Modify items in place - remove accumulated items and filter dependencies
    for (let i = slotItems.length - 1; i >= 0; i--) {
      const item = slotItems[i]
      const packageHash = item.workReport.package_spec.hash

      // Remove if package was already accumulated
      if (accumulatedPackages.has(packageHash)) {
        slotItems.splice(i, 1)
        continue
      }

      // Remove satisfied dependencies in place
      for (const dep of item.dependencies) {
        if (accumulatedPackages.has(dep)) {
          item.dependencies.delete(dep)
        }
      }
    }
  }
}
