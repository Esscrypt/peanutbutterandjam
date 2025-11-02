/**
 * Block Header Service
 *
 * Provides block header retrieval from block store and hash computation
 * Following the same pattern as computeGenesisHeaderHash
 */

import { type Hex, logger } from '@pbnj/core'
import type { BlockStore } from '@pbnj/state'
import {
  BaseService,
  type BlockHeader,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/types'

/**
 * Block Header Service
 *
 * Provides methods to:
 * 1. Retrieve block headers from the block store
 * 2. Compute block header hashes using the same pattern as computeGenesisHeaderHash
 * 3. Validate header integrity
 */
export class BlockHeaderService extends BaseService {
  private readonly blockStore: BlockStore

  constructor(options: { blockStore: BlockStore }) {
    super('block-header-service')
    this.blockStore = options.blockStore
  }

  /**
   * Get block header by hash from block store
   *
   * @param blockHash - The block hash to retrieve
   * @returns Block header or null if not found
   */
  async getBlockHeader(blockHash: Hex): SafePromise<BlockHeader | null> {
    return await this.blockStore.getBlockHeader(blockHash)
  }

  async getBlockHeaderByTimeslot(
    timeslot: bigint,
  ): SafePromise<BlockHeader | null> {
    return await this.blockStore.getBlockHeaderByTimeslot(timeslot)
  }

  /**
   * Get multiple block headers by their hashes
   *
   * @param blockHashes - Array of block hashes to retrieve
   * @returns Map of block hash to header (only includes found headers)
   */
  async getBlockHeaders(blockHashes: Hex[]): Promise<Map<Hex, BlockHeader>> {
    const headers = new Map<Hex, BlockHeader>()

    logger.debug('Retrieving multiple block headers', {
      count: blockHashes.length,
    })

    for (const blockHash of blockHashes) {
      const [headerError, header] = await this.getBlockHeader(blockHash)
      if (headerError) {
        logger.error('Failed to get block header', {
          blockHash,
          error: headerError,
        })
        continue
      }
      if (header) {
        headers.set(blockHash, header)
      }
    }

    logger.debug('Retrieved block headers', {
      requested: blockHashes.length,
      found: headers.size,
    })

    return headers
  }

  async getParentBlockHeader(
    header: BlockHeader,
  ): SafePromise<BlockHeader | null> {
    return await this.blockStore.getBlockHeader(header.parent)
  }

  async getParentBlockHash(header: BlockHeader): SafePromise<Hex> {
    const [error, parentBlock] = await this.getParentBlockHeader(header)
    if (error) {
      return safeError(error)
    }
    if (!parentBlock) {
      return safeError(new Error('Parent block not found'))
    }
    return safeResult(parentBlock.parent)
  }
}
