/**
 * CE 145: Judgment Publication Protocol
 *
 * Implements the judgment publication protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for publishing audit judgments.
 */

import type { NetworkingStore } from '@pbnj/state'
import type { JudgmentPublication, StreamInfo } from '@pbnj/types'

/**
 * Judgment publication protocol handler
 */
export class JudgmentPublicationProtocol {
  private judgments: Map<
    string,
    {
      epochIndex: number
      validatorIndex: number
      validity: 0 | 1
      workReportHash: Uint8Array
      signature: Uint8Array
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
      // Load judgments from database (service ID 14 for judgments)
      console.log(
        'Judgment publication state loading - protocol not yet fully implemented',
      )
    } catch (error) {
      console.error(
        'Failed to load judgment publication state from database:',
        error,
      )
    }
  }

  /**
   * Store judgment in local store and persist to database
   */
  async storeJudgment(
    epochIndex: number,
    validatorIndex: number,
    validity: 0 | 1,
    workReportHash: Uint8Array,
    signature: Uint8Array,
  ): Promise<void> {
    const key = `${epochIndex}_${validatorIndex}_${workReportHash.toString()}`
    this.judgments.set(key, {
      epochIndex,
      validatorIndex,
      validity,
      workReportHash,
      signature,
      timestamp: Date.now(),
    })

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        // Store judgment data
        const judgmentData = {
          epochIndex,
          validatorIndex,
          validity,
          workReportHash: Buffer.from(workReportHash).toString('hex'),
          signature: Buffer.from(signature).toString('hex'),
          timestamp: Date.now(),
        }

        await this.dbIntegration.setServiceStorage(
          `judgment_${key}`,
          Buffer.from(JSON.stringify(judgmentData), 'utf8'),
        )
      } catch (error) {
        console.error('Failed to persist judgment to database:', error)
      }
    }
  }

  /**
   * Get judgment from local store
   */
  getJudgment(
    epochIndex: number,
    validatorIndex: number,
    workReportHash: Uint8Array,
  ):
    | {
        epochIndex: number
        validatorIndex: number
        validity: 0 | 1
        workReportHash: Uint8Array
        signature: Uint8Array
        timestamp: number
      }
    | undefined {
    const key = `${epochIndex}_${validatorIndex}_${workReportHash.toString()}`
    return this.judgments.get(key)
  }

  /**
   * Get judgment from database if not in local store
   */
  async getJudgmentFromDatabase(
    epochIndex: number,
    validatorIndex: number,
    workReportHash: Uint8Array,
  ): Promise<{
    epochIndex: number
    validatorIndex: number
    validity: 0 | 1
    workReportHash: Uint8Array
    signature: Uint8Array
    timestamp: number
  } | null> {
    if (this.getJudgment(epochIndex, validatorIndex, workReportHash)) {
      return (
        this.getJudgment(epochIndex, validatorIndex, workReportHash) || null
      )
    }

    if (!this.dbIntegration) return null

    try {
      const key = `${epochIndex}_${validatorIndex}_${workReportHash.toString()}`
      const judgmentData = await this.dbIntegration.getServiceStorage(
        `judgment_${key}`,
      )

      if (judgmentData) {
        const parsedData = JSON.parse(judgmentData.toString())
        const judgment = {
          epochIndex: parsedData.epochIndex,
          validatorIndex: parsedData.validatorIndex,
          validity: parsedData.validity as 0 | 1,
          workReportHash: Buffer.from(parsedData.workReportHash, 'hex'),
          signature: Buffer.from(parsedData.signature, 'hex'),
          timestamp: parsedData.timestamp,
        }

        // Cache in local store
        this.judgments.set(key, judgment)
        return judgment
      }

      return null
    } catch (error) {
      console.error('Failed to get judgment from database:', error)
      return null
    }
  }

  /**
   * Process judgment publication
   */
  async processJudgmentPublication(
    judgment: JudgmentPublication,
  ): Promise<void> {
    try {
      // Store the judgment
      await this.storeJudgment(
        judgment.epochIndex,
        judgment.validatorIndex,
        judgment.validity,
        judgment.workReportHash,
        judgment.signature,
      )

      console.log(
        `Processed judgment publication for epoch ${judgment.epochIndex}, validator ${judgment.validatorIndex}, validity: ${judgment.validity}`,
      )
    } catch (error) {
      console.error('Failed to process judgment publication:', error)
    }
  }

  /**
   * Create judgment publication message
   */
  createJudgmentPublication(
    epochIndex: number,
    validatorIndex: number,
    validity: 0 | 1,
    workReportHash: Uint8Array,
    signature: Uint8Array,
  ): JudgmentPublication {
    return {
      epochIndex,
      validatorIndex,
      validity,
      workReportHash,
      signature,
    }
  }

  /**
   * Serialize judgment publication message
   */
  serializeJudgmentPublication(judgment: JudgmentPublication): Uint8Array {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(4 + 4 + 1 + 32 + 64) // epochIndex + validatorIndex + validity + workReportHash + signature
    const view = new DataView(buffer)
    let offset = 0

    // Write epoch index (4 bytes, little-endian)
    view.setUint32(offset, judgment.epochIndex, true)
    offset += 4

    // Write validator index (4 bytes, little-endian)
    view.setUint32(offset, judgment.validatorIndex, true)
    offset += 4

    // Write validity (1 byte)
    view.setUint8(offset, judgment.validity)
    offset += 1

    // Write work report hash (32 bytes)
    new Uint8Array(buffer).set(judgment.workReportHash, offset)
    offset += 32

    // Write signature (64 bytes for Ed25519)
    new Uint8Array(buffer).set(judgment.signature, offset)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize judgment publication message
   */
  deserializeJudgmentPublication(data: Uint8Array): JudgmentPublication {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read epoch index (4 bytes, little-endian)
    const epochIndex = view.getUint32(offset, true)
    offset += 4

    // Read validator index (4 bytes, little-endian)
    const validatorIndex = view.getUint32(offset, true)
    offset += 4

    // Read validity (1 byte)
    const validity = view.getUint8(offset) as 0 | 1
    offset += 1

    // Read work report hash (32 bytes)
    const workReportHash = data.slice(offset, offset + 32)
    offset += 32

    // Read signature (64 bytes for Ed25519)
    const signature = data.slice(offset, offset + 64)

    return {
      epochIndex,
      validatorIndex,
      validity,
      workReportHash,
      signature,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(_stream: StreamInfo, data: Uint8Array): Promise<void> {
    try {
      const judgment = this.deserializeJudgmentPublication(data)
      await this.processJudgmentPublication(judgment)
    } catch (error) {
      console.error('Failed to handle judgment publication stream data:', error)
    }
  }
}
