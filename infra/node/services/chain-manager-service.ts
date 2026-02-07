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

import {
  // handleStateResponseAndRequestBlock,
  requestBlock,
  requestStateForBlock,
} from '@pbnjam/chain-manager'
import { calculateBlockHashFromHeader } from '@pbnjam/codec'
import type { EventBusService, Hex } from '@pbnjam/core'
import { bytesToHex, logger } from '@pbnjam/core'
import type {
  BlockRequestProtocol,
  StateRequestProtocol,
} from '@pbnjam/networking'
import type {
  AncestryItem,
  Block,
  BlockAnnouncementHandshake,
  BlockHeader,
  ChainFork,
  IAccumulationService,
  IBlockImporterService,
  IChainManagerService,
  IConfigService,
  ISealKeyService,
  IStateService,
  Safe,
  SafePromise,
  StateResponse,
  StateTrie,
} from '@pbnjam/types'
import {
  BaseService,
  isSafroleTicket,
  REPORTS_ERRORS,
  safeError,
  safeResult,
} from '@pbnjam/types'
import type { NetworkingService } from './networking-service'

// Re-export types for backwards compatibility
export type { ChainFork, IChainManagerService }
export type { ReorgEvent } from '@pbnjam/types'

/**
 * Node in the block tree structure
 * Tracks children hashes for forward traversal
 */
interface BlockNode {
  /** Slot of the block */
  slot: bigint
  /** Set of child block hashes */
  children: Set<Hex>
  /** Block header */
  block: Block | null
  stateSnapshot: StateTrie
}

export class ChainManagerService
  extends BaseService
  implements IChainManagerService
{
  /** Tree structure: block hash -> Node (with children set) */
  private blockNodes: Map<Hex, BlockNode> = new Map()

  /** Equivocating block pairs (slot -> set of block hashes) */
  private equivocations: Map<bigint, Set<Hex>> = new Map()

  /** Configuration service */
  private readonly configService: IConfigService

  /** Block importer service for coordinating block import */
  private readonly blockImporterService: IBlockImporterService

  /**
   * Ordered list of valid lookup anchors (most recent first)
   * Limited to maxLookupAnchorage entries
   * Used for validating guarantee lookup anchors per Gray Paper
   * Stores both hash and slot for proper validation
   */
  private lookupAnchors: AncestryItem[] = []

  /**
   * Track if ancestry was initialized from external source (e.g., fuzzer Initialize message)
   * This allows preserving initialized ancestry even after block imports
   */

  /** Optional services for fork rollback handling */
  private readonly stateService: IStateService

  /** Optional accumulation service for fork rollback - needed to reset lastProcessedSlot */
  private readonly accumulationService?: IAccumulationService

  /** Networking service for sending messages */
  private readonly networkingService: NetworkingService | null

  /** Event bus service for sending events */
  private readonly eventBusService: EventBusService

  /** State request protocol for requesting state */
  private readonly stateRequestProtocol: StateRequestProtocol | null

  /** Block request protocol for requesting blocks */
  private readonly blockRequestProtocol: BlockRequestProtocol | null

  /** Seal key service for getting seal keys */
  private readonly sealKeyService: ISealKeyService

  /** Pending block requests: blockHash -> peerPublicKey */
  private readonly pendingBlockRequests: Map<Hex, Hex> = new Map()

  /** Pending state requests: peer -> peerPublicKey */
  private readonly publicKeyToPendingStateRequest: Map<Hex, Hex> = new Map()

  constructor(
    configService: IConfigService,
    blockImporterService: IBlockImporterService,
    stateService: IStateService,
    accumulationService: IAccumulationService,
    sealKeyService: ISealKeyService,
    eventBusService: EventBusService,
    stateRequestProtocol: StateRequestProtocol | null,
    blockRequestProtocol: BlockRequestProtocol | null,
    networkingService: NetworkingService | null,
  ) {
    super('chain-manager-service')
    this.configService = configService
    this.sealKeyService = sealKeyService
    this.eventBusService = eventBusService
    this.stateService = stateService
    this.blockImporterService = blockImporterService
    this.stateService = stateService
    this.accumulationService = accumulationService

    this.networkingService = networkingService || null
    this.stateRequestProtocol = stateRequestProtocol || null
    this.blockRequestProtocol = blockRequestProtocol || null

    // Set up event handlers for state and block responses
    if (this.eventBusService) {
      this.eventBusService.addStateResponseCallback(
        this.handleStateResponse.bind(this),
      )
      this.eventBusService.addBlocksReceivedCallback(
        this.handleBlockResponse.bind(this),
      )
      this.eventBusService.addBlockAnnouncementWithHeaderCallback(
        this.handleBlockAnnouncementEvent.bind(this),
      )
      this.eventBusService.addBlockAnnouncementHandshakeCallback(
        this.handleBlockAnnouncementHandshake.bind(this),
      )
      // Subscribe to error events to clean up pending requests
      this.eventBusService.addBlockRequestFailedCallback(
        this.handleBlockRequestFailed.bind(this),
      )
    }
  }

  /**
   * Handle block announcement handshake from event bus
   *
   * Called when UP0 emits a handshake event.
   * Processes peer's finalized block info and known leaves.
   */
  private async handleBlockAnnouncementHandshake(
    _peerId: Uint8Array,
    handshake: BlockAnnouncementHandshake,
  ): Promise<void> {
    if (!this.networkingService || !this.stateRequestProtocol) {
      return
    }
    const peerFinalBlockHash = bytesToHex(handshake.finalBlockHash)
    const peerFinalBlockSlot = handshake.finalBlockSlot

    const knownNode = this.blockNodes.get(peerFinalBlockHash)
    if (knownNode?.block) {
      logger.debug('Peer has known final block', {
        peerSlot: peerFinalBlockSlot.toString(),
        peerHash: `${peerFinalBlockHash.substring(0, 18)}...`,
      })
      return
    }

    for (const leaf of handshake.leaves) {
      if (!this.blockNodes.has(bytesToHex(leaf.hash))) {
        this.blockNodes.set(bytesToHex(leaf.hash), {
          slot: leaf.slot,
          children: new Set(),
          block: null,
          stateSnapshot: {},
        })
      }
    }
  }

  /**
   * Handle block announcement event from event bus
   *
   * Called when UP0 emits a block announcement event.
   * Converts event parameters and delegates to handleBlockAnnouncement.
   */
  private async handleBlockAnnouncementEvent(
    peerId: Uint8Array,
    header: BlockHeader,
  ): Promise<void> {
    const peerPublicKey = bytesToHex(peerId)
    await this.handleBlockAnnouncement(header, peerPublicKey)
  }

  /**
   * Handle block announcement (header only)
   *
   * Determines if we should request the full block via CE128.
   *
   * @param header - Block header from announcement
   * @param peerPublicKey - Public key of the peer that sent the announcement
   * @returns true if block should be requested, false otherwise
   */
  async handleBlockAnnouncement(
    header: BlockHeader,
    peerPublicKey: Hex,
  ): SafePromise<boolean> {
    if (!this.stateRequestProtocol || !this.networkingService) {
      return safeError(
        new Error('State request protocol or networking service not available'),
      )
    }
    if (!this.blockRequestProtocol) {
      return safeError(new Error('Block request protocol not available'))
    }
    const blockHash = this.hashBlock(header)
    const blockNode = this.blockNodes.get(blockHash)

    // If we already have the full block, no need to request
    if (blockNode?.block) {
      return safeResult(false)
    }

    // Store the header for future reference
    this.blockNodes.set(blockHash, {
      slot: header.timeslot,
      children: new Set(),
      block: null,
      stateSnapshot: {},
    })

    // Check if this block is relevant:
    // 1. Is the parent known? (either we have it or it's in known headers)
    const parentHash = header.parent
    const parentNode = this.blockNodes.get(parentHash)
    const hasParent = parentNode?.block !== null

    if (hasParent) {
      // Track this pending request
      this.pendingBlockRequests.set(blockHash, peerPublicKey)
      this.publicKeyToPendingStateRequest.set(peerPublicKey, blockHash)

      // Use the extracted helper from chain-manager package
      const promiseStateRequest = requestStateForBlock(
        blockHash,
        peerPublicKey,
        this.stateRequestProtocol,
        this.networkingService,
      )

      const promiseBlockRequest = requestBlock(
        blockHash,
        peerPublicKey,
        this.blockRequestProtocol,
        this.networkingService,
      )

      const [stateRequestResult, blockRequestResult] = await Promise.allSettled(
        [promiseStateRequest, promiseBlockRequest],
      )
      const [stateRequestError] =
        stateRequestResult.status === 'fulfilled'
          ? stateRequestResult.value
          : [stateRequestResult.reason as Error, undefined]
      const [blockRequestError] =
        blockRequestResult.status === 'fulfilled'
          ? blockRequestResult.value
          : [blockRequestResult.reason as Error, undefined]
      if (stateRequestError || blockRequestError) {
        logger.error('Failed to request state or block', {
          blockHash: `${blockHash.substring(0, 18)}...`,
          error: stateRequestError?.message || blockRequestError?.message,
        })
        this.pendingBlockRequests.delete(blockHash)
        this.publicKeyToPendingStateRequest.delete(peerPublicKey)
        return safeError(new Error('Failed to request state or block'))
      }
    }

    return safeResult(true)
  }

  /**
   * Handle state response from CE129
   */
  private async handleStateResponse(
    response: StateResponse,
    peerPublicKey: Hex,
  ): Promise<void> {
    const requestedBlockHash =
      this.publicKeyToPendingStateRequest.get(peerPublicKey)
    if (!requestedBlockHash) {
      logger.error('No pending state request found', {
        peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
      })
      return
    }

    const blockNode = this.blockNodes.get(requestedBlockHash)
    if (!blockNode) {
      logger.error('No block node found', {
        blockHash: `${requestedBlockHash.substring(0, 18)}...`,
      })
      return
    }

    // Convert keyValuePairs to StateTrie format: Record<Hex, Hex>
    const stateSnapshot: StateTrie = {}
    for (const pair of response.keyValuePairs) {
      const key = bytesToHex(pair.key)
      const value = bytesToHex(pair.value)
      stateSnapshot[key] = value
    }

    blockNode.stateSnapshot = stateSnapshot

    this.blockNodes.set(requestedBlockHash, blockNode)
    this.publicKeyToPendingStateRequest.delete(peerPublicKey)
  }

  /**
   * Start the chain manager by initializing genesis node
   * Gets genesis state root from genesis manager and creates the first node
   */
  async start(): SafePromise<boolean> {
    const [genesisHashError, genesisHash] = this.stateService.getStateRoot()
    if (genesisHashError) {
      return safeError(
        new Error(`Failed to get genesis hash: ${genesisHashError.message}`),
      )
    }

    const [initStateTrieError, initStateTrie] =
      this.stateService.generateStateTrie()
    if (initStateTrieError) {
      return safeError(
        new Error(`Failed to get genesis state: ${initStateTrieError.message}`),
      )
    }

    // Create the first node (genesis) with empty children set
    this.blockNodes.set(genesisHash, {
      slot: 0n,
      children: new Set(),
      block: null,
      stateSnapshot: initStateTrie,
    })

    if (this.networkingService && this.stateRequestProtocol) {
      // Request state for the latest block, then request up to 100 blocks
      // Note: The state response will be handled by handleStateResponse,
      // which will then trigger the block request via handleStateResponseAndRequestBlock
      // const [requestError] = await requestStateForBlock(
      //   genesisHash,
      //   this.sealKeyService.getPublicKey(),
      //   this.stateRequestProtocol,
      //   this.networkingService,
      // )
      // if (requestError) {
      //   return safeError(requestError)
      // }
    }

    return safeResult(true)
  }

  private rollbackToState(
    snapshot: StateTrie,
    parentSlot?: bigint,
    parentHash?: Hex,
  ): Safe<void> {
    this.stateService.clearState()
    const keyvals = Object.entries(snapshot).map(([key, value]) => ({
      key: key as Hex,
      value: value as Hex,
    }))
    const [setStateError] = this.stateService.setState(keyvals)
    if (setStateError) {
      return safeError(
        new Error(
          `Failed to revert state to parent state during fork rollback: ${setStateError.message}`,
        ),
      )
    }

    // Reset accumulation service's lastProcessedSlot to parent's slot
    // This is critical for fork handling where sibling blocks have the same slot
    // Without this, the accumulation service will skip processing for the second sibling
    if (this.accumulationService && parentSlot !== undefined) {
      this.accumulationService.setLastProcessedSlot(parentSlot)
      logger.debug(
        '[ChainManager] Reset lastProcessedSlot during fork rollback',
        {
          parentSlot: parentSlot.toString(),
        },
      )
    }

    // Rebuild lookupAnchors from the parent's ancestry
    // This is critical for fork handling - the lookupAnchors must reflect
    // the ancestry at the parent's state, not the previous head's ancestry
    if (parentHash) {
      this.rebuildLookupAnchorsFromParent(parentHash)
    }

    return safeResult(undefined)
  }

  /**
   * Rebuild the lookupAnchors list by traversing backwards from a given parent node
   * This is needed during fork rollbacks to ensure the ancestry reflects the correct chain
   */
  private rebuildLookupAnchorsFromParent(parentHash: Hex): void {
    const maxAge = BigInt(this.configService.maxLookupAnchorage)
    const newAnchors: AncestryItem[] = []

    let currentHash: Hex | null = parentHash
    const parentNode = this.blockNodes.get(parentHash)

    // Get the parent's slot for age calculation
    const parentSlot = parentNode?.block?.header.timeslot ?? 0n
    const minValidSlot = parentSlot > maxAge ? parentSlot - maxAge : 0n

    // Walk backwards through the block tree, collecting ancestors
    while (currentHash && newAnchors.length < 1000) {
      // Safety limit
      const node = this.blockNodes.get(currentHash)
      if (!node) break

      const block = node.block
      if (block) {
        const slot = block.header.timeslot
        // Only include blocks within the valid age range
        if (slot >= minValidSlot) {
          newAnchors.push({
            slot,
            header_hash: currentHash,
          })
        } else {
          // Once we hit a block that's too old, stop
          break
        }
        currentHash = block.header.parent
      } else {
        // Genesis node (no block) - still include it
        newAnchors.push({
          slot: 0n,
          header_hash: currentHash,
        })
        break
      }
    }

    this.lookupAnchors = newAnchors
    logger.debug('[ChainManager] Rebuilt lookupAnchors from parent', {
      parentHash: parentHash.substring(0, 18),
      ancestrySize: newAnchors.length,
    })
  }

  /**
   * Handle block request failed event
   * Cleans up pending requests when a block request fails
   */
  private handleBlockRequestFailed(_eventId: bigint, reason: string): void {
    logger.warn('Block request failed, cleaning up pending requests', {
      reason,
      pendingBlockRequestsCount: this.pendingBlockRequests.size,
      pendingStateRequestsCount: this.publicKeyToPendingStateRequest.size,
    })
  }

  /**
   * Handle block response from CE128
   */
  private async handleBlockResponse(
    blocks: Block[],
    peerPublicKey: Hex,
  ): Promise<void> {
    if (blocks.length === 0) {
      logger.warn('Received empty block response', {
        peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
      })
      return
    }

    // Process each block in the response
    for (const block of blocks) {
      const blockHash = this.hashBlock(block.header)

      // Check if this is a pending request
      const pending = this.pendingBlockRequests.get(blockHash)
      if (!pending) {
        // This might be a block we requested earlier or a different flow
        // Try to import it anyway
        logger.debug('Received block response for non-pending request', {
          blockHash: `${blockHash.substring(0, 18)}...`,
          peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
        })
      } else {
        // Remove from pending requests
        this.pendingBlockRequests.delete(blockHash)
      }

      // Step 4: Import block
      const [importError] = await this.importBlock(block)
      if (importError) {
        logger.error('Failed to import block from block response', {
          blockHash: `${blockHash.substring(0, 18)}...`,
          error: importError.message,
          slot: block.header.timeslot.toString(),
        })
      } else {
        logger.info('Block imported successfully from block response', {
          blockHash: `${blockHash.substring(0, 18)}...`,
          slot: block.header.timeslot.toString(),
        })
      }
    }
  }

  async importBlock(block: Block): SafePromise<void> {
    const blockHash = this.hashBlock(block.header)

    // Check if block already exists
    if (this.blockNodes.has(blockHash)) {
      logger.info('Block already imported', {
        blockHash: `${blockHash}`,
      })
      return safeResult(undefined) // Already imported
    }

    // Gray Paper best_chain.tex: Check if block would be part of finalized chain
    // This must happen BEFORE block validation to return the correct error
    // for fork blocks (mutations) that are not part of the finalized chain
    // Reject if block's parent is NOT part of any finalized fork
    const blockParentHash = block.header.parent

    if (!this.blockNodes.has(blockParentHash)) {
      return safeError(
        new Error(
          `Local chain error: block ${blockHash.substring(0, 18)}... is not part of the finalized chain`,
        ),
      )
    }

    const parentNode = this.blockNodes.get(blockParentHash)
    if (!parentNode) {
      return safeError(
        new Error(
          `Local chain error: block ${blockHash.substring(0, 18)}... is not part of the finalized chain`,
        ),
      )
    }

    // Check if block's slot is valid relative to parent
    // Gray Paper: Block slot must be greater than parent's slot
    // For genesis (parentNode.block is null), slot must be > 0
    // For non-genesis, slot must be > parent block's slot
    const parentSlot = parentNode.block?.header.timeslot ?? 0n
    if (block.header.timeslot <= parentSlot) {
      // Block slot is invalid (going backwards or same as parent)
      // jam-conformance expects different errors based on the slot value:
      // - If slot == 0 and parent > 0: "not part of finalized chain" (can't go back to genesis)
      // - If slot > 0 but <= parentSlot: "SafroleInitializationFailed" (slot ordering violation)
      if (block.header.timeslot === 0n && parentSlot > 0n) {
        return safeError(
          new Error(
            `Local chain error: block ${blockHash.substring(0, 18)}... is not part of the finalized chain`,
          ),
        )
      }
      return safeError(new Error('SafroleInitializationFailed'))
    }

    // Check current state root to determine if rollback is needed
    // This allows external callers (like trace tests) to set state directly without it being overwritten
    const [initialStateRootError, initialStateRoot] =
      this.stateService.getStateRoot()
    if (initialStateRootError) {
      logger.error('[ChainManager] Failed to get initial state root', {
        error: initialStateRootError,
      })
      return safeError(initialStateRootError)
    }

    // Fork handling: Only rollback to parent state if current state doesn't match expected priorStateRoot
    // This handles:
    // 1. Sibling blocks (same parent, different blocks) - rollback needed
    // 2. Trace tests where state is pre-set correctly - no rollback needed
    // Gray Paper: When importing a fork block, rollback to parent's state
    const parentSnapshot = parentNode.stateSnapshot
    const needsRollback =
      parentSnapshot && block.header.priorStateRoot !== initialStateRoot

    if (needsRollback) {
      // Use parentSlot (already computed above) for accumulation service reset during rollback
      const [rollbackError] = this.rollbackToState(
        parentSnapshot,
        parentSlot,
        blockParentHash,
      )
      if (rollbackError) {
        logger.error(
          '[ChainManager] Failed to rollback to parent state during fork rollback',
          { error: rollbackError },
        )
        return safeError(rollbackError)
      }
    } else if (!parentSnapshot) {
      logger.info('No parent snapshot found for block', {
        blockHash: `${blockHash.substring(0, 18)}...`,
        parentHash: `${blockParentHash.substring(0, 18)}...`,
      })
    }

    const [preStateTrieError, preStateTrie] =
      this.stateService.generateStateTrie()
    if (preStateTrieError) {
      logger.error(
        '[ChainManager] Failed to generate pre-state trie during fork rollback',
        { error: preStateTrieError },
      )
      return safeError(preStateTrieError)
    }
    parentNode.stateSnapshot = preStateTrie

    // Validate parent state root before importing block
    // Gray Paper: The block's priorStateRoot must match the current state root
    const [stateRootError, currentStateRoot] = this.stateService.getStateRoot()
    if (stateRootError) {
      logger.error('[ChainManager] Failed to get current state root', {
        error: stateRootError,
      })
      return safeError(stateRootError)
    }
    if (block.header.priorStateRoot !== currentStateRoot) {
      // Format error in jam-conformance expected format with truncated hashes
      const expectedTruncated = block.header.priorStateRoot.substring(0, 18) // 0x + 16 chars
      const actualTruncated = currentStateRoot.substring(0, 18)
      return safeError(
        new Error(
          `Local chain error: invalid parent state root (expected: ${expectedTruncated}..., actual: ${actualTruncated}...)`,
        ),
      )
    }

    // Validate lookup anchors before importing block
    const [lookupAnchorError] = this.validateLookupAnchors(block)
    if (lookupAnchorError) {
      return safeError(lookupAnchorError)
    }

    // Delegate validation and import to block importer
    const [importError] = await this.blockImporterService.importBlock(block)
    if (importError) {
      // revert state to parent state (use same parentSlot for accumulation service reset)
      const [rollbackError] = this.rollbackToState(
        preStateTrie,
        parentSlot,
        blockParentHash,
      )
      if (rollbackError) {
        logger.error(
          '[ChainManager] Failed to rollback to parent state during fork rollback',
          { error: rollbackError },
        )
        return safeError(rollbackError)
      }
      return safeError(importError)
    }

    const [stateTrieError, postStateTrie] =
      this.stateService.generateStateTrie()
    if (stateTrieError) {
      return safeError(stateTrieError)
    }
    if (!postStateTrie) {
      return safeError(new Error('Failed to generate state trie'))
    }

    // After successful import, track block in fork structure and save state snapshot
    // Track block in fork structure
    this.blockNodes.set(blockHash, {
      slot: block.header.timeslot,
      children: new Set(),
      block: block,
      stateSnapshot: postStateTrie,
    })
    // add child to parent block node
    parentNode.children.add(blockHash)

    // Update lookup anchors with the newly imported block
    // Gray Paper: The lookup anchor list should contain headers within the last L slots
    // Add the new block at the beginning (most recent first)
    this.lookupAnchors.unshift({
      slot: block.header.timeslot,
      header_hash: blockHash,
    })

    // Remove anchors that are too old (slot < currentSlot - maxLookupAnchorage)
    // maxLookupAnchorage is the maximum age in slots, not the maximum count
    const currentSlot = block.header.timeslot
    const maxAge = BigInt(this.configService.maxLookupAnchorage)
    const minValidSlot = currentSlot > maxAge ? currentSlot - maxAge : 0n
    this.lookupAnchors = this.lookupAnchors.filter(
      (anchor) => anchor.slot >= minValidSlot,
    )

    return safeResult(undefined)
  }

  isAncestorOfBest(blockHash: Hex): boolean {
    // Simplified: check if block exists in the tree
    return this.blockNodes.has(blockHash)
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
    return this.lookupAnchors.some((item) => item.header_hash === anchorHash)
  }

  /**
   * Validate lookup anchor exists in ancestor set
   *
   * Gray Paper Eq. 346: ∃h ∈ ancestors: h_timeslot = x_lookupanchortime ∧ blake(h) = x_lookupanchorhash
   *
   * This validates that the lookup anchor hash exists in the ancestor set and the slot matches.
   * The age check (lookup_anchor_slot >= currentSlot - maxLookupAnchorage) is performed
   * separately in the guarantor service using Eq. 340-341.
   *
   * @param anchorHash - The lookup anchor hash from the work report context
   * @param expectedSlot - The expected slot for the lookup anchor
   * @returns true if the anchor exists in the ancestor set with matching slot, false otherwise
   */
  isValidLookupAnchorWithSlot(anchorHash: Hex, expectedSlot: bigint): boolean {
    if (!this.configService.ancestryEnabled) {
      // When ancestry feature is disabled, all anchors are valid
      return true
    }

    // Check if anchor exists in the valid anchor list with matching slot
    const anchor = this.lookupAnchors.find(
      (item) => item.header_hash === anchorHash,
    )
    if (!anchor) {
      return false
    }

    // Validate slot matches
    return anchor.slot === expectedSlot
  }

  /**
   * Get the list of valid lookup anchors (last L block hashes)
   * Returns just the hashes for backwards compatibility
   */
  getValidLookupAnchors(): Hex[] {
    return this.lookupAnchors.map((item) => item.header_hash)
  }

  /**
   * Validate lookup anchors for all guarantees in a block
   *
   * Gray Paper Eq. 346: Validate lookup_anchor exists in ancestors with matching slot
   * ∃h ∈ ancestors: h_timeslot = x_lookupanchortime ∧ blake(h) = x_lookupanchorhash
   *
   * This validation is only performed when:
   * 1. ancestryEnabled is true (controlled by config)
   * 2. The ancestry list has been initialized (has entries)
   * 3. The block has guarantees to validate
   *
   * Note: The age check (Eq. 340-341) is performed in GuarantorService
   *
   * @param block - The block containing guarantees to validate
   * @returns Error if validation fails, undefined if validation passes or is skipped
   */
  validateLookupAnchors(block: Block): Safe<void> {
    if (
      !this.configService.ancestryEnabled ||
      block.body.guarantees.length === 0
    ) {
      return safeResult(undefined)
    }

    const validAnchors = this.getValidLookupAnchors()
    // Only validate if ancestry has been initialized
    if (validAnchors.length === 0) {
      return safeResult(undefined)
    }

    const currentSlot = block.header.timeslot

    for (const guarantee of block.body.guarantees) {
      const lookupAnchorHash = guarantee.report.context.lookup_anchor
      const lookupAnchorSlot = guarantee.report.context.lookup_anchor_slot
      const guaranteeSlot = guarantee.slot

      // IMPORTANT: Check guarantee slot FIRST (before checking lookup anchor)
      // Gray Paper: The guarantee's slot must not be in the future relative to the block
      if (guaranteeSlot > currentSlot) {
        logger.error('[ChainManager] Guarantee slot is in the future', {
          guaranteeSlot: guaranteeSlot.toString(),
          currentSlot: currentSlot.toString(),
          coreIndex: guarantee.report.core_index.toString(),
        })
        return safeError(new Error(REPORTS_ERRORS.FUTURE_REPORT_SLOT))
      }

      // Check lookup_anchor_slot is not in the future
      // Gray Paper: lookup_anchor_slot must not be in the future
      if (lookupAnchorSlot > currentSlot) {
        logger.error('[ChainManager] Lookup anchor slot is in the future', {
          lookupAnchorSlot: lookupAnchorSlot.toString(),
          currentSlot: currentSlot.toString(),
          coreIndex: guarantee.report.core_index.toString(),
        })
        return safeError(new Error(REPORTS_ERRORS.FUTURE_REPORT_SLOT))
      }

      if (
        !this.isValidLookupAnchorWithSlot(lookupAnchorHash, lookupAnchorSlot)
      ) {
        logger.error('[ChainManager] Lookup anchor not found in ancestors', {
          lookupAnchorHash,
          lookupAnchorSlot: lookupAnchorSlot.toString(),
          coreIndex: guarantee.report.core_index.toString(),
          blockSlot: block.header.timeslot.toString(),
          ancestrySize: validAnchors.length,
        })
        return safeError(new Error(REPORTS_ERRORS.LOOKUP_ANCHOR_NOT_RECENT))
      }
    }

    return safeResult(undefined)
  }

  /**
   * Initialize ancestry from external source
   *
   * jam-conformance: The fuzzer's Initialize message includes the list of ancestors
   * for the first block to be imported. This allows validating lookup anchors
   * even when we don't have the full chain history.
   *
   * This method:
   * 1. Stores ancestry items in lookupAnchors for lookup anchor validation
   * 2. Adds ancestry hashes to blockNodes as known parent blocks (with null block data)
   *    so that blocks referencing these ancestors as parents will pass the parent check
   */
  initializeAncestry(ancestors: AncestryItem[]): void {
    // Store both hash and slot from AncestryItem
    this.lookupAnchors = ancestors

    // Add ancestry hashes to blockNodes as known parent blocks
    // This allows blocks that reference these ancestors as parents to pass the parent check
    // Note: We don't have the actual block data, just the hash and slot
    for (const ancestor of ancestors) {
      const hash = ancestor.header_hash as Hex
      if (!this.blockNodes.has(hash)) {
        // Create a placeholder node for the ancestor
        // The block is null since we don't have the full block data
        // stateSnapshot is empty - we can't rollback to these states
        this.blockNodes.set(hash, {
          slot: ancestor.slot,
          children: new Set(),
          block: null,
          stateSnapshot: {},
        })
      }
    }

    logger.info('Ancestry initialized', {
      ancestorCount: ancestors.length,
      blockNodesCount: this.blockNodes.size,
    })
  }

  /**
   * Initialize the genesis block from an Initialize message header
   *
   * jam-conformance: The Initialize message contains a "genesis-like" header.
   * The hash of this header is what subsequent blocks use as their parent.
   * This method computes the header hash and adds it to blockNodes as the genesis block.
   *
   * @param header - The header from the Initialize message
   * @param stateSnapshot - Optional state trie snapshot for the genesis state
   */
  initializeGenesisHeader(
    header: BlockHeader,
    stateSnapshot?: StateTrie,
  ): void {
    const genesisHash = this.hashBlock(header)

    // Add the genesis block to blockNodes
    if (!this.blockNodes.has(genesisHash)) {
      this.blockNodes.set(genesisHash, {
        slot: 0n,
        children: new Set(),
        block: null, // No full block for genesis, just the header
        stateSnapshot: stateSnapshot || {},
      })
    } else if (stateSnapshot) {
      // Update existing node with state snapshot if provided
      this.blockNodes.get(genesisHash)!.stateSnapshot = stateSnapshot
    }

    // Also add the genesis to lookupAnchors for lookup anchor validation
    // The genesis header's slot and hash should be valid lookup anchors
    this.lookupAnchors.push({
      slot: header.timeslot,
      header_hash: genesisHash,
    })

    logger.info('Genesis header initialized', {
      genesisHash: `${genesisHash.substring(0, 18)}...`,
      slot: header.timeslot.toString(),
      blockNodesCount: this.blockNodes.size,
    })
  }

  /**
   * Clear all state (for testing/fork switching)
   */
  clear(): void {
    this.blockNodes.clear()
    this.equivocations.clear()
    this.lookupAnchors = []

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
  saveStateSnapshot(blockHash: Hex, snapshot: StateTrie): void {
    if (!this.blockNodes.has(blockHash)) {
      this.blockNodes.set(blockHash, {
        children: new Set(),
        block: null,
        stateSnapshot: snapshot,
      })
    } else {
      this.blockNodes.get(blockHash)!.stateSnapshot = snapshot
    }
  }

  /**
   * Get state snapshot for a block
   *
   * Returns the complete snapshot that was saved after this block was imported.
   * Returns null if no snapshot exists for this block.
   */
  getStateSnapshot(blockHash: Hex): StateTrie | null {
    return this.blockNodes.get(blockHash)?.stateSnapshot ?? null
  }

  /**
   * Check if we need to rollback before importing a block
   *
   * Returns the parent's complete state snapshot if the block's parent is different
   * from the current head (fork scenario). Returns null if no rollback needed.
   */

  reportEquivocation(blockA: Hex, blockB: Hex): void {
    const blockAData = this.blockNodes.get(blockA)
    if (!blockAData) return

    const slot = blockAData.block?.header.timeslot ?? 0n
    if (!this.equivocations.has(slot)) {
      this.equivocations.set(slot, new Set())
    }
    this.equivocations.get(slot)!.add(blockA)
    this.equivocations.get(slot)!.add(blockB)

    logger.warn('Equivocation reported', {
      slot: slot.toString(),
      blockA,
      blockB,
    })
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

  findBlockAtSlot(slot: bigint): Hex | null {
    for (const [hash, block] of this.blockNodes) {
      if (block.block?.header.timeslot === slot) {
        return hash
      }
    }
    return null
  }

  /**
   * Get children of a parent block
   * Used to detect if parent already has a child at a given timeslot (mutation)
   */
  getChildrenOfParent(parentHash: Hex): Hex[] {
    const node = this.blockNodes.get(parentHash)
    return node ? Array.from(node.children) : []
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
  isBlockTicketed(block: Block): boolean {
    // If no seal key service, assume ticketed (conservative for fork choice)
    if (!this.sealKeyService) {
      return false
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
      return false
    }

    // Check if the seal key is a ticket or fallback Bandersnatch key
    const isTicketed = isSafroleTicket(sealKey)

    logger.debug('Block seal type determined', {
      slot: block.header.timeslot.toString(),
      isTicketed,
      sealKeyType: isTicketed ? 'ticket' : 'fallback',
    })

    return isTicketed
  }

  /**
   * Get a block by hash
   * Used to check block properties (e.g., timeslot) for mutation detection
   */
  getBlock(blockHash: Hex): Block | null {
    return this.blockNodes.get(blockHash)?.block ?? null
  }
}
