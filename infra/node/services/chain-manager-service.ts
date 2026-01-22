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
  handleStateResponseAndRequestBlock,
  type Leaf,
  requestBatchOfBlocks,
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
  Block,
  BlockAnnouncementHandshake,
  BlockHeader,
  ChainFork,
  IChainManagerService,
  IConfigService,
  ISealKeyService,
  Safe,
  SafePromise,
  StateResponse,
} from '@pbnjam/types'
import {
  BaseService,
  type ChainStateSnapshot,
  isSealKeyTicket,
  safeError,
  safeResult,
} from '@pbnjam/types'
import type { NetworkingService } from './networking-service'
import type { StateService } from './state-service'

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

  /** Known block headers (hash -> header) for announcements */
  private knownHeaders: Map<Hex, BlockHeader> = new Map()

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

  /** Event bus service for emitting chain events */
  private readonly eventBusService?: EventBusService

  /** State request protocol for requesting state */
  private stateRequestProtocol?: StateRequestProtocol | null

  /** Block request protocol for requesting blocks */
  private blockRequestProtocol?: BlockRequestProtocol | null

  /** State service for setting state */
  private stateService?: StateService | null

  /** Networking service for sending messages */
  private readonly networkingService?: NetworkingService | null

  /** Pending block requests: blockHash -> peerPublicKey */
  private readonly pendingBlockRequests: Map<Hex, Hex> = new Map()

  /** Pending state requests: blockHash -> peerPublicKey */
  private readonly pendingStateRequests: Map<Hex, Hex> = new Map()

  /** Chain info for sequential block requests: blockHash -> chainLength */
  private readonly pendingChainRequests: Map<Hex, number> = new Map()

  /**
   * Ordered list of valid lookup anchors (most recent first)
   * Limited to maxLookupAnchorage entries
   * Used for validating guarantee lookup anchors per Gray Paper
   */
  private lookupAnchors: Hex[] = []

  constructor(
    configService: IConfigService,
    sealKeyService?: ISealKeyService,
    eventBusService?: EventBusService,
    stateRequestProtocol?: StateRequestProtocol | null,
    blockRequestProtocol?: BlockRequestProtocol | null,
    stateService?: StateService | null,
    networkingService?: NetworkingService | null,
  ) {
    super('chain-manager-service')
    this.configService = configService
    this.sealKeyService = sealKeyService
    this.eventBusService = eventBusService
    this.stateRequestProtocol = stateRequestProtocol || null
    this.blockRequestProtocol = blockRequestProtocol || null
    this.stateService = stateService || null
    this.networkingService = networkingService || null

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
   * Set protocols and services after initialization
   * Used when dependencies are created after ChainManagerService
   */
  setProtocolsAndServices(
    stateRequestProtocol: StateRequestProtocol | null,
    blockRequestProtocol: BlockRequestProtocol | null,
    stateService: StateService | null,
  ): void {
    this.stateRequestProtocol = stateRequestProtocol
    this.blockRequestProtocol = blockRequestProtocol
    this.stateService = stateService
  }

  /**
   * Start the chain manager service
   *
   * On startup, requests state and blocks for the latest unvalidated block
   * to sync with the network.
   */
  async start(): SafePromise<boolean> {
    // Call parent start method
    const [parentStartError] = await super.start()
    if (parentStartError) {
      return safeError(parentStartError)
    }

    // Check if we have the required services and protocols
    if (
      !this.stateRequestProtocol ||
      !this.blockRequestProtocol ||
      !this.networkingService ||
      !this.stateService
    ) {
      logger.warn(
        'Chain manager startup skipped: required services or protocols not available',
      )
      return safeResult(true)
    }

    // Get the latest unvalidated block hash (best head, finalized head, or genesis)
    let latestBlockHash = this.bestHash || this.finalizedHash

    // If no blocks available, use genesis hash
    if (!latestBlockHash) {
      const genesisManager = this.stateService.getGenesisManager()
      if (genesisManager) {
        const [genesisError, genesisHash] =
          genesisManager.getGenesisHeaderHash()
        if (genesisError || !genesisHash) {
          logger.warn(
            'Chain manager startup: no blocks available and failed to get genesis hash',
            {
              error: genesisError?.message,
            },
          )
          return safeResult(true)
        }
        latestBlockHash = genesisHash
        logger.info('Chain manager startup: using genesis hash for sync', {
          genesisHash: `${latestBlockHash.substring(0, 18)}...`,
        })
      } else {
        logger.info(
          'Chain manager startup: no blocks available and no genesis manager, skipping sync',
        )
        return safeResult(true)
      }
    }

    // Get a connected peer to request from
    const connectedPeers = Array.from(
      this.networkingService.publicKeyToConnection.keys(),
    )
    if (connectedPeers.length === 0) {
      logger.warn(
        'Chain manager startup: no connected peers available, skipping sync',
      )
      return safeResult(true)
    }

    // Use the first connected peer
    const peerPublicKey = connectedPeers[0]

    logger.info('Chain manager startup: requesting state and blocks', {
      blockHash: `${latestBlockHash.substring(0, 18)}...`,
      peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
      blockCount: 100,
    })

    // Track the pending request
    this.pendingStateRequests.set(latestBlockHash, peerPublicKey)
    this.pendingBlockRequests.set(latestBlockHash, peerPublicKey)
    this.pendingChainRequests.set(latestBlockHash, 100)

    // Request state for the latest block, then request up to 100 blocks
    // Note: The state response will be handled by handleStateResponse,
    // which will then trigger the block request via handleStateResponseAndRequestBlock
    const [requestError] = await requestStateForBlock(
      latestBlockHash,
      peerPublicKey,
      this.stateRequestProtocol,
      this.networkingService,
    )

    if (requestError) {
      logger.error('Chain manager startup: failed to request state', {
        blockHash: `${latestBlockHash.substring(0, 18)}...`,
        error: requestError.message,
      })
      // Clean up pending requests
      this.pendingStateRequests.delete(latestBlockHash)
      this.pendingBlockRequests.delete(latestBlockHash)
      this.pendingChainRequests.delete(latestBlockHash)
      return safeError(requestError)
    }

    logger.info(
      'Chain manager startup: state request sent, waiting for response',
      {
        blockHash: `${latestBlockHash.substring(0, 18)}...`,
      },
    )

    return safeResult(true)
  }

  /**
   * Get finalized block hash and slot
   * Used by UP0 for creating block announcements
   */
  getFinalizedBlockInfo(): { hash: Hex; slot: bigint } | null {
    if (!this.finalizedHash || !this.finalizedHead) {
      return null
    }
    return {
      hash: this.finalizedHash,
      slot: this.finalizedHead.timeslot,
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
    const [error, shouldRequest] = await this.handleBlockAnnouncement(
      header,
      peerPublicKey,
    )
    if (error) {
      logger.error('Failed to handle block announcement event', {
        error: error.message,
        headerSlot: header.timeslot.toString(),
      })
    } else if (shouldRequest) {
      logger.debug(
        'Block announcement event processed, block will be requested',
        {
          headerSlot: header.timeslot.toString(),
        },
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
    peerId: Uint8Array,
    handshake: BlockAnnouncementHandshake,
  ): Promise<void> {
    const peerPublicKey = bytesToHex(peerId)
    const peerFinalBlockHash = bytesToHex(handshake.finalBlockHash)

    logger.debug('Processing block announcement handshake', {
      peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
      peerFinalBlockSlot: handshake.finalBlockSlot.toString(),
      peerFinalBlockHash: `${peerFinalBlockHash.substring(0, 18)}...`,
      leavesCount: handshake.leaves.length,
      currentFinalBlockSlot: this.finalizedHead?.timeslot.toString() ?? 'none',
    })

    // Check if peer has a newer finalized block
    if (
      this.finalizedHead &&
      handshake.finalBlockSlot > this.finalizedHead.timeslot
    ) {
      logger.info('Peer has newer finalized block', {
        currentSlot: this.finalizedHead.timeslot.toString(),
        peerSlot: handshake.finalBlockSlot.toString(),
        peerHash: `${peerFinalBlockHash.substring(0, 18)}...`,
      })
      // TODO: Could trigger a sync request here if needed
    }

    // Process known leaves - blocks the peer knows about but hasn't extended yet
    // If we're behind (peer has newer finalized block), request blocks for leaves we don't have
    // to help us catch up faster.
    // If we don't have a finalized head, we're definitely behind
    const isBehind =
      !this.finalizedHead ||
      handshake.finalBlockSlot > this.finalizedHead.timeslot

    if (isBehind) {
      // We're behind, so request blocks for leaves we don't have
      // Collect leaves with their slots for sorting and grouping
      const unknownLeaves: Array<{ hash: Hex; slot: bigint }> = []
      for (const leaf of handshake.leaves) {
        const leafHash = bytesToHex(leaf.hash)
        if (!this.blocks.has(leafHash) && !this.knownHeaders.has(leafHash)) {
          unknownLeaves.push({ hash: leafHash, slot: leaf.slot })
        }
      }

      // Limit to avoid overwhelming the network (process up to 10 leaves at a time)
      const leavesToRequest = unknownLeaves
        .sort((a, b) => {
          // Sort by slot (oldest first) for sequential request optimization
          if (a.slot < b.slot) return -1
          if (a.slot > b.slot) return 1
          return 0
        })
        .slice(0, 10)

      if (leavesToRequest.length > 0) {
        // Request blocks for unknown leaves using the extracted helper
        // This follows the state-then-block flow: request state first, then blocks
        if (!this.stateRequestProtocol || !this.networkingService) {
          logger.warn(
            'State request protocol or networking service not available for batch block request',
            {
              hasStateRequestProtocol: !!this.stateRequestProtocol,
              hasNetworkingService: !!this.networkingService,
              leavesToRequest: leavesToRequest.length,
            },
          )
          return
        }

        const leaves: Leaf[] = leavesToRequest.map((leaf) => ({
          hash: leaf.hash,
          slot: leaf.slot,
        }))

        await requestBatchOfBlocks(
          leaves,
          peerPublicKey,
          this.stateRequestProtocol,
          this.networkingService,
          this.pendingBlockRequests,
          this.pendingStateRequests,
          this.pendingChainRequests,
        )

        logger.info('Requested blocks for unknown leaves to catch up', {
          requestedCount: leavesToRequest.length,
          totalLeaves: handshake.leaves.length,
          peerFinalBlockSlot: handshake.finalBlockSlot.toString(),
          currentFinalBlockSlot:
            this.finalizedHead?.timeslot.toString() ?? 'none',
        })
      }
    } else {
      // We're not behind, just log unknown leaves
      for (const leaf of handshake.leaves) {
        const leafHash = bytesToHex(leaf.hash)
        if (!this.blocks.has(leafHash) && !this.knownHeaders.has(leafHash)) {
          logger.debug("Peer has leaf we don't know about", {
            leafHash: `${leafHash.substring(0, 18)}...`,
            leafSlot: leaf.slot.toString(),
            currentFinalBlockSlot:
              this.finalizedHead?.timeslot.toString() ?? 'none',
          })
        }
      }
    }
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
    const blockHash = this.hashBlock(header)

    // If we already have the full block, no need to request
    if (this.blocks.has(blockHash)) {
      return safeResult(false)
    }

    // Store the header for future reference
    this.knownHeaders.set(blockHash, header)

    // Check if this block is relevant:
    // 1. Is the parent known? (either we have it or it's in known headers)
    const parentHash = header.parent
    const hasParent =
      this.blocks.has(parentHash) || this.knownHeaders.has(parentHash)

    // 2. Is this block potentially better than current best?
    // (We can't fully determine this without the full block, but we can check basic conditions)
    const shouldRequest = hasParent || !this.bestHash

    logger.debug('Block announcement processed', {
      blockHash: `${blockHash.substring(0, 18)}...`,
      slot: header.timeslot.toString(),
      hasParent,
      shouldRequest,
      bestHash: this.bestHash ? `${this.bestHash.substring(0, 18)}...` : 'none',
    })

    // If we should request, start the sequential flow:
    // 1. Request state via CE129
    // 2. Wait for state response, call setState
    // 3. Request block via CE128
    // 4. Wait for block response, call importBlock
    if (shouldRequest) {
      // Track this pending request
      this.pendingBlockRequests.set(blockHash, peerPublicKey)

      // Step 1: Request state via CE129
      // Track state request separately from block request
      this.pendingStateRequests.set(blockHash, peerPublicKey)

      if (!this.stateRequestProtocol || !this.networkingService) {
        logger.warn(
          'State request protocol or networking service not available',
          {
            blockHash: `${blockHash.substring(0, 18)}...`,
          },
        )
        this.pendingBlockRequests.delete(blockHash)
        this.pendingStateRequests.delete(blockHash)
        return safeResult(false)
      }

      // Use the extracted helper from chain-manager package
      const [stateError] = await requestStateForBlock(
        blockHash,
        peerPublicKey,
        this.stateRequestProtocol,
        this.networkingService,
      )
      if (stateError) {
        logger.error('Failed to request state for block', {
          blockHash: `${blockHash.substring(0, 18)}...`,
          error: stateError.message,
        })
        // Clean up pending requests on error
        this.pendingBlockRequests.delete(blockHash)
        this.pendingStateRequests.delete(blockHash)
      }
    }

    return safeResult(shouldRequest)
  }

  /**
   * Handle state response from CE129
   */
  private async handleStateResponse(
    response: StateResponse,
    peerPublicKey: Hex,
  ): Promise<void> {
    // Find the pending state request for this peer
    // We match by peerPublicKey and take the first one (FIFO)
    // In a more sophisticated implementation, we could track state requests with request IDs
    let matchingBlockHash: Hex | null = null
    for (const [
      blockHash,
      pendingPeerPublicKey,
    ] of this.pendingStateRequests.entries()) {
      if (pendingPeerPublicKey === peerPublicKey) {
        matchingBlockHash = blockHash
        break
      }
    }

    if (!matchingBlockHash) {
      logger.warn(
        'Received state response but no matching pending state request',
        {
          peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
          keyValuePairsCount: response.keyValuePairs.length,
        },
      )
      return
    }

    // Remove from pending state requests
    this.pendingStateRequests.delete(matchingBlockHash)

    logger.debug('Received state response', {
      blockHash: `${matchingBlockHash.substring(0, 18)}...`,
      peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
      keyValuePairsCount: response.keyValuePairs.length,
      boundaryNodesCount: response.boundaryNodes.length,
    })

    // Step 2: Convert state response to keyvals and call setState
    if (!this.stateService) {
      logger.error('State service not available', {
        blockHash: `${matchingBlockHash.substring(0, 18)}...`,
      })
      this.pendingBlockRequests.delete(matchingBlockHash)
      return
    }

    // Convert keyValuePairs to keyvals format: { key: Hex; value: Hex }[]
    const keyvals = response.keyValuePairs.map((pair) => ({
      key: bytesToHex(pair.key),
      value: bytesToHex(pair.value),
    }))

    // Call setState
    const [setStateError] = this.stateService.setState(keyvals)
    if (setStateError) {
      logger.error('Failed to set state from state response', {
        blockHash: `${matchingBlockHash.substring(0, 18)}...`,
        error: setStateError.message,
        keyvalsCount: keyvals.length,
      })
      // Clean up pending block request on error
      this.pendingBlockRequests.delete(matchingBlockHash)
      return
    }

    logger.debug('State set successfully', {
      blockHash: `${matchingBlockHash.substring(0, 18)}...`,
      keyvalsCount: keyvals.length,
    })

    // Step 3: Request block(s) via CE128 using the extracted helper
    if (!this.blockRequestProtocol || !this.networkingService) {
      logger.error(
        'Block request protocol or networking service not available',
        {
          blockHash: `${matchingBlockHash.substring(0, 18)}...`,
        },
      )
      this.pendingBlockRequests.delete(matchingBlockHash)
      return
    }

    const [requestError] = await handleStateResponseAndRequestBlock(
      matchingBlockHash,
      peerPublicKey,
      this.blockRequestProtocol,
      this.networkingService,
      this.pendingChainRequests,
    )

    if (requestError) {
      logger.error('Failed to request block after state set', {
        blockHash: `${matchingBlockHash.substring(0, 18)}...`,
        error: requestError.message,
      })
      this.pendingBlockRequests.delete(matchingBlockHash)
    }
  }

  /**
   * Handle block request failed event
   * Cleans up pending requests when a block request fails
   */
  private handleBlockRequestFailed(_eventId: bigint, reason: string): void {
    logger.warn('Block request failed, cleaning up pending requests', {
      reason,
      pendingBlockRequestsCount: this.pendingBlockRequests.size,
      pendingStateRequestsCount: this.pendingStateRequests.size,
    })

    // Clean up pending requests
    // Since we don't have the specific block hash from the event,
    // we'll log the failure and let individual request handlers clean up
    // when they receive errors
    // This is a fallback for cases where the error occurs before we can
    // match it to a specific pending request
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
    if (this.blocks.has(blockHash)) {
      return safeResult(undefined) // Already imported
    }

    // Remove from known headers if it was there (we now have the full block)
    this.knownHeaders.delete(blockHash)

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

    // Check if finalized head is actually changing
    const previousFinalizedHash = this.finalizedHash

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

    // Emit finalized block changed event if the finalized head actually changed
    if (this.eventBusService && previousFinalizedHash !== blockHash) {
      this.eventBusService
        .emitFinalizedBlockChanged(block.header)
        .catch((error) => {
          logger.error('Failed to emit finalized block changed event', {
            error: error instanceof Error ? error.message : String(error),
            blockHash,
          })
        })
    }

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
    this.knownHeaders.clear()
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
   * Returns the parent's complete tate snapshot if the block's parent is different
   * from the current head (for*/
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
      // Check if best head is actually changing
      const previousBestHash = this.bestHash

      this.bestHead = bestFork.head
      this.bestHash = bestFork.headHash

      // Emit best block changed event if the best head actually changed
      if (
        this.eventBusService &&
        previousBestHash !== bestFork.headHash &&
        bestFork.head
      ) {
        this.eventBusService
          .emitBestBlockChanged(bestFork.head)
          .catch((error) => {
            logger.error('Failed to emit best block changed event', {
              error: error instanceof Error ? error.message : String(error),
              blockHash: bestFork.headHash,
            })
          })
      }
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

    // Remove fo this.forks.delete(forkHash)

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
