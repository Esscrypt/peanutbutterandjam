/**
 * UP 0: Block Announcement Protocol
 *
 * Implements the block announcement protocol for JAMNP-S.
 * This is a Unique Persistent (UP) stream that should be opened between neighbors
 * in the validator grid structure.
 *
 * This implementation is a placeholder and will be replaced with a more complete
 * implementation in the future.
 */
import {
  bytesToHex,
  concatBytes,
  type Hex,
  hexToBytes,
  logger,
  numberToBytes,
} from '@pbnj/core'
import {
  decodeFixedLength,
  decodeHeader,
  encodeHeader,
} from '@pbnj/serialization'
import type { BlockStore } from '@pbnj/state'
import type {
  BlockAnnouncement,
  BlockAnnouncementHandshake,
  BlockHeader,
  IConfigService,
  Safe,
  SafePromise,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Block announcement protocol handler
 */
export class BlockAnnouncementProtocol extends NetworkingProtocol<
  BlockAnnouncement | BlockAnnouncementHandshake,
  void
> {
  private readonly knownLeaves: Map<
    string,
    { hash: Uint8Array; slot: bigint }
  > = new Map()

  private readonly blockStore: BlockStore
  private readonly finalizedBlock: { hash: Uint8Array; slot: bigint } = {
    hash: new Uint8Array(32),
    slot: 0n,
  }
  private readonly configService: IConfigService

  constructor(blockStore: BlockStore, configService: IConfigService) {
    super()
    this.blockStore = blockStore
    this.configService = configService

    // Initialize event handlers using the base class method
    this.initializeEventHandlers()
  }

  /**
   * Serialize request (either handshake or announcement)
   */
  serializeRequest(
    data: BlockAnnouncement | BlockAnnouncementHandshake,
  ): Safe<Uint8Array> {
    try {
      if ('finalizedBlockHash' in data) {
        // It's a handshake
        return this.serializeHandshake(data as BlockAnnouncementHandshake)
      } else {
        // It's a block announcement
        return this.serializeBlockAnnouncement(data as BlockAnnouncement)
      }
    } catch (error) {
      return safeError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  /**
   * Deserialize request (either handshake or announcement)
   */
  deserializeRequest(
    data: Uint8Array,
  ): Safe<BlockAnnouncement | BlockAnnouncementHandshake> {
    try {
      // Check the first byte to determine the message type
      // 0 = handshake, 1 = announcement
      const messageType = data[0]

      if (messageType === 0) {
        return safeResult(this.deserializeHandshake(data.slice(1)))
      } else if (messageType === 1) {
        return safeResult(this.deserializeBlockAnnouncement(data.slice(1)))
      } else {
        return safeError(new Error(`Unknown message type: ${messageType}`))
      }
    } catch (error) {
      return safeError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  /**
   * Serialize response (void)
   */
  serializeResponse(_data: void): Safe<Uint8Array> {
    return safeResult(new Uint8Array())
  }

  /**
   * Deserialize response (void)
   */
  deserializeResponse(_data: Uint8Array): Safe<void> {
    return safeResult(undefined)
  }

  /**
   * Process request (either handshake or announcement)
   */
  async processRequest(
    data: BlockAnnouncement | BlockAnnouncementHandshake,
    _peerPublicKey: Hex,
  ): SafePromise<void> {
    try {
      if ('finalizedBlockHash' in data) {
        // It's a handshake
        await this.processHandshake(data as BlockAnnouncementHandshake)
      } else {
        // It's a block announcement
        await this.processBlockAnnouncement(data as BlockAnnouncement)
      }
      return safeResult(undefined)
    } catch (error) {
      return safeError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  /**
   * Process response (void)
   */
  async processResponse(_data: void, _peerPublicKey: Hex): SafePromise<void> {
    return safeResult(undefined)
  }

  /**
   * Update finalized block
   */
  async updateFinalizedBlock(hash: Uint8Array, _slot: bigint): Promise<void> {
    // Persist to database
    if (this.blockStore) {
      try {
        await this.blockStore.updateBlockStatus(bytesToHex(hash), 'finalized')
      } catch (error) {
        logger.error('Failed to persist finalized block:', {
          hash: bytesToHex(hash).slice(0, 20) + '...',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  /**
   * Add known leaf (descendant of finalized block with no children)
   */
  //   async addKnownLeaf(hash: Uint8Array, slot: bigint): Promise<void> {
  //     this.knownLeaves.set(hash.toString(), { hash, slot })

  //     // Persist to database
  //     if (this.blockStore) {
  //       try {
  //         await this.blockStore.storeKnownLeaf(hash, slot)
  //       } catch (error) {
  //         console.error('Failed to persist known leaf:', error)
  //       }
  //     }
  //   }

  /**
   * Remove known leaf (when it becomes a parent)
   */
  //   async removeKnownLeaf(hash: Uint8Array): Promise<void> {
  //     this.knownLeaves.delete(hash.toString())

  //     // Remove from database
  //     if (this.blockStore) {
  //       try {
  //         await this.blockStore.removeKnownLeaf(hash)
  //       } catch (error) {
  //         console.error('Failed to remove known leaf from database:', error)
  //       }
  //     }
  //   }

  /**
   * Create handshake message
   */
  //   createHandshake(): BlockAnnouncementHandshake {
  //     return {
  //       finalBlockHash: this.finalizedBlock.hash,
  //       finalBlockSlot: BigInt(this.finalizedBlock.slot),
  //       leaves: Array.from(this.knownLeaves.values()),
  //     }
  //   }

  /**
   * Process handshake message from peer
   */
  async processHandshake(handshake: BlockAnnouncementHandshake): Promise<void> {
    // Update our finalized block if peer has a newer one
    if (handshake.finalBlockSlot > this.finalizedBlock.slot) {
      await this.updateFinalizedBlock(
        handshake.finalBlockHash,
        handshake.finalBlockSlot,
      )
    }

    // Add any new leaves from peer
    for (const leaf of handshake.leaves) {
      if (!this.knownLeaves.has(leaf.hash.toString())) {
        // await this.addKnownLeaf(leaf.hash, leaf.slot)
      }
    }
  }

  /**
   * Create block announcement message
   */
  createBlockAnnouncement(blockHeader: Uint8Array): BlockAnnouncement {
    const [error, blockHeaderResult] = decodeHeader(blockHeader)
    if (error) {
      throw error
    }

    return {
      header: blockHeaderResult.value,
      finalBlockHash: bytesToHex(this.finalizedBlock.hash),
      finalBlockSlot: blockHeaderResult.value.timeslot,
    }
  }

  /**
   * Process block announcement from peer
   */
  async processBlockAnnouncement(
    announcement: BlockAnnouncement,
  ): Promise<void> {
    // Update finalized block if peer has a newer one
    if (
      !this.finalizedBlock ||
      announcement.finalBlockSlot > this.finalizedBlock.slot
    ) {
      await this.updateFinalizedBlock(
        hexToBytes(announcement.finalBlockHash),
        announcement.finalBlockSlot,
      )
    }

    // Process the block header
    await this.processBlockHeader(announcement.header)
  }

  /**
   * Process block header
   */
  private async processBlockHeader(header: BlockHeader): Promise<void> {
    try {
      const slot = header.timeslot

      // Add as known leaf
      //   await this.addKnownLeaf(blockHash, slot)

      logger.info('Processed block header', {
        parentHash: header.parent.slice(0, 20) + '...',
        slot: slot.toString(),
      })
    } catch (error) {
      logger.error('Failed to process block header:', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Check if we should announce a block to neighbors
   */
  shouldAnnounceBlock(blockHash: Uint8Array): boolean {
    // Announce if we have the block and it's not already known to all neighbors
    if (!this.knownLeaves.has(blockHash.toString())) {
      return false
    }

    // Additional logic could be added here to check if neighbors need this block
    return true
  }

  /**
   * Serialize handshake message
   */
  serializeHandshake(handshake: BlockAnnouncementHandshake): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(
      4 + 32 + 4 + handshake.leaves.length * (32 + 4),
    )
    const view = new DataView(buffer)
    let offset = 0

    // Write final block hash (32 bytes)
    new Uint8Array(buffer).set(handshake.finalBlockHash, offset)
    offset += 32

    // Write final block slot (4 bytes, little-endian)
    view.setUint32(offset, Number(handshake.finalBlockSlot), true)
    offset += 4

    // Write number of leaves (4 bytes, little-endian)
    view.setUint32(offset, handshake.leaves.length, true)
    offset += 4

    // Write each leaf
    for (const leaf of handshake.leaves) {
      // Write leaf hash (32 bytes)
      new Uint8Array(buffer).set(leaf.hash, offset)
      offset += 32

      // Write leaf slot (4 bytes, little-endian)
      view.setUint32(offset, Number(leaf.slot), true)
      offset += 4
    }

    return safeResult(new Uint8Array(buffer))
  }

  /**
   * Deserialize handshake message
   */
  deserializeHandshake(data: Uint8Array): BlockAnnouncementHandshake {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read final block hash (32 bytes)
    const finalBlockHash = data.slice(offset, offset + 32)
    offset += 32

    // Read final block slot (4 bytes, little-endian)
    const finalBlockSlot = view.getUint32(offset, true)
    offset += 4

    // Read number of leaves (4 bytes, little-endian)
    const numLeaves = view.getUint32(offset, true)
    offset += 4

    // Read each leaf
    const leaves: Array<{ hash: Uint8Array; slot: bigint }> = []
    for (let i = 0; i < numLeaves; i++) {
      // Read leaf hash (32 bytes)
      const hash = data.slice(offset, offset + 32)
      offset += 32

      // Read leaf slot (4 bytes, little-endian)
      const slot = BigInt(view.getUint32(offset, true))
      offset += 4

      leaves.push({ hash, slot })
    }

    return {
      finalBlockHash,
      finalBlockSlot: BigInt(finalBlockSlot),
      leaves,
    }
  }

  /**
   * Serialize block announcement message
   */
  serializeBlockAnnouncement(
    announcement: BlockAnnouncement,
  ): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const parts: Uint8Array[] = []

    // Write block header
    // new Uint8Array(buffer).set(announcement.header, offset)
    // offset += announcement.header.length
    const [error, encodedHeader] = encodeHeader(
      announcement.header,
      this.configService,
    )
    if (error) {
      return safeError(error)
    }
    parts.push(encodedHeader)

    const finalBlockHash = hexToBytes(announcement.finalBlockHash)
    // Write final block hash (32 bytes)
    parts.push(finalBlockHash)

    // Write final block slot (4 bytes, little-endian)
    parts.push(numberToBytes(announcement.finalBlockSlot))

    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize block announcement message
   */
  deserializeBlockAnnouncement(data: Uint8Array): BlockAnnouncement {
    let currentData = data
    // Read block header
    const [error, decodedHeader] = decodeHeader(currentData)
    if (error) {
      throw error
    }
    const header = decodedHeader.value

    currentData = decodedHeader.remaining

    // Read final block hash (32 bytes)
    const finalBlockHash = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)

    const [finalBlockSlotError, finalBlockSlotResult] = decodeFixedLength(
      currentData,
      32n,
    )
    if (finalBlockSlotError) {
      throw finalBlockSlotError
    }

    return {
      header,
      finalBlockHash,
      finalBlockSlot: finalBlockSlotResult.value,
    }
  }

  /**
   * Handle incoming stream data
   */
  // async handleStreamData(_stream: StreamInfo, data: Uint8Array): Promise<void> {
  //   if (data.length === 0) {
  //     // Initial handshake
  //     // const _handshake = this.createHandshake()
  //     // Send handshake response would be handled by the stream manager
  //     return
  //   }

  //   // Try to parse as handshake first
  //   try {
  //     const handshake = this.deserializeHandshake(data)
  //     await this.processHandshake(handshake)
  //     return
  //   } catch (_error) {
  //     // Not a handshake, try as block announcement
  //   }

  //   // Try to parse as block announcement
  //   try {
  //     // Assume header length is 128 bytes (placeholder)
  //     const announcement = this.deserializeBlockAnnouncement(data)
  //     await this.processBlockAnnouncement(announcement)
  //   } catch (error) {
  //     console.error('Failed to parse block announcement data:', error)
  //   }
  // }
}
