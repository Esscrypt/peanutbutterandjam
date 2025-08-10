/**
 * UP 0: Block Announcement Protocol
 *
 * Implements the block announcement protocol for JAMNP-S
 * This is a Unique Persistent (UP) stream that should be opened between neighbors
 * in the validator grid structure.
 */

import { blake2bHash } from '@pbnj/core'
import type {
  BlockAnnouncement,
  BlockAnnouncementHandshake,
  Bytes,
  StreamInfo,
  ValidatorGrid,
  ValidatorMetadata,
} from '@pbnj/types'
import type { NetworkingDatabaseIntegration } from '../db-integration'

/**
 * Block announcement protocol handler
 */
export class BlockAnnouncementProtocol {
  private knownLeaves: Map<string, { hash: Bytes; slot: number }> = new Map()
  private finalizedBlock: { hash: Bytes; slot: number } | null = null
  private grid: ValidatorGrid | null = null
  private dbIntegration: NetworkingDatabaseIntegration | null = null

  constructor(dbIntegration?: NetworkingDatabaseIntegration) {
    this.dbIntegration = dbIntegration || null
  }

  /**
   * Set database integration for persistent state
   */
  setDatabaseIntegration(dbIntegration: NetworkingDatabaseIntegration): void {
    this.dbIntegration = dbIntegration
  }

  /**
   * Load state from database
   */
  async loadState(): Promise<void> {
    if (!this.dbIntegration) return

    try {
      // Load finalized block
      const finalizedBlock = await this.dbIntegration.getFinalizedBlock()
      if (finalizedBlock) {
        this.finalizedBlock = finalizedBlock
      }

      // Load known leaves
      const knownLeaves = await this.dbIntegration.getKnownLeaves()
      this.knownLeaves.clear()
      for (const leaf of knownLeaves) {
        this.knownLeaves.set(leaf.hash.toString(), leaf)
      }

      console.log(
        `Loaded state: finalized block at slot ${this.finalizedBlock?.slot}, ${this.knownLeaves.size} known leaves`,
      )
    } catch (error) {
      console.error('Failed to load state from database:', error)
    }
  }

  /**
   * Set validator grid for neighbor detection
   */
  setValidatorGrid(grid: ValidatorGrid, validators: ValidatorMetadata[]): void {
    this.grid = grid
    this.validators = validators
  }

  /**
   * Update finalized block
   */
  async updateFinalizedBlock(hash: Bytes, slot: number): Promise<void> {
    this.finalizedBlock = { hash, slot }

    // Persist to database
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.storeFinalizedBlock(hash, slot)
      } catch (error) {
        console.error('Failed to persist finalized block:', error)
      }
    }
  }

  /**
   * Add known leaf (descendant of finalized block with no children)
   */
  async addKnownLeaf(hash: Bytes, slot: number): Promise<void> {
    this.knownLeaves.set(hash.toString(), { hash, slot })

    // Persist to database
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.storeKnownLeaf(hash, slot)
      } catch (error) {
        console.error('Failed to persist known leaf:', error)
      }
    }
  }

  /**
   * Remove known leaf (when it becomes a parent)
   */
  async removeKnownLeaf(hash: Bytes): Promise<void> {
    this.knownLeaves.delete(hash.toString())

    // Remove from database
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.removeKnownLeaf(hash)
      } catch (error) {
        console.error('Failed to remove known leaf from database:', error)
      }
    }
  }

  /**
   * Check if two validators are neighbors in the grid
   */
  areNeighbors(validatorA: number, validatorB: number): boolean {
    if (!this.grid) return false

    const posA = this.grid.positions.get(validatorA)
    const posB = this.grid.positions.get(validatorB)

    if (!posA || !posB) return false

    // Same row or same column
    return posA.row === posB.row || posA.column === posB.column
  }

  /**
   * Create handshake message
   */
  createHandshake(): BlockAnnouncementHandshake {
    if (!this.finalizedBlock) {
      throw new Error('No finalized block set')
    }

    return {
      finalBlockHash: this.finalizedBlock.hash,
      finalBlockSlot: this.finalizedBlock.slot,
      leaves: Array.from(this.knownLeaves.values()),
    }
  }

  /**
   * Process handshake message from peer
   */
  async processHandshake(handshake: BlockAnnouncementHandshake): Promise<void> {
    // Update our finalized block if peer has a newer one
    if (
      !this.finalizedBlock ||
      handshake.finalBlockSlot > this.finalizedBlock.slot
    ) {
      await this.updateFinalizedBlock(
        handshake.finalBlockHash,
        handshake.finalBlockSlot,
      )
    }

    // Add any new leaves from peer
    for (const leaf of handshake.leaves) {
      if (!this.knownLeaves.has(leaf.hash.toString())) {
        await this.addKnownLeaf(leaf.hash, leaf.slot)
      }
    }
  }

  /**
   * Create block announcement message
   */
  createBlockAnnouncement(blockHeader: Bytes): BlockAnnouncement {
    if (!this.finalizedBlock) {
      throw new Error('No finalized block set')
    }

    return {
      header: blockHeader,
      finalBlockHash: this.finalizedBlock.hash,
      finalBlockSlot: this.finalizedBlock.slot,
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
        announcement.finalBlockHash,
        announcement.finalBlockSlot,
      )
    }

    // Process the block header
    await this.processBlockHeader(announcement.header)
  }

  /**
   * Process block header
   */
  private async processBlockHeader(header: Bytes): Promise<void> {
    try {
      // Extract block hash and slot from header
      const blockHashHex = blake2bHash(header)
      const blockHash = Buffer.from(blockHashHex.replace('0x', ''), 'hex')
      const slot = this.extractSlotFromHeader(header)

      // Add as known leaf
      await this.addKnownLeaf(blockHash, slot)

      console.log(
        `Processed block header: hash=${blockHashHex.substring(0, 18)}..., slot=${slot}`,
      )
    } catch (error) {
      console.error('Failed to process block header:', error)
    }
  }

  /**
   * Extract slot number from block header
   */
  private extractSlotFromHeader(header: Bytes): number {
    // This is a simplified implementation
    // In practice, you would parse the actual block header structure
    if (header.length < 8) {
      throw new Error('Block header too short')
    }

    // Assume slot is stored in the first 8 bytes
    const slotBytes = header.slice(0, 8)
    return Number(BigInt(`0x${slotBytes.toString()}`))
  }

  /**
   * Check if we should announce a block to neighbors
   */
  shouldAnnounceBlock(blockHash: Bytes): boolean {
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
  serializeHandshake(handshake: BlockAnnouncementHandshake): Bytes {
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
    view.setUint32(offset, handshake.finalBlockSlot, true)
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
      view.setUint32(offset, leaf.slot, true)
      offset += 4
    }

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize handshake message
   */
  deserializeHandshake(data: Bytes): BlockAnnouncementHandshake {
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
    const leaves: Array<{ hash: Bytes; slot: number }> = []
    for (let i = 0; i < numLeaves; i++) {
      // Read leaf hash (32 bytes)
      const hash = data.slice(offset, offset + 32)
      offset += 32

      // Read leaf slot (4 bytes, little-endian)
      const slot = view.getUint32(offset, true)
      offset += 4

      leaves.push({ hash, slot })
    }

    return {
      finalBlockHash,
      finalBlockSlot,
      leaves,
    }
  }

  /**
   * Serialize block announcement message
   */
  serializeBlockAnnouncement(announcement: BlockAnnouncement): Bytes {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(announcement.header.length + 32 + 4)
    const view = new DataView(buffer)
    let offset = 0

    // Write block header
    new Uint8Array(buffer).set(announcement.header, offset)
    offset += announcement.header.length

    // Write final block hash (32 bytes)
    new Uint8Array(buffer).set(announcement.finalBlockHash, offset)
    offset += 32

    // Write final block slot (4 bytes, little-endian)
    view.setUint32(offset, announcement.finalBlockSlot, true)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize block announcement message
   */
  deserializeBlockAnnouncement(
    data: Bytes,
    headerLength: number,
  ): BlockAnnouncement {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read block header
    const header = data.slice(offset, offset + headerLength)
    offset += headerLength

    // Read final block hash (32 bytes)
    const finalBlockHash = data.slice(offset, offset + 32)
    offset += 32

    // Read final block slot (4 bytes, little-endian)
    const finalBlockSlot = view.getUint32(offset, true)

    return {
      header,
      finalBlockHash,
      finalBlockSlot,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(_stream: StreamInfo, data: Bytes): Promise<void> {
    if (data.length === 0) {
      // Initial handshake
      const _handshake = this.createHandshake()
      // Send handshake response would be handled by the stream manager
      return
    }

    // Try to parse as handshake first
    try {
      const handshake = this.deserializeHandshake(data)
      await this.processHandshake(handshake)
      return
    } catch (_error) {
      // Not a handshake, try as block announcement
    }

    // Try to parse as block announcement
    try {
      // Assume header length is 128 bytes (placeholder)
      const headerLength = 128
      const announcement = this.deserializeBlockAnnouncement(data, headerLength)
      await this.processBlockAnnouncement(announcement)
    } catch (error) {
      console.error('Failed to parse block announcement data:', error)
    }
  }
}
