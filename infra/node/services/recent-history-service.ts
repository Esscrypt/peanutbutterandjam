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
  bytesToHex,
  defaultKeccakHash,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
  type MMRRange,
  merklizewb,
  mmrappend,
  mmrsuperpeak,
} from '@pbnj/core'
import { calculateBlockHashFromHeader } from '@pbnj/serialization'
import type {
  AccoutBelt,
  BlockBody,
  BlockHeader,
  IConfigService,
  Recent,
  RecentHistoryEntry,
  Safe,
} from '@pbnj/types'

import {
  BaseService as BaseServiceClass,
  HISTORY_CONSTANTS,
  safeError,
  safeResult,
} from '@pbnj/types'

// ============================================================================
// Recent History Service
// ============================================================================

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
  /** Accumulation output belt (for serialization) - contains only non-null peaks */
  private readonly accoutBelt: AccoutBelt
  /** Full MMR range including null positions (for mmrappend/mmrsuperpeak operations) */
  private mmrPeaks: MMRRange = []
  private currentBlockNumber = 0n
  private readonly configService: IConfigService
  constructor(options: {
    eventBusService: EventBusService
    configService: IConfigService
  }) {
    super('recent-history-service')
    this.eventBusService = options.eventBusService
    this.accoutBelt = {
      peaks: [],
      totalCount: 0n,
    }
    this.mmrPeaks = []
    this.configService = options.configService
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
    console.log('Processing block for recent history', {
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

    console.log('Recent history updated', {
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
        history: [
          {
            headerHash:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            stateRoot:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            accoutLogSuperPeak:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            reportedPackageHashes: new Map<Hex, Hex>(),
          },
        ],
        accoutBelt: this.accoutBelt,
      }
    }

    // Return the most recent entry
    return {
      history: this.recentHistory,
      accoutBelt: this.accoutBelt,
    }
  }

  /**
   * Clear recent history (for testing)
   */
  clearHistory(): void {
    this.recentHistory = []
    this.mmrPeaks = []
    this.currentBlockNumber = 0n
    // this.persistenceCounter = 0
    logger.info('Recent history cleared')
  }

  /**
   * Set recent history from pre-state (for test vectors)
   *
   * Sets both recentHistory and accoutBelt from pre_state.beta
   */
  setRecent(recent: Recent): void {
    this.clearHistory()

    // Set history entries
    if (recent.history) {
      for (const entry of recent.history) {
        const reportedPackageHashes = new Map<Hex, Hex>()
        for (const [
          packageHash,
          exportsRoot,
        ] of entry.reportedPackageHashes.entries()) {
          reportedPackageHashes.set(packageHash, exportsRoot)
        }

        this.recentHistory.push({
          headerHash: entry.headerHash,
          stateRoot: entry.stateRoot,
          accoutLogSuperPeak: entry.accoutLogSuperPeak,
          reportedPackageHashes,
        })
      }
    }

    // Set MMR belt from pre_state.beta.mmr.peaks
    // NOTE: MMR peaks can include null values, so we must preserve them
    if (recent.accoutBelt.peaks) {
      // Store full MMR range with nulls as mmrPeaks (Uint8Array[])
      this.mmrPeaks = recent.accoutBelt.peaks.map((p: Hex | null) =>
        p !== null ? hexToBytes(p) : null,
      )

      // Update accoutBelt for compatibility (non-null peaks only)
      this.accoutBelt.peaks = recent.accoutBelt.peaks
        .map((p: Hex | null) => (p !== null ? p : null))
        .filter((p): p is Hex => p !== null)

      this.accoutBelt.totalCount = BigInt(this.mmrPeaks.length)
    } else {
      // If no peaks provided, clear the belt
      this.mmrPeaks = []
      this.accoutBelt.peaks = []
      this.accoutBelt.totalCount = 0n
    }
  }

  /**
   * Update accoutBelt with accumulate_root (for test vectors)
   *
   * Gray Paper: accoutBelt' = mmrappend(accoutBelt, accumulate_root, keccak)
   */
  updateAccoutBeltWithRoot(accumulateRoot: Hex): Safe<void> {
    try {
      const accumulateRootBytes = hexToBytes(accumulateRoot)

      // Append to MMR (uses mmrPeaks which preserves null positions)
      const [mmrError, updatedRange] = mmrappend(
        this.mmrPeaks,
        accumulateRootBytes,
      )

      if (mmrError) {
        return safeError(mmrError)
      }

      // Update internal MMR peaks (preserves null positions)
      this.mmrPeaks = updatedRange

      // Update accoutBelt for compatibility (non-null peaks only)
      this.accoutBelt.peaks = updatedRange
        .map((peak) => (peak !== null ? bytesToHex(peak) : null))
        .filter((peak): peak is Hex => peak !== null)

      this.accoutBelt.totalCount = BigInt(updatedRange.length)

      return safeResult(undefined)
    } catch (error) {
      return safeError(error as Error)
    }
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
    body: BlockBody,
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

    const [accoutLogSuperPeakError, accoutLogSuperPeak] =
      this.calculateAccoutLogSuperPeak()
    if (accoutLogSuperPeakError) {
      throw new Error('Failed to calculate accumulation super-peak')
    }

    return {
      headerHash,
      stateRoot: header.priorStateRoot, // Will be updated during state transition
      accoutLogSuperPeak: bytesToHex(accoutLogSuperPeak),
      reportedPackageHashes,
    }
  }

  /**
   * Add entry to circular buffer
   * Maintains exactly maxHistoryLength entries
   *
   * *** GRAY PAPER FORMULA ***
   * Gray Paper: recent_history.tex, equations 23-25 and 38-43
   *
   * Before adding new entry:
   * - Update previous entry's state_root to parent_state_root (eq 23-25)
   * - New entry's state_root is set to zero (eq 41)
   *
   * Formula:
   * recenthistorypostparentstaterootupdate = recenthistory exc {recenthistory[len-1].stateroot = priorStateRoot}
   * recenthistory' = recenthistorypostparentstaterootupdate append {..., stateroot=0x0, ...}
   */
  public addToHistory(entry: RecentHistoryEntry, parentStateRoot?: Hex): void {
    // Gray Paper eq 23-25: Update previous entry's state_root to parent_state_root
    if (this.recentHistory.length > 0 && parentStateRoot) {
      const previousEntry = this.recentHistory[this.recentHistory.length - 1]
      previousEntry.stateRoot = parentStateRoot
    }

    // Add new entry (state_root should already be 0x0 per eq 41)
    this.recentHistory.push(entry)

    // Maintain circular buffer size
    if (this.recentHistory.length > HISTORY_CONSTANTS.C_RECENTHISTORYLEN) {
      this.recentHistory.shift() // Remove oldest entry
    }
  }

  /**
   * Add block with automatic super-peak calculation
   *
   * Gray Paper: This computes rh_accoutlogsuperpeak = mmrsuperpeak(accoutBelt')
   * from the current accout belt state
   *
   * @param entry - Block entry data (without accoutLogSuperPeak)
   * @param parentStateRoot - Parent block's state root (for eq 23-25)
   */
  public addBlockWithSuperPeak(
    entry: Omit<RecentHistoryEntry, 'accoutLogSuperPeak'>,
    parentStateRoot?: Hex,
  ): void {
    const [error, accoutLogSuperPeak] = this.calculateAccoutLogSuperPeak()
    if (error) {
      logger.error('Failed to calculate super-peak, using zero hash', { error })
    }

    const beefyRoot = error
      ? '0x0000000000000000000000000000000000000000000000000000000000000000'
      : bytesToHex(accoutLogSuperPeak)

    this.addToHistory(
      {
        ...entry,
        accoutLogSuperPeak: beefyRoot,
      },
      parentStateRoot,
    )
  }

  /**
   * Update accumulation output belt
   *
   * *** GRAY PAPER FORMULA ***
   * Gray Paper: recent_history.tex, equations 28-32
   *
   * Process:
   * 1. Get lastaccout' (accumulation output sequence) from block body
   * 2. Encode: s = [encode[4](serviceId) concat encode(hash) for each (serviceId, hash)]
   * 3. Merklize: merklizewb(s, keccak)
   * 4. Append to belt: mmrappend(accoutBelt, merklize_result, keccak)
   * 5. Update accoutBelt.peaks
   *
   * Formula:
   * using s = [encode[4](s) concat encode(h) : (s, h) in lastaccout']
   * accoutBelt' = mmrappend(accoutBelt, merklizewb(s, keccak), keccak)
   *
   * Note: lastaccout' is defined in accumulation.tex eq 370:
   * lastaccout' ≡ [tuple{s, h} ∈ b] where b is local_fnservouts (accumulation output pairings)
   * Each tuple represents a service that was accumulated in this block.
   */
  private updateAccoutBelt(body: BlockBody): Safe<void> {
    // Step 1: Extract lastaccout' from block body
    // According to accumulation.tex eq 370, lastaccout' comes from accumulation outputs
    // The guarantees extrinsic references work reports that were accumulated.
    // Each guarantee.report.results contains WorkResult with service_id.
    // The hash comes from the accumulation output (poststate hash or code_hash).
    //
    // Gray Paper: lastaccout' ∈ sequence{tuple{serviceid, hash}}
    // Extract from guarantees' work reports:
    const lastaccout: Array<{ serviceId: bigint; hash: Uint8Array }> = []

    // Extract from guarantees: each guarantee references an accumulated work report
    for (const guarantee of body.guarantees) {
      const workReport = guarantee.report
      // Each work report can have multiple results (one per service accumulated)
      for (const result of workReport.results) {
        // service_id from the result
        const serviceId = result.service_id

        // Hash: use code_hash from the result as it represents the service state
        // Gray Paper accumulation.tex: the hash is the accumulation output hash
        // Using code_hash as it uniquely identifies the service code at accumulation time
        const hash = hexToBytes(result.code_hash)

        lastaccout.push({ serviceId, hash })
      }
    }

    // Step 2: Encode the sequence per Gray Paper equation 29
    // s = [encode[4](s) concat encode(h) : (s, h) in lastaccout']
    const encodedSequence: Uint8Array[] = lastaccout.map(
      ({ serviceId, hash }) => {
        // encode[4](serviceId) - 4-byte encoding
        const serviceIdBytes = new Uint8Array(4)
        const view = new DataView(serviceIdBytes.buffer)
        view.setUint32(0, Number(serviceId), false) // big-endian

        // Concatenate serviceId + hash
        const combined = new Uint8Array(4 + hash.length)
        combined.set(serviceIdBytes, 0)
        combined.set(hash, 4)

        return combined
      },
    )

    // Step 3: Merklize the encoded sequence
    // merklizewb(s, keccak) creates a well-balanced merkle tree
    const [merklizeError, merklizedRoot] = merklizewb(encodedSequence)
    if (merklizeError) {
      logger.error('Failed to merklize accumulation outputs', {
        error: merklizeError,
      })
      return safeResult(undefined) // Skip update on error
    }

    // Step 4: Convert accoutBelt.peaks to MMRRange (nullable array)
    const mmrRange: MMRRange = this.accoutBelt.peaks.map((peak) =>
      peak !== null ? hexToBytes(peak) : null,
    )

    // Step 5: Append to MMR belt
    // accoutBelt' = mmrappend(accoutBelt, merklizewb(s, keccak), keccak)
    const [mmrError, updatedRange] = mmrappend(
      mmrRange,
      merklizedRoot,
      defaultKeccakHash,
    )

    if (mmrError) {
      logger.error('Failed to append to MMR belt', { error: mmrError })
      return safeResult(undefined) // Skip update on error
    }

    // Step 6: Update accoutBelt with new peaks (filter out nulls)
    this.accoutBelt.peaks = updatedRange
      .map((peak) => (peak !== null ? bytesToHex(peak) : null))
      .filter((peak): peak is Hex => peak !== null)

    this.accoutBelt.totalCount = BigInt(this.accoutBelt.peaks.length)

    return safeResult(undefined)
  }

  /**
   * Extract reported package hashes from block body
   *
   * Gray Paper Reference: Equation (44-52)
   */
  private extractReportedPackageHashes(body: BlockBody): Map<Hex, Hex> {
    const packageHashes = new Map<Hex, Hex>()
    for (const guarantee of body.guarantees) {
      packageHashes.set(
        guarantee.report.package_spec.hash,
        guarantee.report.segment_root_lookup.find(
          (lookup) =>
            lookup.work_package_hash === guarantee.report.package_spec.hash,
        )?.segment_tree_root ||
          '0x0000000000000000000000000000000000000000000000000000000000000000',
      )
    }
    return packageHashes
  }

  /**
   * Calculate accumulation output super-peak
   *
   * *** GRAY PAPER FORMULA ***
   * Gray Paper: recent_history.tex, equation 42
   *
   * Formula: rh_accoutlogsuperpeak = mmrsuperpeak(accoutBelt')
   *
   * The super-peak is a single hash commitment to the entire MMR belt
   */
  private calculateAccoutLogSuperPeak(): Safe<Uint8Array> {
    // Use mmrPeaks which preserves null positions
    // mmrsuperpeak filters out nulls internally and computes the super-peak
    return mmrsuperpeak(this.mmrPeaks)
  }
}
