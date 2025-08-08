/**
 * CE 136: Work Report Request Protocol
 *
 * Implements the work report request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting missing work reports.
 */

import type { 
  Bytes, 
  WorkReportRequest,
  WorkReportResponse,
  StreamInfo
} from '@pbnj/types'
import type { NetworkingDatabaseIntegration } from '../db-integration'

/**
 * Work report request protocol handler
 */
export class WorkReportRequestProtocol {
  private workReports: Map<string, Bytes> = new Map()
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
      // Load work reports from database (service ID 6 for work reports)
      console.log('Work report request state loading - protocol not yet fully implemented')
    } catch (error) {
      console.error('Failed to load work report request state from database:', error)
    }
  }

  /**
   * Store work report in local store and persist to database
   */
  async storeWorkReport(workReportHash: Bytes, workReport: Bytes): Promise<void> {
    const hashString = workReportHash.toString()
    this.workReports.set(hashString, workReport)
    
    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          6, // Service ID 6 for work reports
          Buffer.from(`work_report_${hashString}`),
          workReport
        )
      } catch (error) {
        console.error('Failed to persist work report to database:', error)
      }
    }
  }

  /**
   * Get work report from local store
   */
  getWorkReport(workReportHash: Bytes): Bytes | undefined {
    return this.workReports.get(workReportHash.toString())
  }

  /**
   * Get work report from database if not in local store
   */
  async getWorkReportFromDatabase(workReportHash: Bytes): Promise<Bytes | null> {
    if (this.getWorkReport(workReportHash)) {
      return this.getWorkReport(workReportHash) || null
    }

    if (!this.dbIntegration) return null

    try {
      const hashString = workReportHash.toString()
      const workReportData = await this.dbIntegration.getServiceStorage(
        6,
        Buffer.from(`work_report_${hashString}`)
      )
      
      if (workReportData) {
        // Cache in local store
        this.workReports.set(hashString, workReportData)
        return workReportData
      }
      
      return null
    } catch (error) {
      console.error('Failed to get work report from database:', error)
      return null
    }
  }

  /**
   * Process work report request and generate response
   */
  async processWorkReportRequest(request: WorkReportRequest): Promise<WorkReportResponse | null> {
    try {
      // Get work report from local store or database
      const workReport = await this.getWorkReportFromDatabase(request.workReportHash)
      
      if (!workReport) {
        console.log(`Work report not found for hash: ${request.workReportHash.toString().substring(0, 16)}...`)
        return null
      }

      console.log(`Found work report for hash: ${request.workReportHash.toString().substring(0, 16)}...`)

      return {
        workReport
      }
    } catch (error) {
      console.error('Failed to process work report request:', error)
      return null
    }
  }

  /**
   * Create work report request message
   */
  createWorkReportRequest(workReportHash: Bytes): WorkReportRequest {
    return {
      workReportHash
    }
  }

  /**
   * Serialize work report request message
   */
  serializeWorkReportRequest(request: WorkReportRequest): Bytes {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(32) // workReportHash (32 bytes)
    const view = new DataView(buffer)

    // Write work report hash (32 bytes)
    new Uint8Array(buffer).set(request.workReportHash, 0)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize work report request message
   */
  deserializeWorkReportRequest(data: Bytes): WorkReportRequest {
    // Read work report hash (32 bytes)
    const workReportHash = data.slice(0, 32)

    return {
      workReportHash
    }
  }

  /**
   * Serialize work report response message
   */
  serializeWorkReportResponse(response: WorkReportResponse): Bytes {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(4 + response.workReport.length)
    const view = new DataView(buffer)
    let offset = 0

    // Write work report length (4 bytes, little-endian)
    view.setUint32(offset, response.workReport.length, true)
    offset += 4

    // Write work report data
    new Uint8Array(buffer).set(response.workReport, offset)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize work report response message
   */
  deserializeWorkReportResponse(data: Bytes): WorkReportResponse {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read work report length (4 bytes, little-endian)
    const workReportLength = view.getUint32(offset, true)
    offset += 4

    // Read work report data
    const workReport = data.slice(offset, offset + workReportLength)

    return {
      workReport
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(stream: StreamInfo, data: Bytes): Promise<WorkReportResponse | null> {
    try {
      const request = this.deserializeWorkReportRequest(data)
      return await this.processWorkReportRequest(request)
    } catch (error) {
      console.error('Failed to handle work report request stream data:', error)
      return null
    }
  }
} 