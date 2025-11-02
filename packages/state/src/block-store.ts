/**
 * Block Store - Database Integration for JAM Blocks (Normalized Schema)
 *
 * Provides storage and retrieval of JAM blocks using fully normalized tables
 * No JSONB usage - all extrinsics stored in dedicated tables
 */

import { bytesToHex, type Hex, hexToBytes, zeroHash } from '@pbnj/core'
import {
  calculateBlockHash,
  calculateBlockHashFromHeader,
  decodeBlock,
  decodeHeader,
  encodeBlock,
  encodeHeader,
} from '@pbnj/serialization'
import type {
  Block,
  BlockHeader,
  IConfigService,
  Safe,
  SafePromise,
} from '@pbnj/types'
import { safeError, safeResult, safeTry } from '@pbnj/types'
import { count, desc, eq } from 'drizzle-orm'
import type { CoreDb } from './index'
import {
  blockHeaders,
  blocks,
  type DbNewBlock,
  type DbNewBlockHeader,
} from './schema/core-schema'

/**
 * Block storage status for tracking
 */
export type BlockStatus = 'pending' | 'validated' | 'finalized' | 'orphaned'

/**
 * Block range query options
 */
export interface BlockRangeQuery {
  /** Start timeslot (inclusive) */
  fromTimeslot?: bigint
  /** End timeslot (inclusive) */
  toTimeslot?: bigint
  /** Start block number (inclusive) */
  fromBlockNumber?: bigint
  /** End block number (inclusive) */
  toBlockNumber?: bigint
  /** Filter by author */
  authorIndex?: bigint
  /** Filter by status */
  status?: BlockStatus
}

/**
 * Block statistics
 */
export interface BlockStats {
  totalBlocks: number
  pendingBlocks: number
  validatedBlocks: number
  finalizedBlocks: number
  orphanedBlocks: number
  avgExtrinsicsPerBlock: number
  latestTimeslot: bigint | null
  earliestTimeslot: bigint | null
}

/**
 * Block Store for JAM blocks using normalized schema
 */
export class BlockStore {
  private readonly config: IConfigService
  constructor(
    private readonly db: CoreDb,
    config: IConfigService,
  ) {
    this.config = config
  }

  /**
   * Store a complete block (header + body) in normalized tables
   */
  async storeBlock(
    block: Block,
    status: BlockStatus = 'pending',
  ): Promise<Safe<Hex>> {
    const [blockHashError, blockHash] = calculateBlockHash(block, this.config)
    if (blockHashError) {
      return safeError(blockHashError)
    }

    const [encodeError, encodedBlock] = encodeBlock(block, this.config)
    if (encodeError) {
      return safeError(encodeError)
    }

    try {
      const blockData: DbNewBlock = {
        blockHash,
        encodedBlock: bytesToHex(encodedBlock),
        parent: block.header.parent,
        timeslot: block.header.timeslot,
        authorIndex: block.header.authorIndex,
        status,
      }

      await this.db.insert(blocks).values(blockData).onConflictDoNothing()

      return safeResult(blockHash)
    } catch (error) {
      return safeError(new Error(`Failed to store block: ${error}`))
    }
  }

  /**
   * Store only block header
   */
  async storeBlockHeader(header: BlockHeader): Promise<Safe<Hex>> {
    const [blockHashError, blockHash] = calculateBlockHashFromHeader(
      header,
      this.config,
    )
    if (blockHashError) {
      return safeError(blockHashError)
    }

    const [encodeError, encodedHeader] = encodeHeader(header, this.config)
    if (encodeError) {
      return safeError(encodeError)
    }

    try {
      const headerData: DbNewBlockHeader = {
        blockHash,
        parent: header.parent,
        encodedHeader: bytesToHex(encodedHeader),
        timeslot: header.timeslot,
        authorIndex: header.authorIndex,
      }

      await this.db
        .insert(blockHeaders)
        .values(headerData)
        .onConflictDoNothing()
      return safeResult(blockHash)
    } catch (error) {
      return safeError(new Error(`Failed to store block header: ${error}`))
    }
  }

  /**
   * Get child block by parent hash - reuses getBlock functionality
   */
  async getChildBlock(parentHash: Hex): SafePromise<Block | null> {
    // Find the child block by looking up the parent hash
    const [error, childResult] = await safeTry(
      this.db
        .select({ blockHash: blockHeaders.blockHash })
        .from(blockHeaders)
        .where(eq(blockHeaders.parent, parentHash))
        .limit(1),
    )
    if (error) {
      return safeError(error)
    }

    if (childResult.length === 0)
      return safeError(new Error('Child block not found'))

    // Reuse the existing getBlock method to get the full block
    return this.getBlock(childResult[0].blockHash)
  }

  /**
   * Get parent block by child hash - reuses getBlock functionality
   */
  async getParentBlock(childHash: Hex): SafePromise<Block | null> {
    // First get the child block to find its parent hash
    const [error, childResult] = await safeTry(
      this.db
        .select({ parent: blockHeaders.parent })
        .from(blockHeaders)
        .where(eq(blockHeaders.blockHash, childHash))
        .limit(1),
    )
    if (error) {
      return safeError(error)
    }

    if (childResult.length === 0) return safeResult(null)

    const parentHash = childResult[0].parent

    // Check if this is a genesis block (no parent)
    if (parentHash === zeroHash)
      return safeError(new Error('Parent block not found'))

    // Reuse the existing getBlock method to get the full parent block
    return this.getBlock(parentHash)
  }

  /**
   * Get block by hash - reconstructed from normalized tables using a single query with all joins
   */
  async getBlock(blockHash: Hex): SafePromise<Block | null> {
    // Get all block data (header + extrinsics) in a single query with LEFT JOINs
    const [error, blockResult] = await safeTry(
      this.db
        .select()
        .from(blocks)
        // Header-related joins
        .where(eq(blocks.blockHash, blockHash)),
    )
    if (error) {
      return safeError(error)
    }

    if (blockResult.length === 0) return safeResult(null)
    const block = blockResult[0]
    const [encodedBlockError, decodedBlock] = decodeBlock(
      hexToBytes(`0x${block.encodedBlock}`),
      this.config,
    )
    if (encodedBlockError) {
      return safeError(encodedBlockError)
    }

    return safeResult(decodedBlock.value)
  }

  /**
   * Get block header by hash
   */
  async getBlockHeader(blockHash: Hex): SafePromise<BlockHeader | null> {
    try {
      const result = await this.db
        .select()
        .from(blockHeaders)
        .where(eq(blockHeaders.blockHash, blockHash))
        .limit(1)

      if (result.length === 0) return safeResult(null)

      // Reconstruct header with normalized markers
      const headerResult = result[0]
      const [encodedHeaderError, decodedHeader] = decodeHeader(
        hexToBytes(`0x${headerResult.encodedHeader}`),
      )
      if (encodedHeaderError) {
        return safeError(encodedHeaderError)
      }
      return safeResult(decodedHeader.value)
    } catch (error) {
      console.error('Failed to get block header:', error)
      return safeError(new Error(`Failed to get block header: ${error}`))
    }
  }

  async getBlockHeaderByTimeslot(
    timeslot: bigint,
  ): SafePromise<BlockHeader | null> {
    try {
      const result = await this.db
        .select()
        .from(blockHeaders)
        .where(eq(blockHeaders.timeslot, timeslot))
        .limit(1)

      if (result.length === 0) return safeResult(null)

      // Reconstruct header with normalized markers
      const headerResult = result[0]
      const [encodedHeaderError, decodedHeader] = decodeHeader(
        hexToBytes(`0x${headerResult.encodedHeader}`),
      )
      if (encodedHeaderError) {
        return safeError(encodedHeaderError)
      }
      return safeResult(decodedHeader.value)
    } catch (error) {
      console.error('Failed to get block header by timeslot:', error)
      return safeError(
        new Error(`Failed to get block header by timeslot: ${error}`),
      )
    }
  }

  /**
   * Update block status
   */
  async updateBlockStatus(
    blockHash: Hex,
    status: BlockStatus,
  ): Promise<boolean> {
    try {
      await this.db
        .update(blocks)
        .set({
          status,
          finalizedAt: status === 'finalized' ? new Date() : undefined,
        })
        .where(eq(blocks.blockHash, blockHash))

      return true
    } catch (error) {
      console.error('Failed to update block status:', error)
      return false
    }
  }

  /**
   * Get latest finalized block
   */
  async getLatestFinalizedBlock(): SafePromise<Block | null> {
    const [error, result] = await safeTry(
      this.db
        .select()
        .from(blocks)
        .where(eq(blocks.status, 'finalized'))
        .orderBy(desc(blocks.timeslot))
        .limit(1),
    )
    if (error) {
      return safeError(error)
    }

    if (result.length === 0)
      return safeError(new Error('Latest finalized block not found'))

    return this.getBlock(result[0].blockHash)
  }

  /**
   * Get block statistics
   */
  // async getBlockStats(): Promise<BlockStats> {
  //   try {
  //     const [
  //       totalResult,
  //       pendingResult,
  //       validatedResult,
  //       finalizedResult,
  //       orphanedResult,
  //       timeslotRangeResult,
  //     ] = await Promise.all([
  //       this.db.select({ count: count() }).from(blocks),
  //       this.db
  //         .select({ count: count() })
  //         .from(blocks)
  //         .where(eq(blocks.status, 'pending')),
  //       this.db
  //         .select({ count: count() })
  //         .from(blocks)
  //         .where(eq(blocks.status, 'validated')),
  //       this.db
  //         .select({ count: count() })
  //         .from(blocks)
  //         .where(eq(blocks.status, 'finalized')),
  //       this.db
  //         .select({ count: count() })
  //         .from(blocks)
  //         .where(eq(blocks.status, 'orphaned')),
  //       this.db
  //         .select({
  //           minTimeslot: min(blocks.timeslot),
  //           maxTimeslot: max(blocks.timeslot),
  //         })
  //         .from(blocks),
  //     ])

  //     return {
  //       totalBlocks: totalResult[0]?.count || 0,
  //       pendingBlocks: pendingResult[0]?.count || 0,
  //       validatedBlocks: validatedResult[0]?.count || 0,
  //       finalizedBlocks: finalizedResult[0]?.count || 0,
  //       orphanedBlocks: orphanedResult[0]?.count || 0,
  //       latestTimeslot: timeslotRangeResult[0]?.maxTimeslot || null,
  //       earliestTimeslot: timeslotRangeResult[0]?.minTimeslot || null,
  //     }
  //   } catch (error) {
  //     console.error('Failed to get block stats:', error)
  //     return {
  //       totalBlocks: 0,
  //       pendingBlocks: 0,
  //       validatedBlocks: 0,
  //       finalizedBlocks: 0,
  //       orphanedBlocks: 0,
  //       avgExtrinsicsPerBlock: 0,
  //       latestTimeslot: null,
  //       earliestTimeslot: null,
  //     }
  //   }
  // }

  /**
   * Check if block exists
   */
  async hasBlock(blockHash: Hex): Promise<boolean> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(blockHeaders)
        .where(eq(blockHeaders.blockHash, blockHash))

      return (result[0]?.count || 0) > 0
    } catch (error) {
      console.error('Failed to check block existence:', error)
      return false
    }
  }

  /**
   * Delete block (mark as orphaned)
   */
  async deleteBlock(blockHash: Hex): Promise<boolean> {
    return this.updateBlockStatus(blockHash, 'orphaned')
  }
}
