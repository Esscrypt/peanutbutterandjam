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
import { blake2bHash, logger } from '@pbnj/core'
import type { NetworkingStore } from '@pbnj/state'
import type {
  BlockAnnouncement,
  BlockAnnouncementHandshake,
  StreamInfo,
  ValidatorGrid,
  ValidatorIndex,
  ValidatorMetadata,
} from '@pbnj/types'
import type { ConnectionManager } from '../peer/connection-manager'
import type { ValidatorSetManager } from '../peer/validator-set'
import type { QuicStreamManager } from '../quic/stream'

/**
 * Block announcement protocol handler
 */
export class BlockAnnouncementProtocol {
  private knownLeaves: Map<string, { hash: Uint8Array; slot: number }> =
    new Map()
  private finalizedBlock: { hash: Uint8Array; slot: number } | null = null
  private grid: ValidatorGrid | null = null
  private dbIntegration: NetworkingStore

  // JIP-5 integration components
  private streamManager: QuicStreamManager
  private connectionManager: ConnectionManager
  private validatorSetManager: ValidatorSetManager
  private localValidatorIndex: ValidatorIndex | null = null

  // Active UP0 streams to neighbors
  private activeStreams: Map<ValidatorIndex, string> = new Map()
  private isStarted = false

  constructor(
    dbIntegration: NetworkingStore,
    streamManager: QuicStreamManager,
    connectionManager: ConnectionManager,
    validatorSetManager: ValidatorSetManager,
  ) {
    this.dbIntegration = dbIntegration
    this.streamManager = streamManager
    this.connectionManager = connectionManager
    this.validatorSetManager = validatorSetManager

    if (!this.dbIntegration) {
      throw new Error('Database integration is required')
    }

    if (!this.streamManager) {
      throw new Error('Stream manager is required')
    }

    if (!this.connectionManager) {
      throw new Error('Connection manager is required')
    }

    if (!this.validatorSetManager) {
      throw new Error('Validator set manager is required')
    }
  }

  /**
   * Set database integration for persistent state
   */
  setDatabaseIntegration(dbIntegration: NetworkingStore): void {
    this.dbIntegration = dbIntegration
  }

  /**
   * Set local validator index
   */
  setLocalValidator(validatorIndex: ValidatorIndex): void {
    this.localValidatorIndex = validatorIndex
  }

  /**
   * Set networking components for JIP-5 integration
   */
  setNetworkingComponents(
    streamManager: QuicStreamManager,
    connectionManager: ConnectionManager,
    validatorSetManager: ValidatorSetManager,
  ): void {
    this.streamManager = streamManager
    this.connectionManager = connectionManager
    this.validatorSetManager = validatorSetManager
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
      for (const [key, leaf] of knownLeaves) {
        this.knownLeaves.set(key, leaf)
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
  setValidatorGrid(
    grid: ValidatorGrid,
    _validators: ValidatorMetadata[],
  ): void {
    this.grid = grid
    // TODO: Implement validator management
    // this._validators = validators
  }

  /**
   * Update finalized block
   */
  async updateFinalizedBlock(hash: Uint8Array, slot: number): Promise<void> {
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
  async addKnownLeaf(hash: Uint8Array, slot: number): Promise<void> {
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
  async removeKnownLeaf(hash: Uint8Array): Promise<void> {
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
  createBlockAnnouncement(blockHeader: Uint8Array): BlockAnnouncement {
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
  private async processBlockHeader(header: Uint8Array): Promise<void> {
    try {
      // Extract block hash and slot from header
      const [blockHashHexError, blockHashHex] = blake2bHash(header)
      if (blockHashHexError) {
        throw blockHashHexError
      }
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
  private extractSlotFromHeader(header: Uint8Array): number {
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
  serializeHandshake(handshake: BlockAnnouncementHandshake): Uint8Array {
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
    const leaves: Array<{ hash: Uint8Array; slot: number }> = []
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
  serializeBlockAnnouncement(announcement: BlockAnnouncement): Uint8Array {
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
    data: Uint8Array,
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
  async handleStreamData(_stream: StreamInfo, data: Uint8Array): Promise<void> {
    if (data.length === 0) {
      // Initial handshake
      // const _handshake = this.createHandshake()
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

  /**
   * Start block announcement protocol
   * JIP-5 compliant startup method
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.info('Block announcement protocol already started')
      return
    }

    logger.info('Starting block announcement protocol for JIP-5 compliance')

    if (
      !this.streamManager ||
      !this.connectionManager ||
      !this.validatorSetManager
    ) {
      logger.warn(
        'Missing required networking components for block announcement protocol',
        {
          streamManager: !!this.streamManager,
          connectionManager: !!this.connectionManager,
          validatorSetManager: !!this.validatorSetManager,
        },
      )
      return
    }

    try {
      // Load persistent state
      await this.loadState()

      // Get neighboring validators from grid structure
      const neighbors = await this.getNeighboringValidators()
      logger.info(
        `Found ${neighbors.length} neighboring validators for UP0 streams`,
        {
          neighborCount: neighbors.length,
          neighbors: neighbors.map((n) => n.index),
        },
      )

      // Initialize UP0 streams to all neighbors
      for (const neighbor of neighbors) {
        await this.initializeStreamToValidator(neighbor)
      }

      this.isStarted = true
      logger.info('Block announcement protocol started successfully', {
        activeStreams: this.activeStreams.size,
        localValidator: this.localValidatorIndex,
      })
    } catch (error) {
      logger.error('Failed to start block announcement protocol', { error })
      throw error
    }
  }

  /**
   * Get neighboring validators from grid structure
   */
  private async getNeighboringValidators(): Promise<ValidatorMetadata[]> {
    if (!this.validatorSetManager || this.localValidatorIndex === null) {
      return []
    }

    // Get current validators
    const currentValidators = this.validatorSetManager.getCurrentValidators()

    // For now, treat all other validators as neighbors
    // In a full implementation, this would use grid structure to find actual neighbors
    const neighbors: ValidatorMetadata[] = []
    for (const [index, validator] of currentValidators) {
      if (index !== this.localValidatorIndex) {
        neighbors.push(validator)
      }
    }

    return neighbors
  }

  /**
   * Initialize UP0 stream to a specific validator
   */
  private async initializeStreamToValidator(
    validator: ValidatorMetadata,
  ): Promise<void> {
    if (!this.streamManager || !this.connectionManager) {
      throw new Error('Missing required networking components')
    }

    try {
      // Check if we already have a stream to this validator
      if (this.activeStreams.has(validator.index)) {
        logger.info(`UP0 stream to validator ${validator.index} already exists`)
        return
      }

      // Get or create connection to validator
      await this.connectionManager.connectToPeer(validator.endpoint)

      // Create UP0 stream (stream kind 0 for block announcement)
      const streamId = `up0-block-announcement-${validator.index}`

      // Register stream with connection
      console.log(
        `Initializing UP0 stream to validator ${validator.index} at ${validator.endpoint.host}:${validator.endpoint.port}`,
      )

      // Store active stream
      this.activeStreams.set(validator.index, streamId)

      // Send handshake
      await this.sendHandshake(streamId, validator.index)
    } catch (error) {
      console.error(
        `Failed to initialize stream to validator ${validator.index}:`,
        error,
      )
    }
  }

  /**
   * Send UP0 handshake to establish block announcement stream
   */
  private async sendHandshake(
    streamId: string,
    validatorIndex: ValidatorIndex,
  ): Promise<void> {
    if (!this.streamManager || this.localValidatorIndex === null) {
      throw new Error('Missing required components for handshake')
    }

    const handshake: BlockAnnouncementHandshake = {
      finalBlockHash: new Uint8Array(32), // Placeholder for finalized block hash
      finalBlockSlot: 0, // Placeholder for finalized block slot
      leaves: [], // Placeholder for known leaves
    }

    try {
      // Serialize handshake message
      const handshakeData = this.serializeHandshake(handshake)

      // Send via QUIC stream with proper JAMNP-S framing
      await this.streamManager.sendMessage(streamId, handshakeData)

      console.log(
        `✅ UP0 handshake sent to validator ${validatorIndex} via stream ${streamId}`,
      )
    } catch (error) {
      console.error(
        `❌ Failed to send UP0 handshake to validator ${validatorIndex}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Stop block announcement protocol
   * JIP-5 compliant shutdown method
   */
  async stop(): Promise<void> {
    console.log('Stopping block announcement protocol')

    try {
      // Close all active streams
      for (const [validatorIndex, _streamId] of this.activeStreams) {
        console.log(`Closing UP0 stream to validator ${validatorIndex}`)
        // TODO: Send stream close message
        // if (this.streamManager) {
        //   await this.streamManager.closeStream(streamId)
        // }
      }

      this.activeStreams.clear()
      this.isStarted = false
      console.log('Block announcement protocol stopped successfully')
    } catch (error) {
      console.error('Error stopping block announcement protocol:', error)
    }
  }

  /**
   * Announce a block to connected peers
   * JIP-5 compliant block announcement method
   */
  async announceBlock(blockData: {
    slot: number
    validatorIndex: number
    sequenceNumber: number
    headerData: Uint8Array
  }): Promise<void> {
    if (!this.isStarted) {
      console.warn(
        'Block announcement protocol not started - cannot announce block',
      )
      return
    }

    console.log('Announcing block via JIP-5 protocol', {
      slot: blockData.slot,
      validatorIndex: blockData.validatorIndex,
      sequenceNumber: blockData.sequenceNumber,
      headerSize: blockData.headerData.length,
    })

    // Create block announcement message
    const announcement: BlockAnnouncement = {
      header: blockData.headerData,
      finalBlockHash: new Uint8Array(32), // Placeholder for finalized block hash
      finalBlockSlot: 0, // Placeholder for finalized block slot
    }

    // Serialize announcement
    const announcementData = this.serializeBlockAnnouncement(announcement)

    // Send to all active streams
    let successCount = 0
    for (const [validatorIndex, streamId] of this.activeStreams) {
      try {
        await this.sendAnnouncementToStream(
          streamId,
          validatorIndex,
          announcementData,
        )
        successCount++
      } catch (error) {
        console.error(
          `Failed to send announcement to validator ${validatorIndex}:`,
          error,
        )
      }
    }

    console.log(
      `Block announcement sent successfully to ${successCount}/${this.activeStreams.size} neighbors`,
    )
  }

  /**
   * Send announcement data to a specific stream
   */
  private async sendAnnouncementToStream(
    streamId: string,
    validatorIndex: ValidatorIndex,
    data: Uint8Array,
  ): Promise<void> {
    if (!this.streamManager) {
      console.error(
        `Stream manager not available for announcement to validator ${validatorIndex}`,
      )
      return
    }

    try {
      // Send announcement via QUIC stream with proper JAMNP-S framing
      await this.streamManager.sendMessage(streamId, data)

      console.log(
        `✅ Block announcement sent to validator ${validatorIndex} via stream ${streamId} (${data.length} bytes)`,
      )
    } catch (error) {
      console.error(
        `❌ Failed to send block announcement to validator ${validatorIndex}:`,
        error,
      )
      throw error
    }
  }
}
