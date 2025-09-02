/**
 * CE 135: Work Report Distribution Protocol
 *
 * Implements the work report distribution protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for distributing guaranteed work reports.
 */

import type { NetworkingStore } from '@pbnj/state'
import type { GuaranteedWorkReport, StreamInfo } from '@pbnj/types'

/**
 * Work report distribution protocol handler
 */
export class WorkReportDistributionProtocol {
  private workReports: Map<
    string,
    {
      workReport: Uint8Array
      slot: number
      signatures: Array<{ validatorIndex: number; signature: Uint8Array }>
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
      // Load work reports from database (service ID 6 for work reports)
      console.log(
        'Work report distribution state loading - protocol not yet fully implemented',
      )
    } catch (error) {
      console.error('Failed to load work report state from database:', error)
    }
  }

  /**
   * Store work report in local store and persist to database
   */
  async storeWorkReport(
    workReportHash: Uint8Array,
    workReport: Uint8Array,
    slot: number,
    signatures: Array<{ validatorIndex: number; signature: Uint8Array }>,
  ): Promise<void> {
    const hashString = workReportHash.toString()
    this.workReports.set(hashString, { workReport, slot, signatures })

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          `work_report_${hashString}`,
          workReport,
        )

        // Store metadata
        const metadata = {
          slot,
          signatures: signatures.map((sig) => ({
            validatorIndex: sig.validatorIndex,
            signature: Buffer.from(sig.signature).toString('hex'),
          })),
          timestamp: Date.now(),
          hash: Buffer.from(workReportHash).toString('hex'),
        }

        await this.dbIntegration.setServiceStorage(
          `work_report_meta_${hashString}`,
          Buffer.from(JSON.stringify(metadata), 'utf8'),
        )
      } catch (error) {
        console.error('Failed to persist work report to database:', error)
      }
    }
  }

  /**
   * Get work report from local store
   */
  getWorkReport(workReportHash: Uint8Array):
    | {
        workReport: Uint8Array
        slot: number
        signatures: Array<{ validatorIndex: number; signature: Uint8Array }>
      }
    | undefined {
    return this.workReports.get(workReportHash.toString())
  }

  /**
   * Get work report from database if not in local store
   */
  async getWorkReportFromDatabase(workReportHash: Uint8Array): Promise<{
    workReport: Uint8Array
    slot: number
    signatures: Array<{ validatorIndex: number; signature: Uint8Array }>
  } | null> {
    if (this.getWorkReport(workReportHash)) {
      return this.getWorkReport(workReportHash) || null
    }

    if (!this.dbIntegration) return null

    try {
      const hashString = workReportHash.toString()
      const workReportData = await this.dbIntegration.getServiceStorage(
        `work_report_${hashString}`,
      )

      if (workReportData) {
        // Get metadata
        const metadataData = await this.dbIntegration.getServiceStorage(
          `work_report_meta_${hashString}`,
        )

        let slot = 0
        let signatures: Array<{
          validatorIndex: number
          signature: Uint8Array
        }> = []

        if (metadataData) {
          try {
            const metadata = JSON.parse(metadataData.toString())
            slot = metadata.slot
            signatures = metadata.signatures.map(
              (sig: { validatorIndex: number; signature: string }) => ({
                validatorIndex: sig.validatorIndex,
                signature: Buffer.from(sig.signature, 'hex'),
              }),
            )
          } catch (error) {
            console.error('Failed to parse work report metadata:', error)
          }
        }

        // Cache in local store
        this.workReports.set(hashString, {
          workReport: workReportData,
          slot,
          signatures,
        })
        return { workReport: workReportData, slot, signatures }
      }

      return null
    } catch (error) {
      console.error('Failed to get work report from database:', error)
      return null
    }
  }

  /**
   * Process work report distribution
   */
  async processWorkReportDistribution(
    report: GuaranteedWorkReport,
  ): Promise<void> {
    try {
      // Calculate work report hash (placeholder - in practice this would be calculated)
      const workReportHash = Buffer.from('placeholder_work_report_hash')

      // Store the work report
      await this.storeWorkReport(
        workReportHash,
        report.workReport,
        report.slot,
        report.signatures,
      )

      console.log(
        `Processed work report distribution for slot ${report.slot} with ${report.signatures.length} signatures`,
      )
    } catch (error) {
      console.error('Failed to process work report distribution:', error)
    }
  }

  /**
   * Create work report distribution message
   */
  createWorkReportDistribution(
    workReport: Uint8Array,
    slot: number,
    signatures: Array<{ validatorIndex: number; signature: Uint8Array }>,
  ): GuaranteedWorkReport {
    return {
      workReport,
      slot,
      signatures,
    }
  }

  /**
   * Serialize work report distribution message
   */
  serializeWorkReportDistribution(report: GuaranteedWorkReport): Uint8Array {
    // Calculate total size
    let totalSize = 4 + 4 // slot + number of signatures

    // Size for signatures
    for (const _signature of report.signatures) {
      totalSize += 4 + 64 // validatorIndex + signature (64 bytes for Ed25519)
    }

    // Size for work report
    totalSize += 4 + report.workReport.length // work report length + work report data

    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)
    let offset = 0

    // Write slot (4 bytes, little-endian)
    view.setUint32(offset, report.slot, true)
    offset += 4

    // Write number of signatures (4 bytes, little-endian)
    view.setUint32(offset, report.signatures.length, true)
    offset += 4

    // Write signatures
    for (const signature of report.signatures) {
      // Write validator index (4 bytes, little-endian)
      view.setUint32(offset, signature.validatorIndex, true)
      offset += 4

      // Write signature (64 bytes for Ed25519)
      new Uint8Array(buffer).set(signature.signature, offset)
      offset += 64
    }

    // Write work report length (4 bytes, little-endian)
    view.setUint32(offset, report.workReport.length, true)
    offset += 4

    // Write work report data
    new Uint8Array(buffer).set(report.workReport, offset)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize work report distribution message
   */
  deserializeWorkReportDistribution(data: Uint8Array): GuaranteedWorkReport {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read slot (4 bytes, little-endian)
    const slot = view.getUint32(offset, true)
    offset += 4

    // Read number of signatures (4 bytes, little-endian)
    const numSignatures = view.getUint32(offset, true)
    offset += 4

    // Read signatures
    const signatures: Array<{ validatorIndex: number; signature: Uint8Array }> =
      []
    for (let i = 0; i < numSignatures; i++) {
      // Read validator index (4 bytes, little-endian)
      const validatorIndex = view.getUint32(offset, true)
      offset += 4

      // Read signature (64 bytes for Ed25519)
      const signature = data.slice(offset, offset + 64)
      offset += 64

      signatures.push({ validatorIndex, signature })
    }

    // Read work report length (4 bytes, little-endian)
    const workReportLength = view.getUint32(offset, true)
    offset += 4

    // Read work report data
    const workReport = data.slice(offset, offset + workReportLength)

    return {
      workReport,
      slot,
      signatures,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(_stream: StreamInfo, data: Uint8Array): Promise<void> {
    try {
      const report = this.deserializeWorkReportDistribution(data)
      await this.processWorkReportDistribution(report)
    } catch (error) {
      console.error(
        'Failed to handle work report distribution stream data:',
        error,
      )
    }
  }
}
