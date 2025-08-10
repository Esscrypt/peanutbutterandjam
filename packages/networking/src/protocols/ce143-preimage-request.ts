/**
 * CE 143: Preimage Request Protocol
 *
 * Implements the preimage request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting preimages.
 */

import type {
  Bytes,
  PreimageRequest,
  PreimageResponse,
  StreamInfo,
} from '@pbnj/types'
import type { NetworkingDatabaseIntegration } from '../db-integration'

/**
 * Preimage request protocol handler
 */
export class PreimageRequestProtocol {
  private preimages: Map<string, Bytes> = new Map()
  private dbIntegration: NetworkingDatabaseIntegration | null = null

  constructor(dbIntegration?: NetworkingDatabaseIntegration) {
    this.dbIntegration = dbIntegration || null
  }

  /**
   * Set database integration for persistent storage
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
      // Load preimages from database (service ID 12 for preimages)
      console.log(
        'Preimage request state loading - protocol not yet fully implemented',
      )
    } catch (error) {
      console.error(
        'Failed to load preimage request state from database:',
        error,
      )
    }
  }

  /**
   * Store preimage in local store and persist to database
   */
  async storePreimage(hash: Bytes, preimage: Bytes): Promise<void> {
    const hashString = hash.toString()
    this.preimages.set(hashString, preimage)

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          12, // Service ID 12 for preimages
          Buffer.from(`preimage_${hashString}`),
          preimage,
        )
      } catch (error) {
        console.error('Failed to persist preimage to database:', error)
      }
    }
  }

  /**
   * Get preimage from local store
   */
  getPreimage(hash: Bytes): Bytes | undefined {
    return this.preimages.get(hash.toString())
  }

  /**
   * Get preimage from database if not in local store
   */
  async getPreimageFromDatabase(hash: Bytes): Promise<Bytes | null> {
    if (this.getPreimage(hash)) {
      return this.getPreimage(hash) || null
    }

    if (!this.dbIntegration) return null

    try {
      const hashString = hash.toString()
      const preimage = await this.dbIntegration.getServiceStorage(
        12,
        Buffer.from(`preimage_${hashString}`),
      )

      if (preimage) {
        // Cache in local store
        this.preimages.set(hashString, preimage)
        return preimage
      }

      return null
    } catch (error) {
      console.error('Failed to get preimage from database:', error)
      return null
    }
  }

  /**
   * Process preimage request and generate response
   */
  async processPreimageRequest(
    request: PreimageRequest,
  ): Promise<PreimageResponse | null> {
    try {
      // Get preimage from local store or database
      const preimage = await this.getPreimageFromDatabase(request.hash)

      if (!preimage) {
        console.log(
          `Preimage not found for hash: ${request.hash.toString().substring(0, 16)}...`,
        )
        return null
      }

      console.log(
        `Found preimage for hash: ${request.hash.toString().substring(0, 16)}...`,
      )

      return {
        preimage,
      }
    } catch (error) {
      console.error('Failed to process preimage request:', error)
      return null
    }
  }

  /**
   * Create preimage request message
   */
  createPreimageRequest(hash: Bytes): PreimageRequest {
    return {
      hash,
    }
  }

  /**
   * Serialize preimage request message
   */
  serializePreimageRequest(request: PreimageRequest): Bytes {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(32) // hash (32 bytes)
    const _view = new DataView(buffer)

    // Write hash (32 bytes)
    new Uint8Array(buffer).set(request.hash, 0)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize preimage request message
   */
  deserializePreimageRequest(data: Bytes): PreimageRequest {
    // Read hash (32 bytes)
    const hash = data.slice(0, 32)

    return {
      hash,
    }
  }

  /**
   * Serialize preimage response message
   */
  serializePreimageResponse(response: PreimageResponse): Bytes {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(4 + response.preimage.length)
    const view = new DataView(buffer)
    let offset = 0

    // Write preimage length (4 bytes, little-endian)
    view.setUint32(offset, response.preimage.length, true)
    offset += 4

    // Write preimage data
    new Uint8Array(buffer).set(response.preimage, offset)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize preimage response message
   */
  deserializePreimageResponse(data: Bytes): PreimageResponse {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read preimage length (4 bytes, little-endian)
    const preimageLength = view.getUint32(offset, true)
    offset += 4

    // Read preimage data
    const preimage = data.slice(offset, offset + preimageLength)

    return {
      preimage,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(
    _stream: StreamInfo,
    data: Bytes,
  ): Promise<PreimageResponse | null> {
    try {
      const request = this.deserializePreimageRequest(data)
      return await this.processPreimageRequest(request)
    } catch (error) {
      console.error('Failed to handle preimage request stream data:', error)
      return null
    }
  }
}
