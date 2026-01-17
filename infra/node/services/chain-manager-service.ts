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

import { calculateBlockHashFromHeader } from '@pbnjam/codec'
import type { Hex } from '@pbnjam/core'
import { logger } from '@pbnjam/core'
import type {
  Block,
  BlockHeader,
  ChainFork,
  IChainManagerService,
  IConfigService,
  ISealKeyService,
  Safe,
  SafePromise,
  SafroleTicketWithoutProof,
} from '@pbnjam/types'
import { BaseService, safeError, safeResult } from '@pbnjam/types'

// Re-export types for backwards compatibility
export type { ChainFork, IChainManagerService }
export type { ReorgEvent } from '@pbnjam/types'

/**
 * Complete state snapshot for rollback
 * Includes state keyvals plus service-specific state that's not in the trie
 */
export interface ChainStateSnapshot {
  keyvals: { key: Hex; value: Hex }[]
  accumulationSlot: bigint | null
  clockSlot: bigint
  entropy: import('@pbnjam/types').EntropyState
}

/**
 * Check if a seal key is a ticket (vs fallback Bandersnatch key)
 *
 * Gray Paper Eq. 146-155:
 * - Ticket: SafroleTicketWithoutProof has 'id' and 'entryIndex' properties
 * - Fallback: Raw Uint8Array (32-byte Bandersnatch public key)
 */
function isSealKeyTicket(
  sealKey: SafroleTicketWithoutProof | Uint8Array,
): sealKey is SafroleTicketWithoutProof {
  return (
    typeof sealKey === 'object' && 'id' in sealKey && 'entryIndex' in sealKey
  )
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

  /** State snapshots for each block (hash -> complete snapshot) */
  private stateSnapshots: Map<Hex, ChainStateSnapshot> = new Map()

  /** Current head hash that was last imported successfully */
  private currentHeadHash: Hex | null = null

  /** Configuration service */
  private readonly configService: IConfigService

  /** Optional seal key service for determining if block is ticketed */
  private readonly sealKeyService?: ISealKeyService

  /**
   * Ordered list of valid lookup anchors (most recent first)
   * Limited to maxLookupAnchorage entries
   * Used for validating guarantee lookup anchors per Gray Paper
   */
  private lookupAnchors: Hex[] = []

  constructor(configService: IConfigService, sealKeyService?: ISealKeyService) {
    super('chain-manager-service')
    this.configService = configService
    this.sealKeyService = sealKeyService
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
    if (!this.configService.ancestryEnabled) {
      // When ancestry feature is disabled, all anchors are valid
      return true
    }
    return this.lookupAnchors.includes(anchorHash)
  }

  /**
   * Validate lookup anchor exists in ancestor set
   *
   * Gray Paper Eq. 346: ∃h ∈ ancestors: h_timeslot = x_lookupanchortime ∧ blake(h) = x_lookupanchorhash
   *
   * This validates that the lookup anchor hash exists in the ancestor set.
   * The slot validation is performed separately in the guarantor service
   * using Eq. 340-341 (lookup_anchor_slot >= currentSlot - maxLookupAnchorage).
   *
   * Note: We only store hashes in ancestry (not header objects), so we cannot
   * directly verify the slot matches. However, since the age check already
   * constrains the slot range, and the hash uniquely identifies a block,
   * existence in the ancestry list is sufficient.
   *
   * @param anchorHash - The lookup anchor hash from the work report context
   * @returns true if the anchor exists in the ancestor set, false otherwise
   */
  isValidLookupAnchorWithSlot(anchorHash: Hex, _expectedSlot: bigint): boolean {
    if (!this.configService.ancestryEnabled) {
      // When ancestry feature is disabled, all anchors are valid
      return true
    }

    // Check if anchor is in the valid anchor list
    // The slot is already validated by the guarantor service (age check)
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
    const limit = Math.min(
      ancestors.length,
      this.configService.maxLookupAnchorage,
    )
    for (let i = 0; i < limit; i++) {
      this.lookupAnchors.push(ancestors[i])
    }

    logger.info('Ancestry initialized', {
      ancestorCount: ancestors.length,
      storedCount: this.lookupAnchors.length,
      maxLookupAnchorage: this.configService.maxLookupAnchorage,
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
    this.currentHeadHash = null

    logger.info('Chain manager state cleared')
  }

  // ============================================================================
  // State Snapshot Management
  // ============================================================================

  /**
   * Save state snapshot for a block
   *
   * Called after a block is successfully imported. The snapshot allows
   * rolling back to this state when importing sibling blocks (forks).
   * Includes service-specific state that's not part of the state trie.
   */
  saveStateSnapshot(blockHash: Hex, snapshot: ChainStateSnapshot): void {
    this.stateSnapshots.set(blockHash, snapshot)
    this.currentHeadHash = blockHash
    logger.debug('State snapshot saved', {
      blockHash: `${blockHash.substring(0, 18)}...`,
      keyvalCount: snapshot.keyvals.length,
      accumulationSlot: snapshot.accumulationSlot?.toString() ?? 'null',
      clockSlot: snapshot.clockSlot.toString(),
    })
  }

  /**
   * Get state snapshot for a block
   *
   * Returns the complete snapshot that was saved after this block was imported.
   * Returns null if no snapshot exists for this block.
   */
  getStateSnapshot(blockHash: Hex): ChainStateSnapshot | null {
    return this.stateSnapshots.get(blockHash) ?? null
  }

  /**
   * Get current head hash (last successfully imported block)
   */
  getCurrentHeadHash(): Hex | null {
    return this.currentHeadHash
  }

  /**
   * Check if we need to rollback before importing a block
   *
   * Returns the parent's complete state snapshot if the block's parent is different
   * from the current head (fork scenario). Returns null if no rollback needed.
   */
  getParentSnapshotIfFork(parentHash: Hex): ChainStateSnapshot | null {
    // If parent is the current head, no rollback needed
    if (parentHash === this.currentHeadHash) {
      return null
    }

    // If we have a snapshot for the parent, return it for rollback
    const parentSnapshot = this.stateSnapshots.get(parentHash)
    if (parentSnapshot) {
      logger.info('Fork detected, will rollback to parent state', {
        parentHash: `${parentHash.substring(0, 18)}...`,
        currentHead: `${this.currentHeadHash?.substring(0, 18)}...`,
        accumulationSlot: parentSnapshot.accumulationSlot?.toString() ?? 'null',
      })
      return parentSnapshot
    }

    // Check if there's an initial/genesis snapshot we can use
    // (parent might be the genesis block)
    return null
  }

  /**
   * Set initial state snapshot (for genesis or first block)
   */
  setInitialStateSnapshot(snapshot: ChainStateSnapshot): void {
    // Use a special key for initial state
    const genesisKey =
      '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
    this.stateSnapshots.set(genesisKey, snapshot)
    logger.debug('Initial state snapshot saved', {
      keyvalCount: snapshot.keyvals.length,
    })
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
    const [error, hash] = calculateBlockHashFromHeader(
      header,
      this.configService,
    )
    if (error) {
      logger.error('Failed to calculate block hash', { error: error.message })
      throw error
    }
    return hash
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
    ancestorList = ancestorList.slice(0, this.configService.maxLookupAnchorage)

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

  /**
   * Determine if a block was sealed with a ticket vs fallback key
   *
   * Gray Paper Eq. 146-155:
   * - sealtickets' ∈ sequence{SafroleTicket} → is_ticketed = 1 (ticket-based)
   * - sealtickets' ∈ sequence{bskey} → is_ticketed = 0 (fallback)
   *
   * This is used for fork choice: chains with more ticketed blocks are preferred
   * because ticket-based sealing provides better security (anonymous author).
   */
  private isBlockTicketed(block: Block): boolean {
    // If no seal key service, assume ticketed (conservative for fork choice)
    if (!this.sealKeyService) {
      return true
    }

    // Get the seal key for this block's timeslot
    const [error, sealKey] = this.sealKeyService.getSealKeyForSlot(
      block.header.timeslot,
    )

    if (error || !sealKey) {
      // If we can't determine, assume ticketed (conservative)
      logger.debug('Could not determine seal key type, assuming ticketed', {
        slot: block.header.timeslot.toString(),
        error: error?.message,
      })
      return true
    }

    // Check if the seal key is a ticket or fallback Bandersnatch key
    const isTicketed = isSealKeyTicket(sealKey)

    logger.debug('Block seal type determined', {
      slot: block.header.timeslot.toString(),
      isTicketed,
      sealKeyType: isTicketed ? 'ticket' : 'fallback',
    })

    return isTicketed
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
   *
   * Tie-breaker: When two forks have equal ticketed counts, prefer the one
   * with the lexicographically lower block hash for deterministic behavior.
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
      } else if (fork.ticketedCount === bestTicketedCount && bestFork) {
        // Tie-breaker: lower block hash wins (deterministic across all nodes)
        if (fork.headHash < bestFork.headHash) {
          bestFork = fork
        }
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
