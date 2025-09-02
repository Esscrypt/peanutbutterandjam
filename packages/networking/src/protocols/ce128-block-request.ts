/**
 * CE 128: Block Request Protocol
 *
 * Implements the block request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting sequences of blocks.
 */

import type { NetworkingStore } from '@pbnj/state'
import type { BlockRequest, BlockResponse, StreamInfo } from '@pbnj/types'
import { BlockRequestDirection } from '@pbnj/types'

/**
 * Block request protocol handler
 */
export class BlockRequestProtocol {
  private blockStore: Map<string, Uint8Array> = new Map()
  private dbIntegration: NetworkingStore | null = null

  constructor(dbIntegration?: NetworkingStore) {
    this.dbIntegration = dbIntegration || null
  }

  /**
   * Set database integration for persistent storage
   */
  setDatabaseIntegration(dbIntegration: NetworkingStore): void {
    this.dbIntegration = dbIntegration
  }

  /**
   * Load state from database
   */
  async loadState(): Promise<void> {
    if (!this.dbIntegration) return

    try {
      // Load blocks from database
      // We'll store blocks in service account storage (service ID 2 for blocks)
      const storage = await this.dbIntegration.getServiceAccountStore()

      for (const [key, value] of storage) {
        if (key.startsWith('block_')) {
          const blockHash = key.replace('block_', '')
          this.blockStore.set(blockHash, value)
        }
      }

      console.log(`Loaded ${this.blockStore.size} blocks from database`)
    } catch (error) {
      console.error('Failed to load blocks from database:', error)
    }
  }

  /**
   * Add block to local store and persist to database
   */
  async addBlock(blockHash: Uint8Array, blockData: Uint8Array): Promise<void> {
    const hashString = blockHash.toString()
    this.blockStore.set(hashString, blockData)

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          `block_${hashString}`,
          blockData,
        )
      } catch (error) {
        console.error('Failed to persist block to database:', error)
      }
    }
  }

  /**
   * Remove block from local store and database
   */
  async removeBlock(blockHash: Uint8Array): Promise<void> {
    const hashString = blockHash.toString()
    this.blockStore.delete(hashString)

    // Note: We don't have a delete method in the current interface
    // For now, we'll mark it as removed by setting a special value
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          `removed_block_${hashString}`,
          Buffer.from('removed'),
        )
      } catch (error) {
        console.error('Failed to remove block from database:', error)
      }
    }
  }

  /**
   * Check if block is available locally
   */
  hasBlock(blockHash: Uint8Array): boolean {
    return this.blockStore.has(blockHash.toString())
  }

  /**
   * Get block from local store
   */
  getBlock(blockHash: Uint8Array): Uint8Array | undefined {
    return this.blockStore.get(blockHash.toString())
  }

  /**
   * Get block from database if not in local store
   */
  async getBlockFromDatabase(
    blockHash: Uint8Array,
  ): Promise<Uint8Array | null> {
    if (this.hasBlock(blockHash)) {
      return this.getBlock(blockHash) || null
    }

    if (!this.dbIntegration) return null

    try {
      const hashString = blockHash.toString()
      const blockData = await this.dbIntegration.getServiceStorage(
        `block_${hashString}`,
      )

      if (blockData && blockData.toString() !== 'removed') {
        // Cache in local store
        this.blockStore.set(hashString, blockData)
        return blockData
      }

      return null
    } catch (error) {
      console.error('Failed to get block from database:', error)
      return null
    }
  }

  /**
   * Create block request message
   */
  createBlockRequest(
    headerHash: Uint8Array,
    direction: BlockRequestDirection,
    maximumBlocks: number,
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
  async processBlockRequest(
    request: BlockRequest,
  ): Promise<BlockResponse | null> {
    const blocks: Uint8Array[] = []
    let currentHash = request.headerHash
    let blocksFound = 0

    if (request.direction === BlockRequestDirection.ASCENDING_EXCLUSIVE) {
      // Find children of the given block
      while (blocksFound < request.maximumBlocks) {
        const childHash = await this.findChildBlock(currentHash)
        if (!childHash) break

        const blockData = await this.getBlockFromDatabase(childHash)
        if (!blockData) break

        // Check if block can be finalized
        if (!(await this.canBeFinalized(childHash))) break

        blocks.push(blockData)
        blocksFound++
        currentHash = childHash
      }
    } else if (
      request.direction === BlockRequestDirection.DESCENDING_INCLUSIVE
    ) {
      // Start with the given block and go up the chain
      let blockData = await this.getBlockFromDatabase(currentHash)
      if (blockData && (await this.canBeFinalized(currentHash))) {
        blocks.push(blockData)
        blocksFound++
      }

      while (blocksFound < request.maximumBlocks) {
        const parentHash = await this.findParentBlock(currentHash)
        if (!parentHash) break

        blockData = await this.getBlockFromDatabase(parentHash)
        if (!blockData) break

        if (!(await this.canBeFinalized(parentHash))) break

        blocks.push(blockData)
        blocksFound++
        currentHash = parentHash
      }
    }

    if (blocks.length === 0) {
      return null
    }

    return {
      blocks,
    }
  }

  /**
   * Find child block by examining block data
   * This is a simplified implementation - in practice, you'd parse the block header
   */
  private async findChildBlock(
    _parentHash: Uint8Array,
  ): Promise<Uint8Array | null> {
    // This would require parsing block headers to find child relationships
    // For now, we'll return null as this is a placeholder implementation
    return null
  }

  /**
   * Find parent block by examining block data
   * This is a simplified implementation - in practice, you'd parse the block header
   */
  private async findParentBlock(
    _childHash: Uint8Array,
  ): Promise<Uint8Array | null> {
    // This would require parsing block headers to find parent relationships
    // For now, we'll return null as this is a placeholder implementation
    return null
  }

  /**
   * Check if block can be finalized
   * This is a simplified implementation - in practice, you'd check finality criteria
   */
  private async canBeFinalized(_blockHash: Uint8Array): Promise<boolean> {
    // This would require checking finality criteria
    // For now, we'll assume all blocks can be finalized
    return true
  }

  /**
   * Serialize block request message
   */
  serializeBlockRequest(request: BlockRequest): Uint8Array {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(32 + 1 + 4)
    const view = new DataView(buffer)
    let offset = 0

    // Write header hash (32 bytes)
    new Uint8Array(buffer).set(request.headerHash, offset)
    offset += 32

    // Write direction (1 byte)
    view.setUint8(offset, request.direction)
    offset += 1

    // Write maximum blocks (4 bytes, little-endian)
    view.setUint32(offset, request.maximumBlocks, true)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize block request message
   */
  deserializeBlockRequest(data: Uint8Array): BlockRequest {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read header hash (32 bytes)
    const headerHash = data.slice(offset, offset + 32)
    offset += 32

    // Read direction (1 byte)
    const direction = view.getUint8(offset) as BlockRequestDirection
    offset += 1

    // Read maximum blocks (4 bytes, little-endian)
    const maximumBlocks = view.getUint32(offset, true)

    return {
      headerHash,
      direction,
      maximumBlocks,
    }
  }

  /**
   * Serialize block response message
   */
  serializeBlockResponse(response: BlockResponse): Uint8Array {
    // Serialize according to JAMNP-S specification
    const totalSize =
      4 + response.blocks.reduce((size, block) => size + 4 + block.length, 0)
    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)
    let offset = 0

    // Write number of blocks (4 bytes, little-endian)
    view.setUint32(offset, response.blocks.length, true)
    offset += 4

    // Write each block
    for (const block of response.blocks) {
      // Write block length (4 bytes, little-endian)
      view.setUint32(offset, block.length, true)
      offset += 4

      // Write block data
      new Uint8Array(buffer).set(block, offset)
      offset += block.length
    }

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize block response message
   */
  deserializeBlockResponse(data: Uint8Array): BlockResponse {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read number of blocks (4 bytes, little-endian)
    const numBlocks = view.getUint32(offset, true)
    offset += 4

    // Read each block
    const blocks: Uint8Array[] = []
    for (let i = 0; i < numBlocks; i++) {
      // Read block length (4 bytes, little-endian)
      const blockLength = view.getUint32(offset, true)
      offset += 4

      // Read block data
      const block = data.slice(offset, offset + blockLength)
      offset += blockLength

      blocks.push(block)
    }

    return {
      blocks,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(
    _stream: StreamInfo,
    data: Uint8Array,
  ): Promise<BlockResponse | null> {
    try {
      const request = this.deserializeBlockRequest(data)
      return await this.processBlockRequest(request)
    } catch (error) {
      console.error('Failed to handle stream data:', error)
      return null
    }
  }
}
