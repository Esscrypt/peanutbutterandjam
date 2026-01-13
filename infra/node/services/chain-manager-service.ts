/**
 * Chain Manager Service
 *
 * Handles block import, fork resolution, and chain reorganization according to
 * Gray Paper specifications for GRANDPA and best chain selection.
 *
 * Gray Paper Reference: Section "Grandpa and the Best Chain" (best_chain.tex)
 *
 * Key responsibilities:
 * 1. Track multiple fork heads (unfinalized chains)
 * 2. Implement best chain selection (maximize ticketed blocks)
 * 3. Handle GRANDPA finalization
 * 4. Manage chain reorganization (reorgs)
 * 5. Maintain state snapshots for each fork head
 * 6. Support ancestry feature for lookup anchor validation (jam-conformance M1)
 *
 * Ancestry Feature (jam-conformance):
 * - The lookup anchor of each report in guarantees extrinsic must be within last L headers
 * - Full spec: L = 14,400 (~24 hours at 6s slots)
 * - Tiny spec: L = 24 (~2.4 minutes at 6s slots)
 *
 * Forking Feature (jam-conformance):
 * - Mutations are siblings of original block (same parent)
 * - Mutations are never used as parents for subsequent blocks
 * - Original block is always finalized after mutations
 */

import type { Hex } from '@pbnjam/core'
import { logger } from '@pbnjam/core'
import type { Block, BlockHeader, Safe, SafePromise } from '@pbnjam/types'
import { BaseService, safeError, safeResult } from '@pbnjam/types'

/**
 * Represents a chain fork with its head block and state
 */
interface ChainFork {
  /** Block header hash of the fork head */
  headHash: Hex
  /** Block header of the fork head */
  head: BlockHeader
  /** State root at this fork head */
  stateRoot: Hex
  /** Number of ticketed blocks in this chain (for fork choice) */
  ticketedCount: number
  /** Whether this fork is audited */
  isAudited: boolean
  /** Ancestor hashes (for ancestor checks) - limited to maxLookupAnchorage */
  ancestors: Set<Hex>
  /** Ordered list of ancestor hashes (most recent first) for lookup anchor validation */
  ancestorList: Hex[]
}

/**
 * Chain reorganization event
 *
 * Used when switching between forks to track which blocks need to be
 * reverted and which need to be applied.
 */
export interface ReorgEvent {
  /** Old chain head before reorg */
  oldHead: Hex
  /** New chain head after reorg */
  newHead: Hex
  /** Blocks that were reverted */
  revertedBlocks: Hex[]
  /** Blocks that were applied */
  appliedBlocks: Hex[]
}

/**
 * Configuration for chain manager
 */
interface ChainManagerConfig {
  /** Maximum lookup anchorage (L in Gray Paper) - default 14400 for full, 24 for tiny */
  maxLookupAnchorage: number
  /** Whether ancestry feature is enabled */
  ancestryEnabled: boolean
  /** Whether forking feature is enabled */
  forkingEnabled: boolean
}

export interface IChainManagerService {
  /**
   * Import a new block
   *
   * Gray Paper: Block must have timeslot > previous block's timeslot
   * Handles fork creation if block's parent is not current best head
   */
  importBlock(block: Block): SafePromise<void>

  /**
   * Get the current best block head
   *
   * Gray Paper: Best block maximizes ticketed ancestors and is audited
   */
  getBestHead(): BlockHeader | null

  /**
   * Get the finalized block head
   *
   * Gray Paper: Finalized by GRANDPA consensus
   */
  getFinalizedHead(): BlockHeader | null

  /**
   * Finalize a block (called by GRANDPA)
   *
   * Gray Paper: Prunes all forks not containing this block
   */
  finalizeBlock(blockHash: Hex): Safe<void>

  /**
   * Check if a block is an ancestor of the best chain
   */
  isAncestorOfBest(blockHash: Hex): boolean

  /**
   * Check if a block hash is a valid lookup anchor
   *
   * Gray Paper: Lookup anchor must be within last L imported headers
   * jam-conformance: Required for M1 compliance when ancestry feature enabled
   */
  isValidLookupAnchor(anchorHash: Hex): boolean

  /**
   * Get the list of valid lookup anchors (last L block hashes)
   */
  getValidLookupAnchors(): Hex[]

  /**
   * Initialize ancestry from external source (e.g., fuzzer Initialize message)
   *
   * jam-conformance: The Initialize message contains ancestor list for first block
   */
  initializeAncestry(ancestors: Hex[]): void

  /**
   * Get all active fork heads
   */
  getActiveForks(): ChainFork[]

  /**
   * Handle equivocation detection (two blocks at same slot)
   *
   * Gray Paper: Blocks with equivocations are not acceptable
   */
  reportEquivocation(blockA: Hex, blockB: Hex): void

  /**
   * Clear all state (for testing/fork switching)
   */
  clear(): void
}

export class ChainManagerService
  extends BaseService
  implements IChainManagerService
{
  /** All known forks (keyed by head hash) */
  private forks: Map<Hex, ChainFork> = new Map()

  /** Finalized block header */
  private finalizedHead: BlockHeader | null = null
  private finalizedHash: Hex | null = null

  /** Current best block header */
  private bestHead: BlockHeader | null = null
  private bestHash: Hex | null = null

  /** Block storage (hash -> block) */
  private blocks: Map<Hex, Block> = new Map()

  /** Parent -> children mapping for fork traversal */
  private children: Map<Hex, Set<Hex>> = new Map()

  /** Equivocating block pairs (slot -> set of block hashes) */
  private equivocations: Map<bigint, Set<Hex>> = new Map()

  /** State snapshots for each block (hash -> state snapshot) */
  private stateSnapshots: Map<Hex, unknown> = new Map()

  /** Configuration */
  private config: ChainManagerConfig

  /**
   * Ordered list of valid lookup anchors (most recent first)
   * Limited to maxLookupAnchorage entries
   * Used for validating guarantee lookup anchors per Gray Paper
   */
  private lookupAnchors: Hex[] = []

  constructor(config?: Partial<ChainManagerConfig>) {
    super('chain-manager-service')
    this.config = {
      maxLookupAnchorage: config?.maxLookupAnchorage ?? 14400, // Full spec default
      ancestryEnabled: config?.ancestryEnabled ?? true,
      forkingEnabled: config?.forkingEnabled ?? true,
    }
  }

  async importBlock(block: Block): SafePromise<void> {
    const blockHash = this.hashBlock(block.header)

    // Check if block already exists
    if (this.blocks.has(blockHash)) {
      return safeResult(undefined) // Already imported
    }

    // Validate block is not in the future
    // Gray Paper: Blocks with timeslot > wall clock are invalid
    // (This would be done by block validation, not here)

    // Check for equivocation (another block at same slot)
    const existingAtSlot = this.findBlockAtSlot(block.header.timeslot)
    if (existingAtSlot && existingAtSlot !== blockHash) {
      this.reportEquivocation(existingAtSlot, blockHash)
      logger.warn('Equivocation detected', {
        slot: block.header.timeslot.toString(),
        block1: existingAtSlot,
        block2: blockHash,
      })
    }

    // Store the block
    this.blocks.set(blockHash, block)

    // Update parent -> children mapping
    const parentHash = block.header.parent
    if (!this.children.has(parentHash)) {
      this.children.set(parentHash, new Set())
    }
    this.children.get(parentHash)!.add(blockHash)

    // Create or update fork
    const fork = this.createOrUpdateFork(block, blockHash)
    this.forks.set(blockHash, fork)

    // Remove parent from forks (it's no longer a head)
    this.forks.delete(parentHash)

    // Update best head if this fork is better
    this.updateBestHead()

    // Update lookup anchors for the best chain
    // Only add to anchors if this becomes the best head
    if (this.bestHash === blockHash) {
      this.updateLookupAnchors(blockHash)
    }

    logger.info('Block imported', {
      hash: blockHash,
      slot: block.header.timeslot.toString(),
      parent: parentHash,
      isBest: this.bestHash === blockHash,
      lookupAnchorsCount: this.lookupAnchors.length,
    })

    return safeResult(undefined)
  }

  getBestHead(): BlockHeader | null {
    return this.bestHead
  }

  getFinalizedHead(): BlockHeader | null {
    return this.finalizedHead
  }

  finalizeBlock(blockHash: Hex): Safe<void> {
    const block = this.blocks.get(blockHash)
    if (!block) {
      return safeError(new Error(`Block not found: ${blockHash}`))
    }

    // Update finalized head
    this.finalizedHead = block.header
    this.finalizedHash = blockHash

    // Prune forks that don't contain this block as ancestor
    for (const [forkHash, fork] of this.forks) {
      if (!fork.ancestors.has(blockHash) && forkHash !== blockHash) {
        this.pruneFork(forkHash)
      }
    }

    // Clean up old state snapshots
    this.cleanupStateSnapshots(blockHash)

    logger.info('Block finalized', {
      hash: blockHash,
      slot: block.header.timeslot.toString(),
    })

    return safeResult(undefined)
  }

  isAncestorOfBest(blockHash: Hex): boolean {
    if (!this.bestHash) return false
    const bestFork = this.forks.get(this.bestHash)
    if (!bestFork) return false
    return bestFork.ancestors.has(blockHash) || this.bestHash === blockHash
  }

  getActiveForks(): ChainFork[] {
    return Array.from(this.forks.values())
  }

  /**
   * Check if a block hash is a valid lookup anchor
   *
   * Gray Paper: The lookup anchor of each report in guarantees extrinsic
   * must be included within the last L imported headers in the chain.
   *
   * jam-conformance: When ancestry feature is disabled, this check should be skipped
   */
  isValidLookupAnchor(anchorHash: Hex): boolean {
    if (!this.config.ancestryEnabled) {
      // When ancestry feature is disabled, all anchors are valid
      return true
    }
    return this.lookupAnchors.includes(anchorHash)
  }

  /**
   * Get the list of valid lookup anchors (last L block hashes)
   */
  getValidLookupAnchors(): Hex[] {
    return [...this.lookupAnchors]
  }

  /**
   * Initialize ancestry from external source
   *
   * jam-conformance: The fuzzer's Initialize message includes the list of ancestors
   * for the first block to be imported. This allows validating lookup anchors
   * even when we don't have the full chain history.
   */
  initializeAncestry(ancestors: Hex[]): void {
    // Clear existing anchors
    this.lookupAnchors = []

    // Add ancestors (most recent first, limited to maxLookupAnchorage)
    const limit = Math.min(ancestors.length, this.config.maxLookupAnchorage)
    for (let i = 0; i < limit; i++) {
      this.lookupAnchors.push(ancestors[i])
    }

    logger.info('Ancestry initialized', {
      ancestorCount: ancestors.length,
      storedCount: this.lookupAnchors.length,
      maxLookupAnchorage: this.config.maxLookupAnchorage,
    })
  }

  /**
   * Clear all state (for testing/fork switching)
   */
  clear(): void {
    this.forks.clear()
    this.blocks.clear()
    this.children.clear()
    this.equivocations.clear()
    this.stateSnapshots.clear()
    this.lookupAnchors = []
    this.finalizedHead = null
    this.finalizedHash = null
    this.bestHead = null
    this.bestHash = null

    logger.info('Chain manager state cleared')
  }

  reportEquivocation(blockA: Hex, blockB: Hex): void {
    const blockAData = this.blocks.get(blockA)
    if (!blockAData) return

    const slot = blockAData.header.timeslot
    if (!this.equivocations.has(slot)) {
      this.equivocations.set(slot, new Set())
    }
    this.equivocations.get(slot)!.add(blockA)
    this.equivocations.get(slot)!.add(blockB)

    // Recalculate best head (equivocating chains are not acceptable)
    this.updateBestHead()
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private hashBlock(header: BlockHeader): Hex {
    // In real implementation, this would compute the block hash
    // For now, return a placeholder
    return `0x${header.timeslot.toString(16).padStart(64, '0')}` as Hex
  }

  private findBlockAtSlot(slot: bigint): Hex | null {
    for (const [hash, block] of this.blocks) {
      if (block.header.timeslot === slot) {
        return hash
      }
    }
    return null
  }

  private createOrUpdateFork(block: Block, blockHash: Hex): ChainFork {
    const parentHash = block.header.parent
    const parentFork = this.forks.get(parentHash)

    // Build ancestors set
    const ancestors = new Set<Hex>()
    if (parentFork) {
      for (const ancestor of parentFork.ancestors) {
        ancestors.add(ancestor)
      }
    }
    ancestors.add(parentHash)

    // Build ordered ancestor list (most recent first, limited to maxLookupAnchorage)
    let ancestorList: Hex[] = []
    if (parentFork) {
      // Copy parent's list and prepend parent hash
      ancestorList = [parentHash, ...parentFork.ancestorList]
    } else if (this.lookupAnchors.length > 0) {
      // If no parent fork, use initialized ancestry with parent prepended
      if (!this.lookupAnchors.includes(parentHash)) {
        ancestorList = [parentHash, ...this.lookupAnchors]
      } else {
        ancestorList = [...this.lookupAnchors]
      }
    } else {
      ancestorList = [parentHash]
    }
    // Limit to maxLookupAnchorage
    ancestorList = ancestorList.slice(0, this.config.maxLookupAnchorage)

    // Count ticketed blocks (for fork choice)
    // Gray Paper: Prefer chains with more ticketed (non-fallback) blocks
    const isTicketed = this.isBlockTicketed(block)
    const ticketedCount =
      (parentFork?.ticketedCount ?? 0) + (isTicketed ? 1 : 0)

    return {
      headHash: blockHash,
      head: block.header,
      stateRoot: block.header.priorStateRoot, // Would be computed after execution
      ticketedCount,
      isAudited: true, // Would be determined by auditing service
      ancestors,
      ancestorList,
    }
  }

  private isBlockTicketed(_block: Block): boolean {
    // Gray Paper: Check if block was sealed with a ticket vs fallback
    // This would inspect the seal signature to determine sealing mode
    // TODO: Implement actual ticket detection from seal signature
    return true // Placeholder
  }

  /**
   * Update lookup anchors when best head changes
   *
   * Uses the ancestor list from the new best fork
   */
  private updateLookupAnchors(newBestHash: Hex): void {
    const bestFork = this.forks.get(newBestHash)
    if (!bestFork) return

    // The lookup anchors are the ancestors of the best chain
    this.lookupAnchors = [...bestFork.ancestorList]
  }

  /**
   * Update best head based on Gray Paper fork choice rule
   *
   * Gray Paper: Best block maximizes Σ(isticketed) for all ancestors
   */
  private updateBestHead(): void {
    let bestFork: ChainFork | null = null
    let bestTicketedCount = -1

    for (const fork of this.forks.values()) {
      // Skip forks with equivocations
      if (this.hasEquivocation(fork)) {
        continue
      }

      // Skip unaudited forks
      if (!fork.isAudited) {
        continue
      }

      // Skip forks that don't descend from finalized block
      if (this.finalizedHash && !fork.ancestors.has(this.finalizedHash)) {
        continue
      }

      // Choose fork with most ticketed blocks
      if (fork.ticketedCount > bestTicketedCount) {
        bestTicketedCount = fork.ticketedCount
        bestFork = fork
      }
    }

    if (bestFork) {
      this.bestHead = bestFork.head
      this.bestHash = bestFork.headHash
    }
  }

  private hasEquivocation(fork: ChainFork): boolean {
    // Check if any ancestor has an equivocation (after finalization)
    for (const equivocatingBlocks of this.equivocations.values()) {
      for (const blockHash of equivocatingBlocks) {
        if (fork.ancestors.has(blockHash)) {
          // Check if this equivocation is after finalization
          const block = this.blocks.get(blockHash)
          if (block && this.finalizedHead) {
            if (block.header.timeslot > this.finalizedHead.timeslot) {
              return true
            }
          }
        }
      }
    }
    return false
  }

  private pruneFork(forkHash: Hex): void {
    const fork = this.forks.get(forkHash)
    if (!fork) return

    logger.info('Pruning fork', { hash: forkHash })

    // Remove fork head
    this.forks.delete(forkHash)

    // Clean up state snapshot
    this.stateSnapshots.delete(forkHash)

    // Note: We don't delete blocks from this.blocks because they might
    // be ancestors of other forks. Cleanup happens during finalization.
  }

  private cleanupStateSnapshots(finalizedHash: Hex): void {
    // Remove state snapshots for blocks that are now finalized ancestors
    // (We only need snapshots for unfinalized blocks for potential reorgs)
    const finalizedBlock = this.blocks.get(finalizedHash)
    if (!finalizedBlock) return

    for (const [hash] of this.stateSnapshots) {
      const block = this.blocks.get(hash)
      if (block && block.header.timeslot < finalizedBlock.header.timeslot) {
        this.stateSnapshots.delete(hash)
      }
    }
  }
}
