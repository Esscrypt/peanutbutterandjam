/**
 * CE 128: Block Request Protocol
 *
 * Implements the block request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting sequences of blocks.
 */

import type { Hex, Safe, SafePromise } from '@pbnj/core'
import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  calculateBlockHash,
  decodeBlock,
  decodeFixedLength,
  decodeNatural,
  encodeBlock,
  encodeFixedLength,
  encodeNatural,
} from '@pbnj/serialization'
import type { BlockStore } from '@pbnj/state'
import type { Block, BlockRequest, BlockResponse } from '@pbnj/types'
import { BlockRequestDirection } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Block request protocol handler
 */
export class BlockRequestProtocol extends NetworkingProtocol<
  BlockRequest,
  BlockResponse
> {
  private blockCache: Map<Hex, Block> = new Map()
  private blockStore: BlockStore

  constructor(blockStore: BlockStore) {
    super()
    this.blockStore = blockStore
  }

  /**
   * Check if block is available locally
   */
  hasBlock(blockHash: Hex): boolean {
    return this.blockCache.has(blockHash)
  }

  /**
   * Get block from local store
   */
  getBlock(blockHash: Hex): Safe<Block | null> {
    return safeResult(this.blockCache.get(blockHash) ?? null)
  }

  /**
   * Get block from database if not in local store
   */
  async getBlockFromDatabase(blockHash: Hex): SafePromise<Block | null> {
    if (this.hasBlock(blockHash)) {
      return this.getBlock(blockHash)!
    }

    if (!this.blockStore) return safeError(new Error('Block store not found'))

    const [error, blockData] = await this.blockStore.getBlock(blockHash)

    if (error) {
      return safeError(error)
    }

    if (blockData) {
      // Cache in local store
      this.blockCache.set(blockHash, blockData)
      return safeResult(blockData)
    }

    return safeResult(null)
  }

  /**
   * Create block request message
   */
  createBlockRequest(
    headerHash: Hex,
    direction: BlockRequestDirection,
    maximumBlocks: bigint,
  ): BlockRequest {
    return {
      headerHash,
      direction,
      maximumBlocks,
    }
  }

  /**
   * Process block request and generate response
   */
  async processRequest(request: BlockRequest): SafePromise<BlockResponse> {
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

        const [childBlockHashError, childBlockHash] =
          calculateBlockHash(childBlock)
        if (childBlockHashError) {
          return safeError(childBlockHashError)
        }

        // Check if block can be finalized
        if (!(await this.canBeFinalized(childBlockHash))) break

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

        const [parentBlockHashError, parentBlockHash] =
          calculateBlockHash(parentBlock)
        if (parentBlockHashError) {
          return safeError(parentBlockHashError)
        }

        if (!(await this.canBeFinalized(parentBlockHash))) break

        rawBlocks.push(parentBlock)
        blocksFound++
        currentHash = parentBlockHash
      }
    }

    if (rawBlocks.length === 0) {
      return safeResult({
        blocks: [],
      })
    }

    // Encode blocks using Gray Paper serialization as per JAMNP-S specification
    const encodedBlocks: Block[] = []
    for (const block of rawBlocks) {
      encodedBlocks.push(block)
    }

    return safeResult({
      blocks: encodedBlocks,
    })
  }

  /**
   * Check if block can be finalized
   * This is a simplified implementation - in practice, you'd check finality criteria
   */
  private async canBeFinalized(_blockHash: Hex): Promise<boolean> {
    // This would require checking finality criteria
    // For now, we'll assume all blocks can be finalized
    return true
  }

  /**
   * Serialize block request message
   */
  serializeRequest(request: BlockRequest): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const parts: Uint8Array[] = []

    parts.push(hexToBytes(request.headerHash))

    const [error, direction] = encodeFixedLength(BigInt(request.direction), 1n)
    if (error) {
      return safeError(error)
    }
    parts.push(direction)

    const [error2, maximumBlocks] = encodeFixedLength(request.maximumBlocks, 4n)
    if (error2) {
      return safeError(error2)
    }
    parts.push(maximumBlocks)

    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize block request message
   */
  deserializeRequest(data: Uint8Array): Safe<BlockRequest> {
    let currentData = data
    const headerHash = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)

    const [error2, direction] = decodeFixedLength(currentData, 1n)
    if (error2) {
      return safeError(error2)
    }
    currentData = direction.remaining
    const directionValue =
      direction.value === 0n
        ? BlockRequestDirection.ASCENDING_EXCLUSIVE
        : BlockRequestDirection.DESCENDING_INCLUSIVE
    const [error3, maximumBlocksResult] = decodeFixedLength(currentData, 4n)
    if (error3) {
      return safeError(error3)
    }

    return safeResult({
      headerHash: headerHash,
      direction: directionValue as BlockRequestDirection,
      maximumBlocks: maximumBlocksResult.value,
    })
  }

  /**
   * Deserialize block response message
   */
  deserializeResponse(data: Uint8Array): Safe<BlockResponse> {
    let currentData = data
    const [error, numberOfBlocksResult] = decodeNatural(currentData)
    if (error) {
      return safeError(error)
    }
    const numBlocks = numberOfBlocksResult.value
    currentData = numberOfBlocksResult.remaining

    // Read each block
    const blocks: Block[] = []
    for (let i = 0; i < numBlocks; i++) {
      const [error, block] = decodeBlock(currentData)
      if (error) {
        return safeError(error)
      }
      blocks.push(block.value)
    }

    return safeResult({ blocks })
  }

  /**
   * Serialize block response message
   * According to JAMNP-S specification: <-- [Block] where each Block = As in GP
   */
  //   Direction = 0 (Ascending exclusive) OR 1 (Descending inclusive) (Single byte)
  // Maximum Blocks = u32
  // Block = As in GP

  // Node -> Node

  // --> Header Hash ++ Direction ++ Maximum Blocks
  // --> FIN
  // <-- [Block]
  // <-- FIN
  serializeResponse(response: BlockResponse): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification

    const parts: Uint8Array[] = []
    const [error, numberOfBlocks] = encodeNatural(
      BigInt(response.blocks.length),
    )
    if (error) {
      return safeError(error)
    }
    parts.push(numberOfBlocks)

    // Write each serialized block (already Gray Paper encoded)
    for (const block of response.blocks) {
      const [error, encodedBlock] = encodeBlock(block)
      if (error) {
        return safeError(error)
      }
      parts.push(encodedBlock)
    }

    return safeResult(concatBytes(parts))
  }

  async processResponse(response: BlockResponse): SafePromise<void> {
    for (const block of response.blocks) {
      const [error, blockHash] = calculateBlockHash(block)
      if (error) {
        return safeError(error)
      }
      this.blockCache.set(blockHash, block)
      this.blockStore.storeBlock(block)
    }
    return safeResult(undefined)
  }
}
