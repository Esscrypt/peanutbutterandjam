/**
 * Recent History Service
 *
 * Implements Gray Paper Section: Recent History (β)
 *
 * Gray Paper Reference: graypaper/text/recent_history.tex
 *
 * This service manages the most recent Crecenthistorylen (8) blocks to prevent
 * duplicate or out-of-date work-reports from being submitted.
 *
 * Key Components:
 * - Recent History (β_H): Information on the most recent blocks
 * - Accumulation Output Belt (β_B): Merkle mountain range of accumulation outputs
 *
 * Storage Strategy:
 * - Primary: In-memory circular buffer (8 blocks × ~200 bytes = ~1.6KB)
 * - Secondary: Database persistence for node recovery
 *
 * Gray Paper Constants:
 * - Crecenthistorylen = 8 (number of recent blocks to track)
 * - Ccorecount = 341 (maximum cores, affects reportedpackagehashes size)
 */

import {
  type BlockProcessedEvent,
  type EventBusService,
  type Hex,
  logger,
  type Safe,
  safeResult,
} from '@pbnj/core'
import { calculateBlockHashFromHeader } from '@pbnj/serialization'
import type {
  AccoutBelt,
  BlockHeader,
  IConfigService,
  Recent,
} from '@pbnj/types'
import { BaseService as BaseServiceClass } from '@pbnj/types'

// ============================================================================
// Recent History Service
// ============================================================================

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
 * Recent history service configuration
 */
export interface RecentHistoryConfig {
  /** Maximum number of recent blocks to track (default: 8) */
  maxHistoryLength: number
  /** Whether to persist to database (default: true) */
  enablePersistence: boolean
  /** Database persistence interval in blocks (default: 1) */
  persistenceInterval: number
}

/**
 * Recent History Service
 *
 * Manages the most recent Crecenthistorylen blocks according to Gray Paper
 * specifications. Uses a circular buffer for efficient in-memory storage
 * with optional database persistence.
 */
export class RecentHistoryService extends BaseServiceClass {
  private readonly eventBusService: EventBusService
  private recentHistory: RecentHistoryEntry[] = []
  private readonly accoutBelt: AccoutBelt
  private currentBlockNumber = 0n
  private readonly configService: IConfigService
  constructor(eventBusService: EventBusService, configService: IConfigService) {
    super('recent-history-service')
    this.eventBusService = eventBusService
    this.accoutBelt = {
      peaks: [],
      totalCount: 0n,
    }
    this.configService = configService
  }

  override start(): Safe<boolean> {
    // Register event handlers
    this.eventBusService.addBlockProcessedCallback(
      this.handleBlockProcessed.bind(this),
    )
    return safeResult(true)
  }

  override stop(): Safe<boolean> {
    // Remove event handlers
    // Note: EventBusService doesn't have remove methods for the new callbacks yet
    this.eventBusService.removeBlockProcessedCallback(
      this.handleBlockProcessed.bind(this),
    )

    return safeResult(true)
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle block processing event
   * Updates recent history with new block information
   *
   * Gray Paper Reference: Equation (36-54)
   */
  private async handleBlockProcessed(
    event: BlockProcessedEvent,
  ): Promise<Safe<void>> {
    logger.debug('Processing block for recent history', {
      slot: event.slot.toString(),
      authorIndex: event.authorIndex,
      blockNumber: this.currentBlockNumber.toString(),
    })

    // Create new recent history entry
    const newEntry = this.createRecentHistoryEntry(
      event.header,
      event.body,
      this.configService,
    )

    // Add to circular buffer
    this.addToHistory(newEntry)

    // Update accumulation belt (simplified for now)
    this.updateAccoutBelt(event.body)

    // Increment block counter
    this.currentBlockNumber++

    // Persist to database if enabled
    // if (this.config.enablePersistence) {
    //   this.persistenceCounter++
    //   if (this.persistenceCounter >= this.config.persistenceInterval) {
    //     await this.persistToDatabase()
    //     this.persistenceCounter = 0
    //   }
    // }

    logger.debug('Recent history updated', {
      historyLength: this.recentHistory.length,
      blockNumber: this.currentBlockNumber.toString(),
    })

    return safeResult(undefined)
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get current recent history
   */
  getRecentHistory(): RecentHistoryEntry[] {
    return [...this.recentHistory] // Return copy to prevent mutation
  }

  /**
   * Get recent history for specific block
   */
  getRecentHistoryForBlock(headerHash: Hex): RecentHistoryEntry | null {
    return (
      this.recentHistory.find((entry) => entry.headerHash === headerHash) ||
      null
    )
  }

  /**
   * Check if a block hash is in recent history (for anchor validation)
   *
   * Gray Paper Reference: Equation (333-335)
   */
  isValidAnchor(anchorHash: Hex): boolean {
    return this.recentHistory.some((entry) => entry.headerHash === anchorHash)
  }

  /**
   * Get recent history as Gray Paper Recent interface
   */
  getRecent(): Recent {
    if (this.recentHistory.length === 0) {
      return {
        history: {
          headerHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          stateRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          accoutLogSuperPeak:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          reportedPackageHashes: [],
        },
        accoutBelt: this.accoutBelt,
      }
    }

    // Return the most recent entry
    const latestEntry = this.recentHistory[this.recentHistory.length - 1]
    return {
      history: {
        headerHash: latestEntry.headerHash,
        stateRoot: latestEntry.stateRoot,
        accoutLogSuperPeak: latestEntry.accoutLogSuperPeak,
        reportedPackageHashes: Array.from(
          latestEntry.reportedPackageHashes.keys(),
        ),
      },
      accoutBelt: this.accoutBelt,
    }
  }

  /**
   * Clear recent history (for testing)
   */
  clearHistory(): void {
    this.recentHistory = []
    this.currentBlockNumber = 0n
    // this.persistenceCounter = 0
    logger.info('Recent history cleared')
  }

  // ============================================================================
  // Private Implementation
  // ============================================================================

  /**
   * Create recent history entry from block data
   *
   * Gray Paper Reference: Equation (36-54)
   */
  private createRecentHistoryEntry(
    header: BlockHeader,
    body: unknown,
    config: IConfigService,
  ): RecentHistoryEntry {
    // Extract reported package hashes from guarantees extrinsic
    const reportedPackageHashes = this.extractReportedPackageHashes(body)

    const [headerHashError, headerHash] = calculateBlockHashFromHeader(
      header,
      config,
    )
    if (headerHashError) {
      throw new Error('Failed to calculate header hash')
    }

    return {
      headerHash,
      stateRoot: header.priorStateRoot, // Will be updated during state transition
      accoutLogSuperPeak: this.calculateAccoutLogSuperPeak(body),
      reportedPackageHashes,
    }
  }

  /**
   * Add entry to circular buffer
   * Maintains exactly maxHistoryLength entries
   */
  private addToHistory(entry: RecentHistoryEntry): void {
    this.recentHistory.push(entry)

    // Maintain circular buffer size
    if (this.recentHistory.length > 8) {
      this.recentHistory.shift() // Remove oldest entry
    }
  }

  /**
   * Update accumulation output belt
   *
   * Gray Paper Reference: Equation (28-32)
   */
  private updateAccoutBelt(_body: unknown): void {
    // TODO: Implement proper MMR (Merkle Mountain Range) logic
    // For now, just add a placeholder peak
    const newPeak = this.calculateAccumulationPeak(_body)
    this.accoutBelt.peaks.push(newPeak)

    // Maintain reasonable size (simplified)
    if (this.accoutBelt.peaks.length > 100) {
      this.accoutBelt.peaks.shift()
    }
  }

  /**
   * Extract reported package hashes from block body
   *
   * Gray Paper Reference: Equation (44-52)
   */
  private extractReportedPackageHashes(_body: unknown): Map<Hex, Hex> {
    const packageHashes = new Map<Hex, Hex>()

    // TODO: Implement proper extraction from guarantees extrinsic
    // This would parse the guarantees extrinsic and extract:
    // - packageHash from work report availability spec
    // - segRoot from work report availability spec

    // For now, return empty map
    return packageHashes
  }

  /**
   * Calculate accumulation output super-peak
   *
   * Gray Paper Reference: Equation (42)
   */
  private calculateAccoutLogSuperPeak(_body: unknown): Hex {
    // TODO: Implement proper MMR super-peak calculation
    // For now, return placeholder
    return '0x0000000000000000000000000000000000000000000000000000000000000000'
  }

  /**
   * Calculate accumulation peak for MMR
   */
  private calculateAccumulationPeak(_body: unknown): Hex {
    // TODO: Implement proper accumulation peak calculation
    // For now, return placeholder
    return '0x0000000000000000000000000000000000000000000000000000000000000000'
  }

  /**
   * Persist recent history to database
   */
  // private async persistToDatabase(): Promise<void> {
  //   // TODO: Implement database persistence
  //   // This would save recent history entries to a database table
  //   logger.debug('Persisting recent history to database', {
  //     historyLength: this.recentHistory.length,
  //   })
  // }
}
