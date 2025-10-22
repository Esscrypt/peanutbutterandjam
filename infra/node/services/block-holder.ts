/**
 * Block Authoring Service Implementation
 *
 * Implements block creation, validation, and submission according to JAM Protocol
 * Reference: Gray Paper block authoring specifications
 */

import {
  type EventBusService,
  type Hex,
  logger,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { BlockRequestProtocol } from '@pbnj/networking'
import { calculateBlockHash } from '@pbnj/serialization'
import type { BlockStore } from '@pbnj/state'
import {
  BaseService,
  type Block,
  type BlockRequest,
  BlockRequestDirection,
} from '@pbnj/types'
import type { ConfigService } from './config-service'
import type { NetworkingService } from './networking-service'
import type { ValidatorSetManager } from './validator-set'

/**
 * Block Announcement Service Implementation
 */
export class BlockHolderService extends BaseService {
  // Block announcement protocol integration

  private blockStore: BlockStore

  private configService: ConfigService
  private eventBusService: EventBusService
  private ce128BlockRequestProtocol: BlockRequestProtocol
  private networkingService: NetworkingService
  constructor(options: {
    blockStore: BlockStore
    networkingService: NetworkingService
    validatorSetManager: ValidatorSetManager
    eventBusService: EventBusService
    configService: ConfigService
    ce128BlockRequestProtocol: BlockRequestProtocol
  }) {
    super('block-announcement-service')
    this.blockStore = options.blockStore
    this.eventBusService = options.eventBusService
    this.configService = options.configService
    this.eventBusService.addBlocksReceivedCallback(
      this.handleBlocksReceived.bind(this),
    )
    this.eventBusService.addBlocksRequestedCallback(
      this.handleBlocksRequested.bind(this),
    )
    this.ce128BlockRequestProtocol = options.ce128BlockRequestProtocol
    this.networkingService = options.networkingService
  }

  stop(): Safe<boolean> {
    this.eventBusService.removeBlocksReceivedCallback(
      this.handleBlocksReceived.bind(this),
    )
    this.eventBusService.removeBlocksRequestedCallback(
      this.handleBlocksRequested.bind(this),
    )
    return safeResult(true)
  }

  async handleBlocksReceived(
    blocks: Block[],
    _peerPublicKey: Hex,
  ): SafePromise<void> {
    logger.info('📨 Processing block response', {
      blocksReceived: blocks.length,
    })

    for (const block of blocks) {
      // this.blockCache.set(blockHash, block)
      await this.blockStore.storeBlock(block)
    }

    return safeResult(undefined)
  }

  async handleBlocksRequested(
    request: BlockRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    logger.info('📨 Processing block request', {
      blocksRequested: request.maximumBlocks.toString(),
    })

    const rawBlocks: Block[] = []
    let currentHash = request.headerHash
    let blocksFound = 0

    if (request.direction === BlockRequestDirection.ASCENDING_EXCLUSIVE) {
      // Find children of the given block
      while (blocksFound < request.maximumBlocks) {
        const [error, childBlock] =
          await this.blockStore.getChildBlock(currentHash)
        if (error) {
          return safeError(error)
        }

        if (!childBlock) break

        const [childBlockHashError, childBlockHash] = calculateBlockHash(
          childBlock,
          this.configService,
        )
        if (childBlockHashError) {
          return safeError(childBlockHashError)
        }

        rawBlocks.push(childBlock)
        blocksFound++
        currentHash = childBlockHash
      }
    } else if (
      request.direction === BlockRequestDirection.DESCENDING_INCLUSIVE
    ) {
      while (blocksFound < request.maximumBlocks) {
        const [error, parentBlock] =
          await this.blockStore.getParentBlock(currentHash)
        if (error) {
          return safeError(error)
        }

        if (!parentBlock) break

        const [parentBlockHashError, parentBlockHash] = calculateBlockHash(
          parentBlock,
          this.configService,
        )
        if (parentBlockHashError) {
          return safeError(parentBlockHashError)
        }

        rawBlocks.push(parentBlock)
        blocksFound++
        currentHash = parentBlockHash
      }
    }

    // construct the message and pass it to the networking service to send to the peer
    const [messageError, message] =
      this.ce128BlockRequestProtocol.serializeResponse({ blocks: rawBlocks })
    if (messageError) {
      return safeError(messageError)
    }
    await this.networkingService.sendMessageByPublicKey(
      peerPublicKey,
      128,
      message,
    )
    return safeResult(undefined)
  }
}
