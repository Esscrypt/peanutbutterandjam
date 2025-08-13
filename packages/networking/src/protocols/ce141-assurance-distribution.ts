/**
 * CE 141: Assurance Distribution Protocol
 *
 * Implements the assurance distribution protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for distributing availability assurances.
 */

import type { AssuranceDistribution, Bytes, StreamInfo } from '@pbnj/types'
import type { NetworkingDatabaseIntegration } from '../db-integration'

/**
 * Assurance distribution protocol handler
 */
export class AssuranceDistributionProtocol {
  private assurances: Map<
    string,
    { anchorHash: Bytes; bitfield: Bytes; signature: Bytes; timestamp: number }
  > = new Map()
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
      // Load assurances from database (service ID 10 for assurances)
      console.log(
        'Assurance distribution state loading - protocol not yet fully implemented',
      )
    } catch (error) {
      console.error(
        'Failed to load assurance distribution state from database:',
        error,
      )
    }
  }

  /**
   * Store assurance in local store and persist to database
   */
  async storeAssurance(
    anchorHash: Bytes,
    bitfield: Bytes,
    signature: Bytes,
  ): Promise<void> {
    const hashString = anchorHash.toString()
    this.assurances.set(hashString, {
      anchorHash,
      bitfield,
      signature,
      timestamp: Date.now(),
    })

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        // Store assurance data
        const assuranceData = {
          anchorHash: Buffer.from(anchorHash).toString('hex'),
          bitfield: Buffer.from(bitfield).toString('hex'),
          signature: Buffer.from(signature).toString('hex'),
          timestamp: Date.now(),
        }

        await this.dbIntegration.setServiceStorage(
          `assurance_${hashString}`,
          Buffer.from(JSON.stringify(assuranceData), 'utf8'),
        )
      } catch (error) {
        console.error('Failed to persist assurance to database:', error)
      }
    }
  }

  /**
   * Get assurance from local store
   */
  getAssurance(anchorHash: Bytes):
    | {
        anchorHash: Bytes
        bitfield: Bytes
        signature: Bytes
        timestamp: number
      }
    | undefined {
    return this.assurances.get(anchorHash.toString())
  }

  /**
   * Get assurance from database if not in local store
   */
  async getAssuranceFromDatabase(anchorHash: Bytes): Promise<{
    anchorHash: Bytes
    bitfield: Bytes
    signature: Bytes
    timestamp: number
  } | null> {
    if (this.getAssurance(anchorHash)) {
      return this.getAssurance(anchorHash) || null
    }

    if (!this.dbIntegration) return null

    try {
      const hashString = anchorHash.toString()
      const assuranceData = await this.dbIntegration.getServiceStorage(
        `assurance_${hashString}`,
      )

      if (assuranceData) {
        const parsedData = JSON.parse(assuranceData.toString())
        const assurance = {
          anchorHash: Buffer.from(parsedData.anchorHash, 'hex'),
          bitfield: Buffer.from(parsedData.bitfield, 'hex'),
          signature: Buffer.from(parsedData.signature, 'hex'),
          timestamp: parsedData.timestamp,
        }

        // Cache in local store
        this.assurances.set(hashString, assurance)
        return assurance
      }

      return null
    } catch (error) {
      console.error('Failed to get assurance from database:', error)
      return null
    }
  }

  /**
   * Process assurance distribution
   */
  async processAssuranceDistribution(
    assurance: AssuranceDistribution,
  ): Promise<void> {
    try {
      // Store the assurance
      await this.storeAssurance(
        assurance.anchorHash,
        assurance.bitfield,
        assurance.signature,
      )

      console.log(
        `Processed assurance distribution for anchor hash: ${assurance.anchorHash.toString().substring(0, 16)}...`,
      )
    } catch (error) {
      console.error('Failed to process assurance distribution:', error)
    }
  }

  /**
   * Create assurance distribution message
   */
  createAssuranceDistribution(
    anchorHash: Bytes,
    bitfield: Bytes,
    signature: Bytes,
  ): AssuranceDistribution {
    return {
      anchorHash,
      bitfield,
      signature,
    }
  }

  /**
   * Serialize assurance distribution message
   */
  serializeAssuranceDistribution(assurance: AssuranceDistribution): Bytes {
    // Calculate total size
    const totalSize = 32 + 4 + assurance.bitfield.length + 64 // anchorHash + bitfield length + bitfield + signature (64 bytes for Ed25519)

    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)
    let offset = 0

    // Write anchor hash (32 bytes)
    new Uint8Array(buffer).set(assurance.anchorHash, offset)
    offset += 32

    // Write bitfield length (4 bytes, little-endian)
    view.setUint32(offset, assurance.bitfield.length, true)
    offset += 4

    // Write bitfield data
    new Uint8Array(buffer).set(assurance.bitfield, offset)
    offset += assurance.bitfield.length

    // Write signature (64 bytes for Ed25519)
    new Uint8Array(buffer).set(assurance.signature, offset)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize assurance distribution message
   */
  deserializeAssuranceDistribution(data: Bytes): AssuranceDistribution {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read anchor hash (32 bytes)
    const anchorHash = data.slice(offset, offset + 32)
    offset += 32

    // Read bitfield length (4 bytes, little-endian)
    const bitfieldLength = view.getUint32(offset, true)
    offset += 4

    // Read bitfield data
    const bitfield = data.slice(offset, offset + bitfieldLength)
    offset += bitfieldLength

    // Read signature (64 bytes for Ed25519)
    const signature = data.slice(offset, offset + 64)

    return {
      anchorHash,
      bitfield,
      signature,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(_stream: StreamInfo, data: Bytes): Promise<void> {
    try {
      const assurance = this.deserializeAssuranceDistribution(data)
      await this.processAssuranceDistribution(assurance)
    } catch (error) {
      console.error(
        'Failed to handle assurance distribution stream data:',
        error,
      )
    }
  }
}
