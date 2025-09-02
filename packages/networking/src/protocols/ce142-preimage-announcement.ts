/**
 * CE 142: Preimage Announcement Protocol
 *
 * Implements the preimage announcement protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for announcing possession of preimages.
 */

import type { NetworkingStore } from '@pbnj/state'
import type { PreimageAnnouncement, StreamInfo } from '@pbnj/types'

/**
 * Preimage announcement protocol handler
 */
export class PreimageAnnouncementProtocol {
  private preimageAnnouncements: Map<
    string,
    {
      serviceId: number
      hash: Uint8Array
      preimageLength: number
      timestamp: number
    }
  > = new Map()
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
      // Load preimage announcements from database (service ID 11 for preimage announcements)
      console.log(
        'Preimage announcement state loading - protocol not yet fully implemented',
      )
    } catch (error) {
      console.error(
        'Failed to load preimage announcement state from database:',
        error,
      )
    }
  }

  /**
   * Store preimage announcement in local store and persist to database
   */
  async storePreimageAnnouncement(
    serviceId: number,
    hash: Uint8Array,
    preimageLength: number,
  ): Promise<void> {
    const hashString = hash.toString()
    this.preimageAnnouncements.set(hashString, {
      serviceId,
      hash,
      preimageLength,
      timestamp: Date.now(),
    })

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        // Store preimage announcement data
        const announcementData = {
          serviceId,
          hash: Buffer.from(hash).toString('hex'),
          preimageLength,
          timestamp: Date.now(),
        }

        await this.dbIntegration.setServiceStorage(
          `preimage_announcement_${hashString}`,
          Buffer.from(JSON.stringify(announcementData), 'utf8'),
        )
      } catch (error) {
        console.error(
          'Failed to persist preimage announcement to database:',
          error,
        )
      }
    }
  }

  /**
   * Get preimage announcement from local store
   */
  getPreimageAnnouncement(hash: Uint8Array):
    | {
        serviceId: number
        hash: Uint8Array
        preimageLength: number
        timestamp: number
      }
    | undefined {
    return this.preimageAnnouncements.get(hash.toString())
  }

  /**
   * Get preimage announcement from database if not in local store
   */
  async getPreimageAnnouncementFromDatabase(hash: Uint8Array): Promise<{
    serviceId: number
    hash: Uint8Array
    preimageLength: number
    timestamp: number
  } | null> {
    if (this.getPreimageAnnouncement(hash)) {
      return this.getPreimageAnnouncement(hash) || null
    }

    if (!this.dbIntegration) return null

    try {
      const hashString = hash.toString()
      const announcementData = await this.dbIntegration.getServiceStorage(
        `preimage_announcement_${hashString}`,
      )

      if (announcementData) {
        const parsedData = JSON.parse(announcementData.toString())
        const announcement = {
          serviceId: parsedData.serviceId,
          hash: Buffer.from(parsedData.hash, 'hex'),
          preimageLength: parsedData.preimageLength,
          timestamp: parsedData.timestamp,
        }

        // Cache in local store
        this.preimageAnnouncements.set(hashString, announcement)
        return announcement
      }

      return null
    } catch (error) {
      console.error('Failed to get preimage announcement from database:', error)
      return null
    }
  }

  /**
   * Process preimage announcement
   */
  async processPreimageAnnouncement(
    announcement: PreimageAnnouncement,
  ): Promise<void> {
    try {
      // Store the preimage announcement
      await this.storePreimageAnnouncement(
        announcement.serviceId,
        announcement.hash,
        announcement.preimageLength,
      )

      console.log(
        `Processed preimage announcement for service ${announcement.serviceId}, hash: ${announcement.hash.toString().substring(0, 16)}...`,
      )
    } catch (error) {
      console.error('Failed to process preimage announcement:', error)
    }
  }

  /**
   * Create preimage announcement message
   */
  createPreimageAnnouncement(
    serviceId: number,
    hash: Uint8Array,
    preimageLength: number,
  ): PreimageAnnouncement {
    return {
      serviceId,
      hash,
      preimageLength,
    }
  }

  /**
   * Serialize preimage announcement message
   */
  serializePreimageAnnouncement(
    announcement: PreimageAnnouncement,
  ): Uint8Array {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(4 + 32 + 4) // serviceId + hash + preimageLength
    const view = new DataView(buffer)
    let offset = 0

    // Write service ID (4 bytes, little-endian)
    view.setUint32(offset, announcement.serviceId, true)
    offset += 4

    // Write hash (32 bytes)
    new Uint8Array(buffer).set(announcement.hash, offset)
    offset += 32

    // Write preimage length (4 bytes, little-endian)
    view.setUint32(offset, announcement.preimageLength, true)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize preimage announcement message
   */
  deserializePreimageAnnouncement(data: Uint8Array): PreimageAnnouncement {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read service ID (4 bytes, little-endian)
    const serviceId = view.getUint32(offset, true)
    offset += 4

    // Read hash (32 bytes)
    const hash = data.slice(offset, offset + 32)
    offset += 32

    // Read preimage length (4 bytes, little-endian)
    const preimageLength = view.getUint32(offset, true)

    return {
      serviceId,
      hash,
      preimageLength,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(_stream: StreamInfo, data: Uint8Array): Promise<void> {
    try {
      const announcement = this.deserializePreimageAnnouncement(data)
      await this.processPreimageAnnouncement(announcement)
    } catch (error) {
      console.error(
        'Failed to handle preimage announcement stream data:',
        error,
      )
    }
  }
}
